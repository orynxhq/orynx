"""
Fitur Orynx (pintu masuk).
- fitur_lama.py : burn tracker, referral, remix, launch thread
- launch_v1.py  : launch page /k/<id>
- pamer_v1.py   : bagian pamer launch page di halaman utama
- file ini      : logo sendiri untuk launch page (upload PNG/JPG)
Dipasang dari app.py lewat pasang(app, globals()), sama seperti sebelumnya.
"""

import base64
import json
import re
import time

from fastapi import Request
from fastapi.responses import JSONResponse, Response

import launch_v1 as _lv
import pamer_v1 as _pm
from pamer_v1 import *  # noqa: F401,F403


def __getattr__(nama):
    return getattr(_pm, nama)


KUNCI_LOGO = "orynx:launch:logo:"
KUNCI_DAFTAR = "orynx:launch:logos"
MAKS_LOGO = 400_000
RE_LOGO_GALERI = re.compile(r"/api/galeri/logo/([A-Za-z0-9_-]{6,40})/?")
RE_LOGO_SENDIRI = re.compile(r"/api/launch/logo/([A-Za-z0-9_-]{6,40})/?")


def _jenis(b: bytes):
    if b[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if b[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if b[:4] == b"RIFF" and b[8:12] == b"WEBP":
        return "image/webp"
    return None


async def _ambil_logo(kit_id: str):
    try:
        isi = await _lv._kv("GET", KUNCI_LOGO + kit_id)
        if not isi:
            return None
        d = json.loads(isi)
        return d.get("m"), base64.b64decode(d.get("b", "")), d.get("v", 0)
    except Exception:
        return None


async def _daftar_logo():
    try:
        isi = await _lv._kv("HGETALL", KUNCI_DAFTAR) or []
        return {isi[i]: int(isi[i + 1]) for i in range(0, len(isi) - 1, 2)}
    except Exception:
        return {}


async def _simpan_logo(request: Request):
    try:
        d = await request.json()
    except Exception:
        return JSONResponse({"detail": "Bad request."}, 400)
    kit_id = str(d.get("id") or "")
    if not _lv.RE_ID.fullmatch(kit_id):
        return JSONResponse({"detail": "Unknown kit."}, 400)
    if not _lv._boleh_edit(kit_id, str(d.get("edit") or ""), str(d.get("kunci") or "")):
        return JSONResponse({"detail": "Only the person who shared this kit can change its logo."}, 403)

    data = str(d.get("data") or "")
    try:
        if not data:  # kembali ke logo asli
            await _lv._kv("DEL", KUNCI_LOGO + kit_id)
            await _lv._kv("HDEL", KUNCI_DAFTAR, kit_id)
            return JSONResponse({"ok": True, "logo": ""})
        if "," in data:
            data = data.split(",", 1)[1]
        mentah = base64.b64decode(data, validate=True)
    except Exception:
        return JSONResponse({"detail": "That image couldn't be read. Try a PNG or JPG."}, 400)
    if len(mentah) > MAKS_LOGO:
        return JSONResponse({"detail": "Logo is too big. Try a smaller image."}, 400)
    jenis = _jenis(mentah)
    if not jenis:
        return JSONResponse({"detail": "Use a PNG, JPG or WebP image."}, 400)

    versi = int(time.time())
    try:
        await _lv._kv("SET", KUNCI_LOGO + kit_id, json.dumps({"m": jenis, "b": base64.b64encode(mentah).decode(), "v": versi}))
        await _lv._kv("HSET", KUNCI_DAFTAR, kit_id, str(versi))
    except Exception:
        return JSONResponse({"detail": "Couldn't save right now. Try again in a moment."}, 503)
    return JSONResponse({"ok": True, "logo": f"/api/launch/logo/{kit_id}?v={versi}"})


# ---------------------------------------------------------------------------
# JAVASCRIPT tambahan: ganti gambar logo di galeri, dan editor logo di /k/<id>
# ---------------------------------------------------------------------------
JS_LOGO = r"""
(() => {
const baca = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || "null") ?? d; } catch (_) { return d; } };
let peta = {};
function ganti() {
  document.querySelectorAll('img[src*="/api/galeri/logo/"]').forEach((img) => {
    const m = img.getAttribute("src").match(/\/api\/galeri\/logo\/([A-Za-z0-9_-]+)/);
    if (m && peta[m[1]]) img.src = `/api/launch/logo/${m[1]}?v=${peta[m[1]]}`;
  });
}
fetch("/api/launch/logos").then((r) => r.json()).then((h) => {
  peta = h.logos || {}; if (!Object.keys(peta).length) return;
  ganti(); new MutationObserver(ganti).observe(document.body, { childList: true, subtree: true });
}).catch(() => {});

const P = window.__LP; if (!P) return;
const q = new URLSearchParams(location.search);
const milik = (baca("orynx_launch_keys", {}) || {})[P.id] || null;
if (!milik && !q.has("admin")) return;
const kotak = document.getElementById("lpEdit"); if (!kotak) return;
let kunci = "";
const blok = document.createElement("div");
blok.innerHTML = '<label>Logo</label><div class="lp-logo"><img id="lpLogoPrev" alt="Logo preview"><div>'
  + '<p class="lp-note">Have your own logo? Upload a PNG or JPG. It replaces the AI logo on this page and in the gallery.</p>'
  + '<div class="lp-acts" style="margin-top:10px"><label class="lp-btn" for="lpLogoFile" style="margin:0;color:#fff">Upload logo</label>'
  + '<button class="lp-btn" type="button" id="lpLogoReset">Use the AI logo</button></div>'
  + '<p class="lp-msg" id="lpLogoMsg"></p></div></div><input type="file" id="lpLogoFile" accept="image/png,image/jpeg,image/webp" hidden>';
const s = document.createElement("style");
s.textContent = ".lp-logo{display:flex;gap:16px;align-items:center}.lp-logo img{width:96px;height:96px;border-radius:26%;object-fit:cover;border:1px solid #2c2c2c;background:#111;flex:none}.lp-logo .lp-msg{margin-top:8px}";
document.head.append(s);
const judul = kotak.querySelector("label"); kotak.insertBefore(blok, judul);
const prev = document.getElementById("lpLogoPrev"), msg = document.getElementById("lpLogoMsg");
const logoKartu = document.querySelector(".card .logo img");
prev.src = logoKartu ? logoKartu.src : `/api/galeri/logo/${P.id}`;

function kecilkan(file) {
  return new Promise((ok, gagal) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const n = 512, c = document.createElement("canvas"); c.width = n; c.height = n;
      const x = c.getContext("2d"), sisi = Math.min(img.width, img.height);
      x.drawImage(img, (img.width - sisi) / 2, (img.height - sisi) / 2, sisi, sisi, 0, 0, n, n);
      URL.revokeObjectURL(url);
      let d = c.toDataURL("image/png");
      if (d.length > 480000) d = c.toDataURL("image/jpeg", 0.9);
      ok(d);
    };
    img.onerror = () => { URL.revokeObjectURL(url); gagal(new Error("That image couldn't be opened.")); };
    img.src = url;
  });
}
async function kirim(data) {
  const isi = { id: P.id, edit: milik ? milik.edit : "", data };
  if (!milik) { kunci = kunci || prompt("Admin key") || ""; isi.kunci = kunci; }
  const h = await fetch("/api/launch/logo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(isi) });
  const j = await h.json().catch(() => ({}));
  if (!h.ok) { if (h.status === 403) kunci = ""; throw new Error(j.detail || "Something went wrong. Try again."); }
  return j.logo;
}
document.getElementById("lpLogoFile").onchange = async (e) => {
  const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
  msg.style.color = "#aaa"; msg.textContent = "Uploading...";
  try {
    const url = await kirim(await kecilkan(f));
    prev.src = url; if (logoKartu) logoKartu.src = url;
    msg.style.color = "#bfe8c4"; msg.textContent = "Logo updated.";
  } catch (err) { msg.style.color = ""; msg.textContent = err.message; }
};
document.getElementById("lpLogoReset").onclick = async () => {
  msg.style.color = "#aaa"; msg.textContent = "Saving...";
  try {
    await kirim("");
    const asli = `/api/galeri/logo/${P.id}?r=${Date.now()}`;
    prev.src = asli; if (logoKartu) logoKartu.src = asli;
    msg.style.color = "#bfe8c4"; msg.textContent = "Back to the AI logo.";
  } catch (err) { msg.style.color = ""; msg.textContent = err.message; }
};
})();
"""

_lv.VERSI_JS = "3"
_lv.JS = _lv.JS + JS_LOGO


def _pasang_logo(app):
    @app.middleware("http")
    async def logo_sendiri(request: Request, call_next):
        path = request.url.path
        metode = request.method

        if path == "/api/launch/logo" and metode == "POST":
            return await _simpan_logo(request)
        if path == "/api/launch/logos" and metode == "GET":
            return JSONResponse({"logos": await _daftar_logo()}, headers={"Cache-Control": "public, max-age=60"})

        m = RE_LOGO_SENDIRI.fullmatch(path) if metode == "GET" else None
        if m:
            hasil = await _ambil_logo(m.group(1))
            if not hasil:
                return Response(status_code=404)
            return Response(hasil[1], media_type=hasil[0], headers={"Cache-Control": "public, max-age=31536000, immutable"})

        m = RE_LOGO_GALERI.fullmatch(path) if metode == "GET" else None
        if m:
            hasil = await _ambil_logo(m.group(1))
            if hasil:
                return Response(hasil[1], media_type=hasil[0], headers={"Cache-Control": "public, max-age=300"})

        resp = await call_next(request)
        if (resp.status_code != 200 or metode != "GET" or resp.headers.get("content-encoding")
                or "html" not in resp.headers.get("content-type", "")):
            return resp
        if not (path in ("/", "/index.html") or _lv.RE_KIT.fullmatch(path)):
            return resp
        body = await _lv._baca_body(resp)
        try:
            body = body.replace(b"/launch.js?v=2", b"/launch.js?v=3").replace(b"/launch.js?v=1", b"/launch.js?v=3")
            mk = _lv.RE_KIT.fullmatch(path)
            if mk:
                hasil = await _ambil_logo(mk.group(1))
                if hasil:
                    lama = f"/api/galeri/logo/{mk.group(1)}\"".encode()
                    baru = f"/api/launch/logo/{mk.group(1)}?v={hasil[2]}\"".encode()
                    body = body.replace(lama, baru)
        except Exception:
            pass
        return _lv._respon_baru(resp, body)


def pasang(app, g):
    hasil = _pm.pasang(app, g)
    try:
        _pasang_logo(app)
    except Exception:
        pass
    return hasil
