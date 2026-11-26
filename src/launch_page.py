"""
Launch page layer. The creator of a kit can turn its /k/<id> page into a launch page
(CA, buy button on pons, explorer, X/Telegram/website links, description and
features/lore). Data is stored in KV (Upstash Redis).
"""

import hashlib
import hmac
import html
import json
import os
import re
import time

import httpx
from fastapi import Request
from fastapi.responses import JSONResponse, Response

import features_core as _old
from features_core import *  # noqa: F401,F403  (everything from the core features stays available)


def __getattr__(name):
    return getattr(_old, name)


# ---------------------------------------------------------------------------
# SETTINGS
# ---------------------------------------------------------------------------
KV_URL = os.getenv("KV_REST_API_URL", "").rstrip("/")
KV_TOKEN = os.getenv("KV_REST_API_TOKEN", "")
ADMIN_KEY = os.getenv("ADMIN_KEY", "")
SECRET = (os.getenv("LAUNCH_SECRET") or ADMIN_KEY or KV_TOKEN or "").encode()
RPC = os.getenv("ROBINHOOD_RPC", "https://rpc.mainnet.chain.robinhood.com")
PREFIX = "orynx:launch:"
SET_LIVE = "orynx:launch:live"
VERSION_JS = "1"

RE_ID = re.compile(r"[A-Za-z0-9_-]{6,40}")
RE_CA = re.compile(r"0x[0-9a-fA-F]{40}")
RE_X = re.compile(r"[A-Za-z0-9_]{1,15}")
RE_TG = re.compile(r"[A-Za-z0-9_]{4,32}")
RE_KIT = re.compile(r"/k/([A-Za-z0-9_-]{6,40})/?")


def _token(kit_id: str) -> str:
    return hmac.new(SECRET, ("launch:" + kit_id).encode(), hashlib.sha256).hexdigest()[:32]


def _allowed_edit(kit_id: str, edit: str, key: str) -> bool:
    if SECRET and edit and hmac.compare_digest(edit, _token(kit_id)):
        return True
    return bool(ADMIN_KEY and key and hmac.compare_digest(key, ADMIN_KEY))


async def _kv(*command):
    if not (KV_URL and KV_TOKEN):
        raise RuntimeError("KV is not configured")
    async with httpx.AsyncClient(timeout=8) as c:
        r = await c.post(KV_URL, json=list(command), headers={"Authorization": f"Bearer {KV_TOKEN}"})
        r.raise_for_status()
        return r.json().get("result")


async def _get(kit_id: str):
    try:
        fill = await _kv("GET", PREFIX + kit_id)
        return json.loads(fill) if fill else None
    except Exception:
        return None


# ---------------------------------------------------------------------------
# TOKEN CHECK ON ROBINHOOD CHAIN (name & symbol via eth_call)
# ---------------------------------------------------------------------------
def _decode_string(hexdata: str) -> str:
    d = bytes.fromhex(hexdata[2:] if hexdata.startswith("0x") else hexdata)
    if len(d) >= 96:
        n = int.from_bytes(d[32:64], "big")
        return d[64:64 + n].decode("utf-8", "ignore").strip()
    if len(d) == 32:  # older tokens that use bytes32
        return d.rstrip(b"\x00").decode("utf-8", "ignore").strip()
    return ""


async def _check_token(ca: str):
    """Returns dict(name, symbol) for a token, False if it is not a token, None if the RPC failed."""
    try:
        async with httpx.AsyncClient(timeout=8) as c:
            batch = [
                {"jsonrpc": "2.0", "id": 1, "method": "eth_call", "params": [{"to": ca, "data": "0x06fdde03"}, "latest"]},
                {"jsonrpc": "2.0", "id": 2, "method": "eth_call", "params": [{"to": ca, "data": "0x95d89b41"}, "latest"]},
            ]
            r = await c.post(RPC, json=batch)
            r.raise_for_status()
            result = {x.get("id"): x for x in r.json()}
    except Exception:
        return None
    try:
        name = _decode_string(result[1].get("result") or "0x")
        symbol = _decode_string(result[2].get("result") or "0x")
    except Exception:
        return False
    if not symbol:
        return False
    return {"name": name[:60], "symbol": symbol[:20]}


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------
def _clean_text(t, cap):
    return re.sub(r"\s+\n", "\n", str(t or "")).strip()[:cap]


