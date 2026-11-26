"""
Fitur Orynx (pintu masuk).
- fitur_lama.py  : burn tracker, referral, remix, launch thread
- launch_v1.py   : launch page /k/<id>
- pamer_v1.py    : bagian pamer launch page di halaman utama
- logo_v1.py     : logo sendiri untuk launch page
- situs_v1.py    : logo sendiri juga dipakai di mini website /s/<slug>
- sambung_v1.py  : sambungkan launch page /k/ dengan mini website /s/
- file ini       : verifikasi kepemilikan untuk HEY Research (heyresearch.xyz) + link GitHub di footer
Dipasang dari app.py lewat pasang(app, globals()), sama seperti sebelumnya.
"""

import html
import os

from fastapi import Request
from fastapi.responses import Response

import launch_v1 as _lv
import sambung_v1 as _sb
from sambung_v1 import *  # noqa: F401,F403


def __getattr__(nama):
    return getattr(_sb, nama)


HEY_VERIFY = os.getenv("HEY_VERIFY", "GACtc2EmGsRu3f36kU3SIiN6GX1iHeFg").strip()
GITHUB_URL = os.getenv("GITHUB_URL", "https://github.com/orynxhq/orynx").strip()


def _pasang_hey(app):
    @app.middleware("http")
    async def hey_verifikasi(request: Request, call_next):
        path = request.url.path
        if path == "/.well-known/hey-research.txt" and request.method in ("GET", "HEAD") and HEY_VERIFY:
            return Response(HEY_VERIFY, media_type="text/plain; charset=utf-8", headers={"Cache-Control": "no-store"})

        resp = await call_next(request)
        if (path not in ("/", "/index.html") or request.method != "GET" or resp.status_code != 200 or not HEY_VERIFY
                or resp.headers.get("content-encoding") or "html" not in resp.headers.get("content-type", "")):
            return resp
        body = await _lv._baca_body(resp)
        try:
            if b"hey-research-verification" not in body:
                tag = f'<meta name="hey-research-verification" content="{html.escape(HEY_VERIFY, quote=True)}">\n'.encode()
                body = body.replace(b"</head>", tag + b"</head>", 1)
            if GITHUB_URL and GITHUB_URL.encode() not in body:
                # link ke source code di footer (kolom Community)
                lama = b'rel="noopener">Launch on pons</a></nav>'
                baru = f'rel="noopener">Launch on pons</a><a href="{GITHUB_URL}" target="_blank" rel="noopener">GitHub</a></nav>'.encode()
                body = body.replace(lama, baru, 1)
        except Exception:
            pass
        return _lv._respon_baru(resp, body)


def pasang(app, g):
    hasil = _sb.pasang(app, g)
    try:
        _pasang_hey(app)
    except Exception:
        pass
    return hasil
