"""
Custom logo layer: the creator can upload their own PNG/JPG logo for a launch page.
"""

import base64
import json
import re
import time

from fastapi import Request
from fastapi.responses import JSONResponse, Response

import launch_page as _lv
import showcase as _pm
from showcase import *  # noqa: F401,F403


def __getattr__(name):
    return getattr(_pm, name)


KEY_LOGO = "orynx:launch:logo:"
KEY_LIST = "orynx:launch:logos"
MAX_LOGO = 400_000
RE_LOGO_GALLERY = re.compile(r"/api/gallery/logo/([A-Za-z0-9_-]{6,40})/?")
RE_LOGO_OWN = re.compile(r"/api/launch/logo/([A-Za-z0-9_-]{6,40})/?")


def _kind(b: bytes):
    if b[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if b[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if b[:4] == b"RIFF" and b[8:12] == b"WEBP":
        return "image/webp"
    return None


async def _get_logo(kit_id: str):
    try:
        fill = await _lv._kv("GET", KEY_LOGO + kit_id)
        if not fill:
            return None
        d = json.loads(fill)
        return d.get("m"), base64.b64decode(d.get("b", "")), d.get("v", 0)
    except Exception:
        return None


async def _list_logo():
    try:
        fill = await _lv._kv("HGETALL", KEY_LIST) or []
        return {fill[i]: int(fill[i + 1]) for i in range(0, len(fill) - 1, 2)}
    except Exception:
        return {}


async def _save_logo(request: Request):
    try:
        d = await request.json()
    except Exception:
        return JSONResponse({"detail": "Bad request."}, 400)
    kit_id = str(d.get("id") or "")
    if not _lv.RE_ID.fullmatch(kit_id):
        return JSONResponse({"detail": "Unknown kit."}, 400)
    if not _lv._allowed_edit(kit_id, str(d.get("edit") or ""), str(d.get("key") or "")):
        return JSONResponse({"detail": "Only the person who shared this kit can change its logo."}, 403)

    data = str(d.get("data") or "")
    try:
        if not data:  # fall back to the original logo
            await _lv._kv("DEL", KEY_LOGO + kit_id)
            await _lv._kv("HDEL", KEY_LIST, kit_id)
            return JSONResponse({"ok": True, "logo": ""})
        if "," in data:
            data = data.split(",", 1)[1]
        raw = base64.b64decode(data, validate=True)
    except Exception:
        return JSONResponse({"detail": "That image couldn't be read. Try a PNG or JPG."}, 400)
    if len(raw) > MAX_LOGO:
        return JSONResponse({"detail": "Logo is too big. Try a smaller image."}, 400)
    kind = _kind(raw)
    if not kind:
        return JSONResponse({"detail": "Use a PNG, JPG or WebP image."}, 400)

    version = int(time.time())
    try:
        await _lv._kv("SET", KEY_LOGO + kit_id, json.dumps({"m": kind, "b": base64.b64encode(raw).decode(), "v": version}))
        await _lv._kv("HSET", KEY_LIST, kit_id, str(version))
    except Exception:
        return JSONResponse({"detail": "Couldn't save right now. Try again in a moment."}, 503)
    return JSONResponse({"ok": True, "logo": f"/api/launch/logo/{kit_id}?v={version}"})


# ---------------------------------------------------------------------------
# Extra JAVASCRIPT: swap logo images in the gallery, plus the logo editor on /k/<id>
# ---------------------------------------------------------------------------
JS_LOGO = r"""
(() => {
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || "null") ?? d; } catch (_) { return d; } };
let lookup = {};
function swap() {
  document.querySelectorAll('img[src*="/api/gallery/logo/"]').forEach((img) => {
    const m = img.getAttribute("src").match(/\/api\/gallery\/logo\/([A-Za-z0-9_-]+)/);
    if (m && lookup[m[1]]) img.src = `/api/launch/logo/${m[1]}?v=${lookup[m[1]]}`;
  });
}
fetch("/api/launch/logos").then((r) => r.json()).then((h) => {
  lookup = h.logos || {}; if (!Object.keys(lookup).length) return;
  swap(); new MutationObserver(swap).observe(document.body, { childList: true, subtree: true });
}).catch(() => {});

const P = window.__LP; if (!P) return;
const q = new URLSearchParams(location.search);
const owned = (read("orynx_launch_keys", {}) || {})[P.id] || null;
if (!owned && !q.has("admin")) return;
const box = document.getElementById("lpEdit"); if (!box) return;
let key = "";
const block = document.createElement("div");
block.innerHTML = '<label>Logo</label><div class="lp-logo"><img id="lpLogoPrev" alt="Logo preview"><div>'
  + '<p class="lp-note">Have your own logo? Upload a PNG or JPG. It replaces the AI logo on this page and in the gallery.</p>'
  + '<div class="lp-acts" style="margin-top:10px"><label class="lp-btn" for="lpLogoFile" style="margin:0;color:#fff">Upload logo</label>'
  + '<button class="lp-btn" type="button" id="lpLogoReset">Use the AI logo</button></div>'
  + '<p class="lp-msg" id="lpLogoMsg"></p></div></div><input type="file" id="lpLogoFile" accept="image/png,image/jpeg,image/webp" hidden>';
const s = document.createElement("style");
s.textContent = ".lp-logo{display:flex;gap:16px;align-items:center}.lp-logo img{width:96px;height:96px;border-radius:26%;object-fit:cover;border:1px solid #2c2c2c;background:#111;flex:none}.lp-logo .lp-msg{margin-top:8px}";
document.head.append(s);
const title = box.querySelector("label"); box.insertBefore(block, title);
const prev = document.getElementById("lpLogoPrev"), msg = document.getElementById("lpLogoMsg");
const logoCard = document.querySelector(".card .logo img");
prev.src = logoCard ? logoCard.src : `/api/gallery/logo/${P.id}`;

function shrink(file) {
  return new Promise((ok, failed) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const n = 512, c = document.createElement("canvas"); c.width = n; c.height = n;
      const x = c.getContext("2d"), side = Math.min(img.width, img.height);
      x.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, n, n);
      URL.revokeObjectURL(url);
      let d = c.toDataURL("image/png");
      if (d.length > 480000) d = c.toDataURL("image/jpeg", 0.9);
      ok(d);
    };
    img.onerror = () => { URL.revokeObjectURL(url); failed(new Error("That image couldn't be opened.")); };
    img.src = url;
  });
}
async function send(data) {
  const fill = { id: P.id, edit: owned ? owned.edit : "", data };
  if (!owned) { key = key || prompt("Admin key") || ""; fill.key = key; }
  const h = await fetch("/api/launch/logo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fill) });
  const j = await h.json().catch(() => ({}));
  if (!h.ok) { if (h.status === 403) key = ""; throw new Error(j.detail || "Something went wrong. Try again."); }
  return j.logo;
}
document.getElementById("lpLogoFile").onchange = async (e) => {
  const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
  msg.style.color = "#aaa"; msg.textContent = "Uploading...";
  try {
    const url = await send(await shrink(f));
    prev.src = url; if (logoCard) logoCard.src = url;
    msg.style.color = "#bfe8c4"; msg.textContent = "Logo updated.";
  } catch (err) { msg.style.color = ""; msg.textContent = err.message; }
};
document.getElementById("lpLogoReset").onclick = async () => {
  msg.style.color = "#aaa"; msg.textContent = "Saving...";
  try {
    await send("");
    const original = `/api/gallery/logo/${P.id}?r=${Date.now()}`;
    prev.src = original; if (logoCard) logoCard.src = original;
    msg.style.color = "#bfe8c4"; msg.textContent = "Back to the AI logo.";
  } catch (err) { msg.style.color = ""; msg.textContent = err.message; }
};
})();
"""

_lv.VERSION_JS = "3"
_lv.JS = _lv.JS + JS_LOGO


def _install_logo(app):
    @app.middleware("http")
    async def logo_own(request: Request, call_next):
        path = request.url.path
        method = request.method

        if path == "/api/launch/logo" and method == "POST":
            return await _save_logo(request)
        if path == "/api/launch/logos" and method == "GET":
            return JSONResponse({"logos": await _list_logo()}, headers={"Cache-Control": "public, max-age=60"})

        m = RE_LOGO_OWN.fullmatch(path) if method == "GET" else None
        if m:
            result = await _get_logo(m.group(1))
            if not result:
                return Response(status_code=404)
            return Response(result[1], media_type=result[0], headers={"Cache-Control": "public, max-age=31536000, immutable"})

        m = RE_LOGO_GALLERY.fullmatch(path) if method == "GET" else None
        if m:
            result = await _get_logo(m.group(1))
            if result:
                return Response(result[1], media_type=result[0], headers={"Cache-Control": "public, max-age=300"})

        resp = await call_next(request)
        if (resp.status_code != 200 or method != "GET" or resp.headers.get("content-encoding")
                or "html" not in resp.headers.get("content-type", "")):
            return resp
        if not (path in ("/", "/index.html") or _lv.RE_KIT.fullmatch(path)):
            return resp
        body = await _lv._read_body(resp)
        try:
            body = body.replace(b"/launch.js?v=2", b"/launch.js?v=3").replace(b"/launch.js?v=1", b"/launch.js?v=3")
            mk = _lv.RE_KIT.fullmatch(path)
            if mk:
                result = await _get_logo(mk.group(1))
                if result:
                    old = f"/api/gallery/logo/{mk.group(1)}\"".encode()
                    fresh = f"/api/launch/logo/{mk.group(1)}?v={result[2]}\"".encode()
                    body = body.replace(old, fresh)
        except Exception:
            pass
        return _lv._response_new(resp, body)


def install(app, g):
    result = _pm.install(app, g)
    try:
        _install_logo(app)
    except Exception:
        pass
    return result