def _clean_web(u: str) -> str:
    u = str(u or "").strip()[:200]
    if not u:
        return ""
    if not re.match(r"^https?://", u, re.I):
        u = "https://" + u
    if not re.match(r"^https?://[A-Za-z0-9.-]+\.[A-Za-z]{2,}(/[^\s<>\"']*)?$", u):
        raise ValueError("Website link doesn't look right.")
    return u


def _clean_x(x: str) -> str:
    x = str(x or "").strip()
    x = re.sub(r"^(https?://)?(www\.)?(x|twitter)\.com/", "", x, flags=re.I).lstrip("@").split("/")[0].split("?")[0]
    if x and not RE_X.fullmatch(x):
        raise ValueError("X handle doesn't look right.")
    return x


def _clean_tg(t: str) -> str:
    t = str(t or "").strip()
    t = re.sub(r"^(https?://)?(www\.)?(t\.me|telegram\.me)/", "", t, flags=re.I).lstrip("@").split("?")[0].strip("/")
    if t and not (RE_TG.fullmatch(t) or re.fullmatch(r"\+[A-Za-z0-9_-]{6,40}", t)):
        raise ValueError("Telegram link doesn't look right.")
    return t


async def _save(request: Request):
    try:
        d = await request.json()
    except Exception:
        return JSONResponse({"detail": "Bad request."}, 400)
    kit_id = str(d.get("id") or "")
    if not RE_ID.fullmatch(kit_id):
        return JSONResponse({"detail": "Unknown kit."}, 400)
    if not _allowed_edit(kit_id, str(d.get("edit") or ""), str(d.get("key") or "")):
        return JSONResponse({"detail": "Only the person who shared this kit can edit its launch page."}, 403)

    old = await _get(kit_id) or {}
    try:
        ca = str(d.get("ca") or "").strip()
        if ca and not RE_CA.fullmatch(ca):
            raise ValueError("Contract address should start with 0x and be 42 characters long.")
        record = {
            "ca": ca.lower() if ca else "",
            "x": _clean_x(d.get("x")),
            "tg": _clean_tg(d.get("tg")),
            "web": _clean_web(d.get("web")),
            "description": _clean_text(d.get("description") or old.get("description"), 1500),
            "features": [_clean_text(f, 220) for f in (d.get("features") or old.get("features") or [])][:3],
            "mode": "meme" if (d.get("mode") or old.get("mode")) == "meme" else "ai",
            "t": int(time.time()),
        }
    except ValueError as e:
        return JSONResponse({"detail": str(e)}, 400)

    if record["ca"]:
        if record["ca"] == old.get("ca") and old.get("symbol"):
            record["name"], record["symbol"] = old.get("name", ""), old.get("symbol", "")
        else:
            info = await _check_token(record["ca"])
            if info is False:
                return JSONResponse({"detail": "That address isn't a token on Robinhood Chain. Copy the CA from your pons page."}, 400)
            if info:
                record["name"], record["symbol"] = info["name"], info["symbol"]
        record["since"] = old.get("since") if old.get("ca") else record["t"]

    try:
        await _kv("SET", PREFIX + kit_id, json.dumps(record))
        await _kv("SADD" if record["ca"] else "SREM", SET_LIVE, kit_id)
    except Exception:
        return JSONResponse({"detail": "Couldn't save right now. Try again in a moment."}, 503)
    return JSONResponse({"ok": True, "launch": record})


async def _live():
    try:
        ids = await _kv("SMEMBERS", SET_LIVE) or []
    except Exception:
        ids = []
    return JSONResponse({"ids": ids[:500]}, headers={"Cache-Control": "public, max-age=60"})


