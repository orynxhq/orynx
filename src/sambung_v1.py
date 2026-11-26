"""
Fitur Orynx (pintu masuk).
- fitur_lama.py : burn tracker, referral, remix, launch thread
- launch_v1.py  : launch page /k/<id>
- pamer_v1.py   : bagian pamer launch page di halaman utama
- logo_v1.py    : logo sendiri untuk launch page
- situs_v1.py   : logo sendiri juga dipakai di mini website /s/<slug>
- file ini      : sambungkan launch page /k/ dengan mini website /s/ (lewat CA yang sama)
Dipasang dari app.py lewat pasang(app, globals()), sama seperti sebelumnya.
"""

import re

from fastapi import Request
from fastapi.responses import JSONResponse

import launch_v1 as _lv
import situs_v1 as _st
from situs_v1 import *  # noqa: F401,F403


def __getattr__(nama):
    return getattr(_st, nama)


PETA = "orynx:launch:situsmap"      # hash: kit_id -> slug mini website
PETA_SLUG = "orynx:launch:slugmap"  # hash: slug -> kit_id


async def _cari_kit_ca(ca: str):
    ca = ca.lower()
    try:
        ids = await _lv._kv("SMEMBERS", _lv.SET_LIVE) or []
    except Exception:
        ids = []
    for kit_id in ids:
        r = await _lv._ambil(kit_id)
        if r and r.get("ca") == ca:
            return kit_id
    return None


async def _peta():
    try:
        isi = await _lv._kv("HGETALL", PETA) or []
        return {isi[i]: isi[i + 1] for i in range(0, len(isi) - 1, 2)}
    except Exception:
        return {}


JS_SITUS = r"""
(() => {
fetch("/api/launch/situs").then((r) => r.json()).then((h) => {
  const peta = h.situs || {}; if (!Object.keys(peta).length) return;
  const ganti = () => document.querySelectorAll('a.lps-card[href^="/k/"]').forEach((a) => {
    const id = a.getAttribute("href").slice(3); if (peta[id]) a.href = `/s/${peta[id]}`;
  });
  ganti(); new MutationObserver(ganti).observe(document.body, { childList: true, subtree: true });
}).catch(() => {});
})();
"""

_lv.VERSI_JS = "4"
_lv.JS = _lv.JS + JS_SITUS


def _pasang_sambung(app):
    @app.middleware("http")
    async def sambung_situs(request: Request, call_next):
        path = request.url.path
        if path == "/api/launch/situs" and request.method == "GET":
            return JSONResponse({"situs": await _peta()}, headers={"Cache-Control": "public, max-age=60"})

        resp = await call_next(request)
        if (request.method != "GET" or resp.status_code != 200 or resp.headers.get("content-encoding")
                or "html" not in resp.headers.get("content-type", "")):
            return resp

        ms = _st.RE_SITUS.fullmatch(path)
        mk = _lv.RE_KIT.fullmatch(path)
        dihome = path in ("/", "/index.html")
        if not (ms or mk or dihome):
            return resp
        body = await _lv._baca_body(resp)
        try:
            if dihome:
                body = body.replace(b"/launch.js?v=3", b"/launch.js?v=4")
                # beri jarak antara kartu galeri dan garis bagian launch page
                body = body.replace(b'<section class="band lps"',
                                    b'<style>#launchpage{margin-top:clamp(40px,6vw,72px)}</style><section class="band lps"', 1)
            elif ms:
                # catat pasangan mini website <-> launch page lewat CA yang sama
                slug = ms.group(1)
                if not await _lv._kv("HGET", PETA_SLUG, slug):
                    mc = _st.RE_CA_HTML.search(body.decode("utf-8", "ignore"))
                    kit_id = await _cari_kit_ca(mc.group(1)) if mc else None
                    if kit_id:
                        await _lv._kv("HSET", PETA, kit_id, slug)
                        await _lv._kv("HSET", PETA_SLUG, slug, kit_id)
            elif mk:
                body = body.replace(b"/launch.js?v=3", b"/launch.js?v=4")
                slug = await _lv._kv("HGET", PETA, mk.group(1))
                if slug and re.fullmatch(r"[A-Za-z0-9_-]{2,60}", slug):
                    tombol = (f'<a class="pill line" href="/s/{slug}">Open mini website</a>').encode()
                    body = body.replace(b'rel="noopener">View on explorer</a>',
                                        b'rel="noopener">View on explorer</a>' + tombol, 1)
        except Exception:
            pass
        return _lv._respon_baru(resp, body)


def pasang(app, g):
    hasil = _st.pasang(app, g)
    try:
        _pasang_sambung(app)
    except Exception:
        pass
    return hasil
