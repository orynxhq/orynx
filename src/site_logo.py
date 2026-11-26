"""
Site logo layer: a custom launch page logo is also used on the mini website /s/<slug>.
"""

import re

from fastapi import Request
from fastapi.responses import Response

import launch_page as _lv
import custom_logo as _lg
from custom_logo import *  # noqa: F401,F403


def __getattr__(name):
    return getattr(_lg, name)


RE_SITE = re.compile(r"/s/([A-Za-z0-9_-]{2,60})/?")
RE_SITE_LOGO = re.compile(r"/s/([A-Za-z0-9_-]{2,60})/logo\.png")
RE_CA_HTML = re.compile(r'<code id="ca">(0x[0-9a-fA-F]{40})</code>')
KEY_SITE = "orynx:launch:site:"


async def _kit_for_ca(ca: str):
    """Find a kit that has its own logo and the same CA as the mini website."""
    ca = ca.lower()
    for kit_id in (await _lg._list_logo()).keys():
        r = await _lv._get(kit_id)
        if r and r.get("ca") == ca:
            return kit_id
    return None


def _install_site(app):
    @app.middleware("http")
    async def logo_site(request: Request, call_next):
        path = request.url.path
        if request.method == "GET":
            m = RE_SITE_LOGO.fullmatch(path)
            if m:
                try:
                    kit_id = await _lv._kv("GET", KEY_SITE + m.group(1))
                    result = await _lg._get_logo(kit_id) if kit_id else None
                except Exception:
                    result = None
                if result:
                    return Response(result[1], media_type=result[0], headers={"Cache-Control": "public, max-age=300"})

        resp = await call_next(request)
        m = RE_SITE.fullmatch(path) if request.method == "GET" else None
        if (not m or resp.status_code != 200 or resp.headers.get("content-encoding")
                or "html" not in resp.headers.get("content-type", "")):
            return resp
        body = await _lv._read_body(resp)
        try:
            text = body.decode("utf-8")
            mc = RE_CA_HTML.search(text)
            kit_id = await _kit_for_ca(mc.group(1)) if mc else None
            if kit_id:
                result = await _lg._get_logo(kit_id)
                if result:
                    slug = m.group(1)
                    await _lv._kv("SET", KEY_SITE + slug, kit_id)
                    fresh = f"/api/launch/logo/{kit_id}?v={result[2]}"
                    text = text.replace(f"/s/{slug}/logo.png", fresh)
                    body = text.encode()
        except Exception:
            pass
        return _lv._response_new(resp, body)


def install(app, g):
    result = _lg.install(app, g)
    try:
        _install_site(app)
    except Exception:
        pass
    return result