# ---------------------------------------------------------------------------
# VIEW: the launch page block injected into /k/<id>
# ---------------------------------------------------------------------------
CSS = """
.lp{width:min(920px,100%);margin-top:22px;display:grid;gap:18px}
.lp-box{padding:26px 28px;border:1px solid #262626;border-radius:24px;background:#070707}
.lp-live{display:inline-flex;align-items:center;gap:8px;font-size:13px;color:#d8ffd8;border:1px solid #1f3b22;background:#0b1a0d;border-radius:999px;padding:4px 12px}
.lp-live i{width:8px;height:8px;border-radius:50%;background:#4ade80;box-shadow:0 0 0 4px rgba(74,222,128,.18)}
.lp-soon{display:inline-block;font-size:13px;color:#bdbdbd;border:1px solid #333;border-radius:999px;padding:4px 12px}
.lp h2{font:400 22px/1.3 Michroma;margin:14px 0 12px}
.lp-ca{display:flex;gap:8px;align-items:center;background:#000;border:1px solid #2a2a2a;border-radius:14px;padding:8px 8px 8px 14px;margin:6px 0 14px}
.lp-ca code{flex:1;min-width:0;overflow-wrap:anywhere;font:14px ui-monospace,Menlo,monospace;color:#eee}
.lp-ca button,.lp-btn{font:600 14px "Instrument Sans",sans-serif;border-radius:999px;border:1px solid #333;background:none;color:#fff;padding:8px 16px;cursor:pointer}
.lp-ca button:hover,.lp-btn:hover{border-color:#fff}
.lp-acts{display:flex;gap:10px;flex-wrap:wrap}
.lp-soc{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
.lp-soc a{display:inline-flex;align-items:center;gap:8px;border:1px solid #333;border-radius:999px;padding:8px 14px;text-decoration:none;font-size:14px}
.lp-soc a:hover{border-color:#fff}.lp-soc svg{width:16px;height:16px;fill:#fff}
.lp-chain{font-size:13px;color:#8a8a8a;margin:10px 0 0}.lp-warn{color:#ffcf70}
.lp-desc{white-space:pre-line;color:#ddd;margin:0}
.lp-list{margin:14px 0 0;padding:0;list-style:none;display:grid;gap:8px}
.lp-list li{padding:12px 14px;border:1px solid #222;border-radius:14px;color:#ddd}
.lp-note{font-size:13px;color:#777;margin:0}
.lp-edit{display:none}.lp-edit.on{display:block}
.lp-edit label{display:block;font-size:13px;color:#aaa;margin:12px 0 6px}
.lp-edit input,.lp-edit textarea{width:100%;background:#000;border:1px solid #2c2c2c;border-radius:12px;color:#fff;padding:11px 13px;font:15px "Instrument Sans",sans-serif}
.lp-edit textarea{min-height:110px;resize:vertical}
.lp-edit input:focus,.lp-edit textarea:focus{outline:none;border-color:#fff}
.lp-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.lp-msg{font-size:14px;margin:12px 0 0;color:#ffb4b4;min-height:1em}
.lp-owner{display:none;justify-content:flex-end}.lp-owner.on{display:flex}
@media (max-width:700px){.lp-box{padding:20px}.lp-row{grid-template-columns:1fr}.lp-acts .pill{flex:1}}
"""

