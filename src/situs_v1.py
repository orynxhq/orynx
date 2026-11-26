"""
Fitur Orynx (pintu masuk).
- fitur_lama.py : burn tracker, referral, remix, launch thread
- launch_v1.py  : launch page /k/<id>
- pamer_v1.py   : bagian pamer launch page di halaman utama
- logo_v1.py    : logo sendiri untuk launch page
- file ini      : logo sendiri juga dipakai di mini website /s/<slug>
Dipasang dari app.py lewat pasang(app, globals()), sama seperti sebelumnya.
"""

import re

from fastapi import Request
from fastapi.responses import Response

import launch_v1 as _lv
import logo_v1 as _lg
from logo_v1 import *  # noqa: F401,F403


def __getattr__(nama):
    return getattr(_lg, nama)


RE_SITUS = re.compile(r"/s/([A-Za-z0-9_-]{2,60})/?")
RE_SITUS_LOGO = re.compile(r"/s/([A-Za-z0-9_-]{2,60})/logo\.png")
RE_CA_HTML = re.compile(r'<code id="ca">(0x[0-9a-fA-F]{40})</code>')
KUNCI_SITUS = "orynx:launch:situs:"


async def _kit_untuk_ca(ca: str):
    """Cari kit yang punya logo sendiri dan CA yang sama dengan mini website."""
    ca = ca.lower()
    for kit_id in (await _lg._daftar_logo()).keys():
        r = await _lv._ambil(kit_id)
        if r and r.get("ca") == ca:
            return kit_id
    return None


def _pasang_situs(app):
    @app.middleware("http")
    async def logo_situs(request: Request, call_next):
        path = request.url.path
        if request.method == "GET":
            m = RE_SITUS_LOGO.fullmatch(path)
            if m:
                try:
                    kit_id = await _lv._kv("GET", KUNCI_SITUS + m.group(1))
                    hasil = await _lg._ambil_logo(kit_id) if kit_id else None
                except Exception:
                    hasil = None
                if hasil:
                    return Response(hasil[1], media_type=hasil[0], headers={"Cache-Control": "public, max-age=300"})

        resp = await call_next(request)
        m = RE_SITUS.fullmatch(path) if request.method == "GET" else None
        if (not m or resp.status_code != 200 or resp.headers.get("content-encoding")
                or "html" not in resp.headers.get("content-type", "")):
            return resp
        body = await _lv._baca_body(resp)
        try:
            teks = body.decode("utf-8")
            mc = RE_CA_HTML.search(teks)
            kit_id = await _kit_untuk_ca(mc.group(1)) if mc else None
            if kit_id:
                hasil = await _lg._ambil_logo(kit_id)
                if hasil:
                    slug = m.group(1)
                    await _lv._kv("SET", KUNCI_SITUS + slug, kit_id)
                    baru = f"/api/launch/logo/{kit_id}?v={hasil[2]}"
                    teks = teks.replace(f"/s/{slug}/logo.png", baru)
                    body = teks.encode()
        except Exception:
            pass
        return _lv._respon_baru(resp, body)


def pasang(app, g):
    hasil = _lg.pasang(app, g)
    try:
        _pasang_situs(app)
    except Exception:
        pass
    return hasil
