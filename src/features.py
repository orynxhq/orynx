"""
Orynx features (entry point).

Feature modules are stacked in layers; each one imports the previous layer
and its install() calls the previous install() before adding its own routes:
- features_core.py : burn tracker, referral, remix, launch thread, mini website
- launch_page.py   : launch page on /k/<id>
- showcase.py      : launch page showcase on the home page
- custom_logo.py   : upload your own logo for a launch page
- site_logo.py     : the custom logo is also used on the mini website /s/<slug>
- site_link.py     : links the /k/ launch page with the /s/ mini website
- features.py      : entry point, HEY Research ownership verification + GitHub footer link
Installed from app.py via install(app, globals()).
"""

import html
import json
import os
import time

from fastapi import Request
from fastapi.responses import JSONResponse, Response

import launch_page as _lv
import site_link as _sb
from site_link import *  # noqa: F401,F403


def __getattr__(name):
    return getattr(_sb, name)


HEY_VERIFY = os.getenv("HEY_VERIFY", "GACtc2EmGsRu3f36kU3SIiN6GX1iHeFg").strip()
GITHUB_URL = os.getenv("GITHUB_URL", "https://github.com/orynxhq/orynx").strip()


def _install_hey(app):
    @app.middleware("http")
    async def hey_verify(request: Request, call_next):
        path = request.url.path
        if path == "/.well-known/hey-research.txt" and request.method in ("GET", "HEAD") and HEY_VERIFY:
            return Response(HEY_VERIFY, media_type="text/plain; charset=utf-8", headers={"Cache-Control": "no-store"})

        resp = await call_next(request)
        if (path not in ("/", "/index.html") or request.method != "GET" or resp.status_code != 200 or not HEY_VERIFY
                or resp.headers.get("content-encoding") or "html" not in resp.headers.get("content-type", "")):
            return resp
        body = await _lv._read_body(resp)
        try:
            if b"hey-research-verification" not in body:
                tag = f'<meta name="hey-research-verification" content="{html.escape(HEY_VERIFY, quote=True)}">\n'.encode()
                body = body.replace(b"</head>", tag + b"</head>", 1)
            if GITHUB_URL and GITHUB_URL.encode() not in body:
                # link to the source code in the footer (Community column)
                old = b'rel="noopener">Launch on pons</a></nav>'
                fresh = f'rel="noopener">Launch on pons</a><a href="{GITHUB_URL}" target="_blank" rel="noopener">GitHub</a></nav>'.encode()
                body = body.replace(old, fresh, 1)
        except Exception:
            pass
        return _lv._response_new(resp, body)


STORAGE_MAP_KEY = "orynx:storage:map"
_storage_map: list = [None, 0.0]


def _install_storage(app, g):
    """Old -> new field names for data saved in browsers by older versions (see static/upgrade.js)."""

    @app.get("/upgrade.js", include_in_schema=False)
    async def upgrade_js():
        return g["_static"]("upgrade.js", "application/javascript; charset=utf-8")

    @app.get("/api/storage-map", include_in_schema=False)
    async def storage_map():
        if _storage_map[0] is None or time.time() - _storage_map[1] > 600:
            try:
                raw = await _lv._kv("GET", STORAGE_MAP_KEY)
                _storage_map[0], _storage_map[1] = (json.loads(raw) if raw else {}), time.time()
            except Exception:
                return JSONResponse({"map": {}}, headers={"Cache-Control": "no-store"})
        return JSONResponse({"map": _storage_map[0]}, headers={"Cache-Control": "public, max-age=600"})


BURN_PAGE = """<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<title>$ORYNX burn tracker · Orynx</title>
<meta name="description" content="Every $ORYNX burn, read live from the dead address on Robinhood Chain.">
<meta property="og:type" content="website"><meta property="og:url" content="https://orynxai.xyz/burn">
<meta property="og:title" content="$ORYNX burn tracker"><meta property="og:description" content="Every $ORYNX burn, read live from the dead address on Robinhood Chain.">
<meta property="og:image" content="https://orynxai.xyz/og.png"><meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@orynxhq"><meta name="twitter:title" content="$ORYNX burn tracker">
<meta name="twitter:description" content="Every $ORYNX burn, read live from the dead address on Robinhood Chain."><meta name="twitter:image" content="https://orynxai.xyz/og.png">
<meta http-equiv="refresh" content="0;url=/#burn"><link rel="canonical" href="https://orynxai.xyz/burn">
</head><body style="background:#000;color:#fff;font-family:system-ui"><p><a href="/#burn" style="color:#fff">Open the $ORYNX burn tracker</a></p>
<script>location.replace("/#burn")</script></body></html>"""


def install(app, g):
    result = _sb.install(app, g)

    @app.get("/burn", include_in_schema=False)
    async def burn_page():
        return Response(BURN_PAGE, media_type="text/html; charset=utf-8", headers={"Cache-Control": "public, max-age=300"})

    try:
        _install_storage(app, g)
    except Exception:
        pass
    try:
        _install_hey(app)
    except Exception:
        pass
    return result