ICON_X = '<svg viewBox="0 0 24 24"><path d="M17.8 3h3.1l-6.8 7.7 8 10.3h-6.2l-4.9-6.3L5.4 21H2.3l7.2-8.3L1.9 3h6.4l4.4 5.8zm-1.1 16.2h1.7L7.4 4.7H5.6z"/></svg>'
ICON_TG = '<svg viewBox="0 0 24 24"><path d="M21.4 4.1 2.9 11.2c-1.3.5-1.2 1.2-.2 1.5l4.7 1.5 1.8 5.6c.2.6.4.8.9.8.4 0 .6-.2.9-.4l2.3-2.2 4.7 3.5c.9.5 1.5.2 1.7-.8l3.1-14.6c.3-1.3-.5-1.9-1.4-1.5zM8.9 13.9l9.5-6c.4-.3.8-.1.5.2l-7.8 7.1-.3 3.5z"/></svg>'
ICON_WEB = '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.9 6h-2.9a15.6 15.6 0 0 0-1.4-3.6A8 8 0 0 1 18.9 8zM12 4c.8 1.2 1.5 2.5 1.9 4h-3.8c.4-1.5 1.1-2.8 1.9-4zM4.3 14a8.2 8.2 0 0 1 0-4h3.4a16.5 16.5 0 0 0 0 4zm.8 2h2.9c.3 1.3.8 2.5 1.4 3.6A8 8 0 0 1 5.1 16zM8 8H5.1a8 8 0 0 1 4.3-3.6C8.8 5.5 8.3 6.7 8 8zm4 12c-.8-1.2-1.5-2.5-1.9-4h3.8c-.4 1.5-1.1 2.8-1.9 4zm2.3-6H9.7a14.7 14.7 0 0 1 0-4h4.6a14.7 14.7 0 0 1 0 4zm.3 5.6c.6-1.1 1.1-2.3 1.4-3.6h2.9a8 8 0 0 1-4.3 3.6zm1.7-5.6a16.5 16.5 0 0 0 0-4h3.4a8.2 8.2 0 0 1 0 4z"/></svg>'


def _e(t):
    return html.escape(str(t or ""), quote=True)


