"""
Site link layer: connects the /k/ launch page with the /s/ mini website (matched by CA).
"""

import re

from fastapi import Request
from fastapi.responses import JSONResponse

import launch_page as _lv
import site_logo as _st
from site_logo import *  # noqa: F401,F403


def __getattr__(name):
    return getattr(_st, name)


MAP = "orynx:launch:sitemap"      # hash: kit_id -> mini website slug
MAP_SLUG = "orynx:launch:slugmap"  # hash: slug -> kit_id


async def _find_kit_ca(ca: str):
    ca = ca.lower()
    try:
        ids = await _lv._kv("SMEMBERS", _lv.SET_LIVE) or []
    except Exception:
        ids = []
    for kit_id in ids:
        r = await _lv._get(kit_id)
        if r and r.get("ca") == ca:
            return kit_id
    return None


async def _map():
    try:
        fill = await _lv._kv("HGETALL", MAP) or []
        return {fill[i]: fill[i + 1] for i in range(0, len(fill) - 1, 2)}
    except Exception:
        return {}


JS_SITE = r"""
(() => {
fetch("/api/launch/site").then((r) => r.json()).then((h) => {
  const lookup = h.site || {}; if (!Object.keys(lookup).length) return;
  const swap = () => document.querySelectorAll('a.lps-card[href^="/k/"]').forEach((a) => {
    const id = a.getAttribute("href").slice(3); if (lookup[id]) a.href = `/s/${lookup[id]}`;
  });
  swap(); new MutationObserver(swap).observe(document.body, { childList: true, subtree: true });
}).catch(() => {});
})();
"""

_lv.VERSION_JS = "5"
_lv.JS = _lv.JS + JS_SITE


def _install_link(app):
    @app.middleware("http")
    async def link_site(request: Request, call_next):
        path = request.url.path
        if path == "/api/launch/site" and request.method == "GET":
            return JSONResponse({"site": await _map()}, headers={"Cache-Control": "public, max-age=60"})

        resp = await call_next(request)
        if (request.method != "GET" or resp.status_code != 200 or resp.headers.get("content-encoding")
                or "html" not in resp.headers.get("content-type", "")):
            return resp

        ms = _st.RE_SITE.fullmatch(path)
        mk = _lv.RE_KIT.fullmatch(path)
        onHome = path in ("/", "/index.html")
        if not (ms or mk or onHome):
            return resp
        body = await _lv._read_body(resp)
        try:
            if onHome:
                body = body.replace(b"/launch.js?v=3", b"/launch.js?v=5")
                # add space between the gallery cards and the launch page section line
                body = body.replace(b'<section class="band lps"',
                                    b'<style>#launchpage{margin-top:clamp(40px,6vw,72px)}</style><section class="band lps"', 1)
            elif ms:
                # record mini website <-> launch page pairs via the same CA
                slug = ms.group(1)
                if not await _lv._kv("HGET", MAP_SLUG, slug):
                    mc = _st.RE_CA_HTML.search(body.decode("utf-8", "ignore"))
                    kit_id = await _find_kit_ca(mc.group(1)) if mc else None
                    if kit_id:
                        await _lv._kv("HSET", MAP, kit_id, slug)
                        await _lv._kv("HSET", MAP_SLUG, slug, kit_id)
            elif mk:
                body = body.replace(b"/launch.js?v=3", b"/launch.js?v=5")
                slug = await _lv._kv("HGET", MAP, mk.group(1))
                if slug and re.fullmatch(r"[A-Za-z0-9_-]{2,60}", slug):
                    button = (f'<a class="pill line" href="/s/{slug}">Open mini website</a>').encode()
                    body = body.replace(b'rel="noopener">View on explorer</a>',
                                        b'rel="noopener">View on explorer</a>' + button, 1)
        except Exception:
            pass
        return _lv._response_new(resp, body)


def install(app, g):
    result = _st.install(app, g)
    try:
        _install_link(app)
    except Exception:
        pass
    return result