def _block(kit_id: str, r: dict, ticker: str) -> str:
    bag = []
    r = r or {}
    if r.get("ca"):
        ca = r["ca"]
        chain = ""
        if r.get("symbol"):
            chain = f'<p class="lp-chain">On-chain: {_e(r.get("name"))} (${_e(r["symbol"])})</p>'
            if ticker and r["symbol"].upper() != ticker.upper():
                chain += f'<p class="lp-chain lp-warn">Heads up: the token at this address uses the ticker ${_e(r["symbol"])}, not ${_e(ticker)}.</p>'
        soc = []
        if r.get("x"):
            soc.append(f'<a href="https://x.com/{_e(r["x"])}" target="_blank" rel="noopener">{ICON_X}@{_e(r["x"])}</a>')
        if r.get("tg"):
            soc.append(f'<a href="https://t.me/{_e(r["tg"])}" target="_blank" rel="noopener">{ICON_TG}Telegram</a>')
        if r.get("web"):
            label = re.sub(r"^https?://(www\.)?", "", r["web"]).rstrip("/")[:40]
            soc.append(f'<a href="{_e(r["web"])}" target="_blank" rel="noopener nofollow">{ICON_WEB}{_e(label)}</a>')
        bag.append(
            '<section class="lp-box">'
            '<span class="lp-live"><i></i>Live on pons · Robinhood Chain</span>'
            '<h2>Contract address</h2>'
            f'<div class="lp-ca"><code id="lpCa">{_e(ca)}</code><button type="button" id="lpCopy">Copy</button></div>'
            '<div class="lp-acts">'
            f'<a class="pill solid" href="https://ponsfamily.com/launchpad/{_e(ca)}" target="_blank" rel="noopener">Buy on pons</a>'
            f'<a class="pill line" href="https://robin.etherscan.io/token/{_e(ca)}" target="_blank" rel="noopener">View on explorer</a>'
            '</div>'
            + (f'<div class="lp-soc">{"".join(soc)}</div>' if soc else "")
            + chain
            + '</section>'
        )
    elif r.get("x") or r.get("tg") or r.get("web") or r.get("description"):
        bag.append('<section class="lp-box"><span class="lp-soon">Launching soon on pons</span>'
                   '<p class="lp-note" style="margin-top:12px">The contract address will appear here once the token is live. Only trust the address shown on this page and the project\'s own accounts.</p>'
                   + ("".join([
                       f'<div class="lp-soc">'
                       + (f'<a href="https://x.com/{_e(r["x"])}" target="_blank" rel="noopener">{ICON_X}@{_e(r["x"])}</a>' if r.get("x") else "")
                       + (f'<a href="https://t.me/{_e(r["tg"])}" target="_blank" rel="noopener">{ICON_TG}Telegram</a>' if r.get("tg") else "")
                       + (f'<a href="{_e(r["web"])}" target="_blank" rel="noopener nofollow">{ICON_WEB}Website</a>' if r.get("web") else "")
                       + '</div>']) if (r.get("x") or r.get("tg") or r.get("web")) else "")
                   + '</section>')

    if r.get("description") or r.get("features"):
        title_f = "Lore" if r.get("mode") == "meme" else "Key features"
        fill = '<section class="lp-box"><h2 style="margin-top:0">About</h2>'
        if r.get("description"):
            fill += f'<p class="lp-desc">{_e(r["description"])}</p>'
        if r.get("features"):
            fill += f'<h2>{title_f}</h2><ul class="lp-list">' + "".join(f"<li>{_e(f)}</li>" for f in r["features"]) + "</ul>"
        bag.append(fill + "</section>")

    if r.get("ca") or r.get("description"):
        bag.append('<p class="lp-note">Launch details are added by the person who built this kit. Orynx doesn\'t vet projects. Always check the contract yourself. Not financial advice.</p>')

    editor = (
        '<div class="lp-owner" id="lpOwner"><button class="lp-btn" type="button" id="lpOpen">'
        + ("Edit launch page" if r.get("ca") or r.get("description") else "Turn this into your launch page")
        + '</button></div>'
        '<section class="lp-box lp-edit" id="lpEdit">'
        '<h2 style="margin-top:0">Your launch page</h2>'
        '<p class="lp-note">Launched on pons? Paste your contract address and links. This page becomes the one link to share with your community.</p>'
        '<label for="lpFCa">Contract address (from your pons page)</label><input id="lpFCa" maxlength="42" placeholder="0x..." autocomplete="off" spellcheck="false">'
        '<div class="lp-row"><div><label for="lpFX">X handle</label><input id="lpFX" maxlength="40" placeholder="@yourproject"></div>'
        '<div><label for="lpFTg">Telegram</label><input id="lpFTg" maxlength="60" placeholder="t.me/yourgroup"></div></div>'
        '<label for="lpFWeb">Website (optional)</label><input id="lpFWeb" maxlength="200" placeholder="https://...">'
        '<label for="lpFDesc">Description</label><textarea id="lpFDesc" maxlength="1500"></textarea>'
        '<div class="lp-acts" style="margin-top:16px"><button class="pill solid" type="button" id="lpSave">Save launch page</button>'
        '<button class="pill line" type="button" id="lpCancel">Cancel</button></div>'
        '<p class="lp-msg" id="lpMsg" role="alert"></p>'
        '</section>'
    )
    data = json.dumps({"id": kit_id, "r": r}).replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")
    script = "<script>window.__LP=" + data + ";</script><script src=\"/launch.js?v=" + VERSION_JS + "\" defer></script>"
    return f'<style>{CSS}</style><div class="lp">{"".join(bag)}{editor}</div>{script}'


# ---------------------------------------------------------------------------
# JAVASCRIPT (used on the home page and on /k/<id>)
# ---------------------------------------------------------------------------
JS = r"""
(() => {
const KEY = "orynx_launch_keys";
const SAVE = "orynx_kit_v1";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || "null") ?? d; } catch (_) { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
const keyKit = (id) => (read(KEY, {})[id] || null);

// 1) Catch the edit token when a kit is shared to the gallery
const original = window.fetch;
window.fetch = async function (url, opt) {
  const res = await original.apply(this, arguments);
  try {
    if (String(url).split("?")[0] === "/api/gallery" && opt && opt.method === "POST" && res.ok) {
      res.clone().json().then((h) => {
        const m = (h && h.url || "").match(/\/k\/([A-Za-z0-9_-]+)/);
        if (!m || !h.edit) return;
        const kit = (read(SAVE, {}) || {}).kit || {};
        const entries = read(KEY, {});
        entries[m[1]] = { edit: h.edit, description: kit.description || "", features: kit.features || [], t: Date.now() };
        write(KEY, entries);
        setTimeout(buttonHome, 300);
      }).catch(() => {});
    }
  } catch (_) {}
  return res;
};

// 2) Home page: "Set up launch page" button in the kit link row
function buttonHome() {
  const row = document.getElementById("shareRow"); if (!row) return;
  const kitActive = read(SAVE, {}) || {};
  const m = (kitActive.link || "").match(/\/k\/([A-Za-z0-9_-]+)/);
  let b = document.getElementById("lpHomeBtn");
  if (!m || !keyKit(m[1])) { if (b) b.remove(); return; }
  if (!b) { b = document.createElement("a"); b.id = "lpHomeBtn"; b.className = "pill line"; row.append(b); }
  b.href = `/k/${m[1]}?edit=1`; b.textContent = "Set up launch page";
}

// 3) Gallery: "Live" badge on kits that have launched
let live = new Set();
function badge() {
  document.querySelectorAll('a.ex-open[href^="/k/"]').forEach((a) => {
    const id = a.getAttribute("href").slice(3);
    if (!live.has(id) || a.dataset.lp) return;
    a.dataset.lp = "1";
    const card = a.closest("article.ex");
    const top = card && card.querySelector(".ex-top div");
    if (!top) return;
    const s = document.createElement("span"); s.className = "lp-badge"; s.innerHTML = "<i></i>Live on pons";
    top.append(s);
    a.textContent = "Open launch page";
  });
}

// 4) /k/<id> page: launch page editor
function editor() {
  const P = window.__LP; if (!P) return;
  const r = P.r || {};
  const q = new URLSearchParams(location.search);
  const owned = keyKit(P.id);
  const admin = q.has("admin");
  const btnCopy = document.getElementById("lpCopy");
  if (btnCopy) btnCopy.onclick = () => { navigator.clipboard.writeText(document.getElementById("lpCa").textContent).then(() => { btnCopy.textContent = "Copied"; setTimeout(() => btnCopy.textContent = "Copy", 1200); }); };
  if (!owned && !admin) return;
  const $ = (i) => document.getElementById(i);
  const box = $("lpEdit"), owner = $("lpOwner");
  owner.classList.add("on");
  const openIt = () => {
    $("lpFCa").value = r.ca || "";
    $("lpFX").value = r.x ? "@" + r.x : "";
    $("lpFTg").value = r.tg ? "t.me/" + r.tg : "";
    $("lpFWeb").value = r.web || "";
    $("lpFDesc").value = r.description || (owned && owned.description) || "";
    box.classList.add("on"); owner.classList.remove("on");
    box.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  $("lpOpen").onclick = openIt;
  $("lpCancel").onclick = () => { box.classList.remove("on"); owner.classList.add("on"); };
  $("lpSave").onclick = async () => {
    const btn = $("lpSave"), msg = $("lpMsg");
    msg.textContent = ""; btn.disabled = true; btn.textContent = "Saving...";
    const send = { id: P.id, edit: owned ? owned.edit : "", ca: $("lpFCa").value.trim(), x: $("lpFX").value, tg: $("lpFTg").value,
      web: $("lpFWeb").value, description: $("lpFDesc").value, features: (r.features && r.features.length ? r.features : (owned && owned.features) || []),
      mode: r.mode || (document.querySelector(".chip") && /meme/i.test(document.querySelector(".chip").textContent) ? "meme" : "ai") };
    if (admin && !owned) send.key = prompt("Admin key") || "";
    try {
      const h = await fetch("/api/launch/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(send) });
      const fill = await h.json().catch(() => ({}));
      if (!h.ok) throw new Error(fill.detail || "Something went wrong. Try again.");
      location.href = location.pathname;
    } catch (e) { msg.textContent = e.message; btn.disabled = false; btn.textContent = "Save launch page"; }
  };
  if (q.has("edit")) openIt();
}

function style() {
  const s = document.createElement("style");
  s.textContent = '.lp-badge{display:inline-flex;align-items:center;gap:6px;margin-left:8px;font:600 11px "Instrument Sans",sans-serif;color:#d8ffd8;border:1px solid #1f3b22;background:#0b1a0d;border-radius:999px;padding:2px 9px;vertical-align:middle}.lp-badge i{width:6px;height:6px;border-radius:50%;background:#4ade80}';
  document.head.append(s);
}

if (window.__LP) { editor(); return; }
style();
buttonHome();
const row = document.getElementById("shareRow");
if (row) new MutationObserver(buttonHome).observe(row, { attributes: true, attributeFilter: ["hidden"] });
fetch("/api/launch/live").then((r) => r.json()).then((h) => {
  live = new Set(h.ids || []); badge();
  new MutationObserver(badge).observe(document.body, { childList: true, subtree: true });
}).catch(() => {});
})();
"""


# ---------------------------------------------------------------------------
# MIDDLEWARE: wires everything up without touching app.py
# ---------------------------------------------------------------------------
async def _read_body(resp):
    cut = []
    async for c in resp.body_iterator:
        cut.append(c if isinstance(c, bytes) else c.encode())
    return b"".join(cut)


def _response_new(resp, body: bytes):
    head = {k: v for k, v in resp.headers.items() if k.lower() != "content-length"}
    return Response(content=body, status_code=resp.status_code, headers=head)


def _install_launch(app):
    @app.middleware("http")
    async def launch_page(request: Request, call_next):
        path = request.url.path
        method = request.method

        if path == "/launch.js":
            return Response(JS, media_type="application/javascript; charset=utf-8",
                            headers={"Cache-Control": "public, max-age=300"})
        if path == "/api/launch/save" and method == "POST":
            return await _save(request)
        if path == "/api/launch/live" and method == "GET":
            return await _live()

        resp = await call_next(request)
        if resp.status_code != 200 or resp.headers.get("content-encoding"):
            return resp
        kind = resp.headers.get("content-type", "")

        try:
            # Edit token for the kit's creator, handed out when the kit is shared
            if path == "/api/gallery" and method == "POST" and "json" in kind and SECRET:
                body = await _read_body(resp)
                try:
                    h = json.loads(body)
                    m = RE_KIT.search(str(h.get("url") or ""))
                    if m:
                        h["edit"] = _token(m.group(1))
                        body = json.dumps(h).encode()
                except Exception:
                    pass
                return _response_new(resp, body)

            # Home page: add launch.js
            if path in ("/", "/index.html") and method == "GET" and "html" in kind:
                body = await _read_body(resp)
                tag = f'<script src="/launch.js?v={VERSION_JS}" defer></script>'.encode()
                if b"/launch.js" not in body:
                    body = body.replace(b"</body>", tag + b"\n</body>", 1)
                return _response_new(resp, body)

            # Kit page: inject the launch page block
            m = RE_KIT.fullmatch(path)
            if m and method == "GET" and "html" in kind:
                body = await _read_body(resp)
                try:
                    return _response_new(resp, (await _edit_kit(m.group(1), body.decode("utf-8"))).encode())
                except Exception:
                    return _response_new(resp, body)
        except Exception:
            return resp
        return resp


async def _edit_kit(kit_id, text):
    r = await _get(kit_id)
    mt = re.search(r'<div class="tk">\$([^<]*)</div>', text)
    ticker = html.unescape(mt.group(1)) if mt else ""
    if r and r.get("ca"):
        text = text.replace('<span class="chip">',
                            '<span class="chip" style="border-color:#1f3b22;color:#d8ffd8;margin-right:6px">● Live on pons</span><span class="chip">', 1)
        text = text.replace("Community kit, not financial advice.", "Launch page, not financial advice.", 1)
    text = text.replace("</main>", _block(kit_id, r, ticker) + "</main>", 1)
    # main uses a grid: stack the card and the block vertically
    text = text.replace("main{flex:1;display:grid;place-items:center;",
                        "main{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;", 1)
    return text


def install(app, g):
    result = _old.install(app, g)
    try:
        _install_launch(app)
    except Exception:
        pass
    return result
