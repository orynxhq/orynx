"""
Orynx core features: burn tracker, referral, remix, launch thread, holders feed,
kit of the day, early access badge and the mini website (/s/<slug>).
Installed from app.py via install(app, globals()).
"""

import asyncio
import hashlib
import hmac
import json

import httpx
import re
import time

from fastapi import HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field

DEAD = "0x000000000000000000000000000000000000dead"
TOPIC_TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"

# Confirmed burns (used when the RPC cannot read the history)
BURN_RECORDED = [
    {"tx": "0x363e8db50cea756a32fd646d5b58408e82a8429063bd721a0d90cf814c995bce", "count": 3_000_000, "time": 1795621620},
]

SCHEMA_THREAD = {
    "type": "object",
    "properties": {"thread": {"type": "array", "items": {"type": "string"}}},
    "required": ["thread"],
}

TASK_THREAD = """Write a 5-post launch-day thread for X and put it in "thread" (exactly 5 strings):
1. The launch announcement: a scroll-stopping hook, the $TICKER, and that it is live on pons, Robinhood Chain.
2. The story: what it is or the meme's lore, told so people want to be part of it.
3. How to get it: search the ticker on pons (ponsfamily.com) on Robinhood Chain. No price talk.
4. The contract address post: use the exact placeholder [CA] where the address goes, plus a line telling people to only trust this address.
5. The community call: follow, join the Telegram, and one question people want to answer.
Each post under 260 characters, max 1 emoji, no hashtags. Never promise profits, returns or price moves.
Deliver it by calling the send_thread tool."""


class ThreadRequest(BaseModel):
    mode: str = "ai"
    sig: str = Field(min_length=10, max_length=64)
    name: str = Field(default="", max_length=60)
    ticker: str = Field(default="", max_length=8)
    tagline: str = Field(default="", max_length=120)
    roast: str = Field(default="", max_length=2000)
    description: str = Field(default="", max_length=1500)
    features: list[str] = Field(default_factory=list, max_length=3)


class RefRequest(BaseModel):
    ref: str = Field(min_length=3, max_length=20)


class BurnRequest(BaseModel):
    tx: str = Field(pattern=r"^0x[0-9a-fA-F]{64}$")
    count: float = Field(gt=0)
    key: str = Field(min_length=8, max_length=200)


def tidy_ref(text: str) -> str:
    return re.sub(r"[^a-z0-9_]", "", (text or "").lower().lstrip("@"))[:20]


def install(app, g):
    _redis = g["_redis"]
    _rpc = g["_rpc"]
    log = g["log"]
    _cache: dict = {}

    PONS_V2 = "0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e"
    PONS_V1 = "0xa5aab3f0c6eeadf30ef1d3eb997108e976351feb"
    T_LAUNCH = "0x8d4aad4953d0ca700d468f3753aa14432d1b35b43ec6409f051fb6aa43a89607"
    T_GRAD = "0x0a44ef75df69c534f43cd6c1aa3ef8983065fe5fe79ef9e79f6494e6f258c259"
    T_SWEPT = "0xcdb72f157fd3666758a6ce201387ffb52038c7562e4fff352828da1096c4b6b4"
    SEL_STATUS = "0x98d652f1"

    def _pad(address: str) -> str:
        return "0x" + address.lower()[2:].rjust(64, "0")

    def _word(hexdata: str, i: int) -> int:
        h = hexdata[2:]
        return int(h[i * 64:(i + 1) * 64] or "0", 16)

    WIDTH = 9_000_000

    async def _block_latest() -> int:
        return int(await _rpc("eth_blockNumber", []), 16)

    async def _log_window(address: str, topic: list, sender: int, until: int | None = None) -> list:
        if until is None:
            until = await _block_latest()
        result, a = [], max(0, sender)
        while a <= until:
            b = min(until, a + WIDTH - 1)
            result += await _rpc("eth_getLogs", [{"fromBlock": hex(a), "toBlock": hex(b), "address": address, "topics": topic}]) or []
            a = b + 1
        return result

    async def _info_launch(token: str | None = None) -> dict | None:
        """Find the pons V2 TokenLaunched event for a token, walking back one block window at a time. The result is stored permanently."""
        token = (token or g["ORYNX_TOKEN"]).lower()
        kc = "launch:" + token
        if _cache.get(kc):
            return _cache[kc]
        try:
            old = await _redis("GET", "orynx:launched:" + token)
            if old:
                _cache[kc] = json.loads(old)
                return _cache[kc]
        except Exception:
            pass
        if time.time() - _cache.get("failed:" + token, 0) < 600:
            return None
        end = await _block_latest()
        for _ in range(16):
            start = max(0, end - WIDTH + 1)
            logs = await _rpc("eth_getLogs", [{"fromBlock": hex(start), "toBlock": hex(end), "address": PONS_V2,
                                              "topics": [T_LAUNCH, _pad(token)]}]) or []
            if logs:
                lg = logs[0]
                info = {"block": int(lg["blockNumber"], 16), "curve": "0x" + lg["topics"][2][-40:],
                        "pair": "0x" + lg["data"][2:66][-40:], "threshold": _word(lg["data"], 2)}
                _cache[kc] = info
                try:
                    await _redis("SET", "orynx:launched:" + token, json.dumps(info))
                except Exception:
                    pass
                return info
            if start == 0:
                break
            end = start - 1
        _cache["failed:" + token] = time.time()
        return None

    # ------------------------------------------------------------------ burn
    async def _decimals() -> int:
        if "des" not in _cache:
            result = await _rpc("eth_call", [{"to": g["ORYNX_TOKEN"], "data": "0x313ce567"}, "latest"])
            _cache["des"] = int(result, 16) if result not in ("0x", "") else 18
        return _cache["des"]

    async def _history_burn(des: int) -> list[dict]:
        try:
            launch = await _info_launch()
            sender = launch["block"] if launch else max(0, await _block_latest() - WIDTH + 1)
            logs = await _log_window(g["ORYNX_TOKEN"], [TOPIC_TRANSFER, None, "0x" + DEAD[2:].rjust(64, "0")], sender)
            result = []
            for lg in logs[-30:]:
                count = int(lg.get("data", "0x0"), 16) / 10 ** des
                time = 0
                try:
                    block = await _rpc("eth_getBlockByNumber", [lg["blockNumber"], False])
                    time = int(block["timestamp"], 16)
                except Exception:
                    pass
                result.append({"tx": lg["transactionHash"], "count": count, "time": time})
            if result:
                return list(reversed(result))
        except Exception as err:
            log.warning("Burn history from RPC failed: %s", err)
        recorded = list(BURN_RECORDED)
        try:
            for row in await _redis("LRANGE", "orynx:burns", "0", "49") or []:
                recorded.append(json.loads(row))
        except Exception:
            pass
        unique = {b["tx"].lower(): b for b in recorded}
        return sorted(unique.values(), key=lambda b: -b.get("time", 0))

    @app.get("/api/burn")
    async def info_burn():
        if not g["GATING_ACTIVE"]:
            return {"active": False}
        save = _cache.get("burn")
        if save and time.time() - save[1] < 120:
            return save[0]
        try:
            des = await _decimals()
            data = "0x70a08231" + DEAD[2:].rjust(64, "0")
            off = int(await _rpc("eth_call", [{"to": g["ORYNX_TOKEN"], "data": data}, "latest"]) or "0x0", 16) / 10 ** des
            supply = int(await _rpc("eth_call", [{"to": g["ORYNX_TOKEN"], "data": "0x18160ddd"}, "latest"]) or "0x0", 16) / 10 ** des
            records = await _history_burn(des)
        except Exception as err:
            log.warning("Burn info failed: %s", err)
            if save:
                return save[0]
            raise HTTPException(502, "Couldn't read the chain right now.")
        result = {"active": True, "burned": off, "supply": supply, "percent": (off / supply * 100) if supply else 0,
                 "dead": DEAD, "token": g["ORYNX_TOKEN"], "records": records[:20]}
        _cache["burn"] = (result, time.time())
        return result

    @app.post("/api/burn/add")
    async def add_burn(data: BurnRequest):
        key = g["ADMIN_KEY"]
        if not key or not hmac.compare_digest(data.key, key):
            raise HTTPException(403, "Not allowed.")
        await _redis("LPUSH", "orynx:burns", json.dumps({"tx": data.tx.lower(), "count": data.count, "time": int(time.time())}))
        _cache.pop("burn", None)
        return {"ok": True}

    # -------------------------------------------------------------- referral
    @app.post("/api/ref/hit")
    async def ref_hit(data: RefRequest, request: Request):
        ref = tidy_ref(data.ref)
        if len(ref) < 3 or not (g["REDIS_URL"] and g["REDIS_TOKEN"]):
            return {"ok": False}
        who = hashlib.sha256(("ref:" + g["id_visitor"](request)).encode()).hexdigest()[:20]
        try:
            fresh = await _redis("SET", f"orynx:refseen:{who}", ref, "NX", "EX", "2592000")
            if fresh is None:
                return {"ok": True, "fresh": False}
            week = f"orynx:ref:{g['this_week']()}"
            await _redis("ZINCRBY", week, "1", ref)
            await _redis("EXPIRE", week, "1814400")
            await _redis("ZINCRBY", "orynx:ref:all", "1", ref)
        except Exception as err:
            log.warning("Referral failed: %s", err)
            return {"ok": False}
        _cache.pop("reftop", None)
        return {"ok": True, "fresh": True}

    @app.get("/api/ref/top")
    async def ref_top(mine: str = ""):
        if not (g["REDIS_URL"] and g["REDIS_TOKEN"]):
            return {"active": False, "top": []}
        save = _cache.get("reftop")
        if save and time.time() - save[1] < 30:
            top = save[0]
        else:
            try:
                raw = await _redis("ZREVRANGE", f"orynx:ref:{g['this_week']()}", "0", "9", "WITHSCORES") or []
                top = [{"ref": raw[i], "count": int(float(raw[i + 1]))} for i in range(0, len(raw), 2)]
            except Exception:
                top = []
            _cache["reftop"] = (top, time.time())
        result = {"active": True, "top": top}
        mine = tidy_ref(mine)
        if len(mine) >= 3:
            try:
                n = await _redis("ZSCORE", f"orynx:ref:{g['this_week']()}", mine)
                total = await _redis("ZSCORE", "orynx:ref:all", mine)
                result["mine"] = {"ref": mine, "week": int(float(n or 0)), "total": int(float(total or 0))}
            except Exception:
                pass
        return result

    # ----------------------------------------------------------------- remix
    @app.get("/api/item/{id_item}")
    async def item(id_item: str):
        it = await g["get_item"](id_item)
        if not it:
            raise HTTPException(404, "Not found")
        return it

    # ---------------------------------------------------------- launch thread
    @app.post("/api/thread")
    async def thread(data: ThreadRequest, request: Request):
        client = g["client_ai"]
        if not client:
            raise HTTPException(503, "Orynx isn't switched on yet. Please check back soon.")
        mode = "meme" if data.mode == "meme" else "ai"
        if not hmac.compare_digest(g["sign_content"]("kit", data.name, data.ticker, data.tagline, data.roast, mode), data.sig):
            raise HTTPException(400, "Build a kit on Orynx first, then write its launch thread.")
        who, holder = await g["who_and_holder"](request)
        g["check_limit"](who, "redo", holder)
        context = json.dumps({"name": data.name, "ticker": data.ticker, "tagline": data.tagline,
                              "description": data.description, "points": data.features}, ensure_ascii=False)
        rules = g["RULES_TEXT_MEME"] if mode == "meme" else g["RULES_TEXT"]
        system = g["PERSONA"] + "\n\n" + rules + "\n\nRight now you are writing the LAUNCH-DAY THREAD for an existing kit, in the same voice."
        result = None
        for _ in range(2):
            try:
                response = await client.messages.create(
                    model=g["MODEL_TEXT"], max_tokens=1500, system=system,
                    messages=[{"role": "user", "content": f"Kit: {context}\n\n{TASK_THREAD}"}],
                    tools=[{"name": "send_thread", "description": "Return the 5-post thread.", "input_schema": SCHEMA_THREAD}],
                    tool_choice={"type": "auto"},
                )
                for b in response.content:
                    if b.type == "tool_use" and isinstance(b.input, dict):
                        result = b.input.get("thread")
                if not result:
                    result = g["get_json"]("".join(b.text for b in response.content if b.type == "text")).get("thread")
                result = [str(x).strip() for x in (result or []) if str(x).strip()][:5]
                if len(result) >= 3:
                    break
                result = None
            except Exception as err:
                log.warning("Thread failed: %s", err)
                result = None
        if not result:
            raise HTTPException(502, "Si Dev drew a blank. Try again (this didn't use your quota).")
        g["add_usage"](who, "redo")
        return {"thread": result, "left": max(0, g["limit_redo"](holder) - g["usage"](who, "redo"))}

    # ------------------------------------------------------------- bonding
    async def _log_pons(topic: str, token: str, sender: int) -> list:
        return await _log_window(PONS_V2, [topic, _pad(token)], sender)

    async def _bonding_v2(token: str, note: list) -> dict | None:
        info = await _info_launch(token)
        if not info:
            note.append("v2: no TokenLaunched log")
            return None
        curve = info["curve"]
        if token.lower() == g["ORYNX_TOKEN"].lower():
            curve = g["os"].getenv("ORYNX_CURVE", "").strip().lower() or curve
        graduated = bool(_cache.get("graduated:" + token.lower()))
        if not graduated:
            try:
                graduated = bool(await _log_pons(T_SWEPT, token, info["block"])) or bool(await _log_pons(T_GRAD, token, info["block"]))
                if graduated:
                    _cache["graduated:" + token.lower()] = True
            except Exception as err:
                note.append(f"v2 grad check: {err}"[:200])
        if int(info["pair"], 16) == 0:
            current = int(await _rpc("eth_getBalance", [curve, "latest"]), 16)
        else:
            current = int(await _rpc("eth_call", [{"to": info["pair"], "data": "0x70a08231" + _pad(curve)[2:]}, "latest"]) or "0x0", 16)
        return {"version": 2, "current": current / 1e18, "threshold": info["threshold"] / 1e18, "graduated": graduated,
                "curve": curve, "pair": info["pair"]}

    async def _bonding_status(factory: str, token: str, version: int) -> dict | None:
        result = await _rpc("eth_call", [{"to": factory, "data": SEL_STATUS + _pad(token)[2:]}, "latest"])
        if not result or len(result) < 2 + 64 * 3:
            return None
        threshold = _word(result, 1)
        if not threshold:
            return None
        return {"version": version, "current": _word(result, 0) / 1e18, "threshold": threshold / 1e18, "graduated": bool(_word(result, 2))}

    @app.get("/api/bonding")
    async def bonding(debug: str = ""):
        if not g["GATING_ACTIVE"]:
            return {"present": False}
        save = _cache.get("bonding")
        if save and time.time() - save[1] < 45 and not debug:
            return save[0]
        token = g["ORYNX_TOKEN"]
        note: list = []
        data = None
        for attempt in (lambda: _bonding_v2(token, note),
                     lambda: _bonding_status(PONS_V2, token, 2),
                     lambda: _bonding_status(PONS_V1, token, 1)):
            try:
                data = await attempt()
            except Exception as err:
                note.append(str(err)[:200])
                data = None
            if data:
                break
        if not data:
            if save:
                return save[0]
            result = {"present": False, "note": [c[:120] for c in note][:4]}
        else:
            percent = 100.0 if data["graduated"] else max(0.0, min(100.0, data["current"] / data["threshold"] * 100))
            result = {"present": True, "percent": round(percent, 2), "current": data["current"], "threshold": data["threshold"],
                     "graduated": data["graduated"], "version": data["version"]}
            _cache["bonding"] = (result, time.time())
        key = g["ADMIN_KEY"]
        if debug and key and hmac.compare_digest(debug, key):
            return {**result, "note": note, "detail": data}
        return result

    # -------------------------------------------------------------- favicon
    def _svg_icon(rx: int, scale: float = 1.0) -> str:
        t = f'translate(256 256) scale({scale}) translate(-256 -256)'
        return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">'
                f'<rect width="512" height="512" rx="{rx}" fill="#000"/><g transform="{t}">'
                '<circle cx="256" cy="256" r="150" fill="none" stroke="#fff" stroke-width="54"/>'
                '<circle cx="362.1" cy="149.9" r="62" fill="#000"/><circle cx="362.1" cy="149.9" r="34" fill="#fff"/></g></svg>')

    _icon: dict = {}

    def _png(key: str, size: int, rx: int, scale: float = 1.0) -> bytes:
        if key not in _icon:
            _icon[key] = g["svg_to_png"](_svg_icon(rx, scale), size)
        return _icon[key]

    def _ico() -> bytes:
        if "ico" not in _icon:
            draw = [(16, _png("p16", 16, 110)), (32, _png("p32", 32, 110)), (48, _png("p48", 48, 110))]
            head = (0).to_bytes(2, "little") + (1).to_bytes(2, "little") + len(draw).to_bytes(2, "little")
            dir_, fill, off = b"", b"", 6 + 16 * len(draw)
            for u, data in draw:
                dir_ += bytes([u, u, 0, 0]) + (1).to_bytes(2, "little") + (32).to_bytes(2, "little") + len(data).to_bytes(4, "little") + off.to_bytes(4, "little")
                fill += data
                off += len(data)
            _icon["ico"] = head + dir_ + fill
        return _icon["ico"]

    SAVE_OLD = {"Cache-Control": "public, max-age=86400, s-maxage=604800"}

    @app.get("/favicon.ico", include_in_schema=False)
    async def favicon_ico():
        return Response(_ico(), media_type="image/x-icon", headers=SAVE_OLD)

    @app.get("/favicon.svg", include_in_schema=False)
    async def favicon_svg():
        return Response(_svg_icon(110), media_type="image/svg+xml", headers=SAVE_OLD)

    @app.get("/favicon-32.png", include_in_schema=False)
    async def favicon_32():
        return Response(_png("p32", 32, 110), media_type="image/png", headers=SAVE_OLD)

    @app.get("/apple-touch-icon.png", include_in_schema=False)
    @app.get("/apple-touch-icon-precomposed.png", include_in_schema=False)
    async def icon_apple():
        return Response(_png("p180", 180, 0, 0.86), media_type="image/png", headers=SAVE_OLD)

    @app.get("/icon-192.png", include_in_schema=False)
    async def icon_192():
        return Response(_png("p192", 192, 0, 0.86), media_type="image/png", headers=SAVE_OLD)

    @app.get("/icon-512.png", include_in_schema=False)
    async def icon_512():
        return Response(_png("p512", 512, 0, 0.86), media_type="image/png", headers=SAVE_OLD)

    @app.get("/site.webmanifest", include_in_schema=False)
    async def manifest():
        data = {"name": "Orynx", "short_name": "Orynx", "description": "AI launch kits for pons on Robinhood Chain.",
                "start_url": "/", "display": "standalone", "background_color": "#000000", "theme_color": "#000000",
                "icons": [{"src": "/icon-192.png", "sizes": "192x192", "type": "image/png"},
                          {"src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable"}]}
        return Response(json.dumps(data), media_type="application/manifest+json", headers=SAVE_OLD)

    # ------------------------------------------------------- holders + feed
    ZERO = "0x0000000000000000000000000000000000000000"

    def _address(topic: str) -> str:
        return "0x" + topic[-40:].lower()

    async def _time_block(number: str) -> int:
        key = "blk:" + number
        if key not in _cache:
            try:
                _cache[key] = int((await _rpc("eth_getBlockByNumber", [number, False]))["timestamp"], 16)
            except Exception:
                return 0
        return _cache[key]

    @app.get("/api/holders")
    async def holders():
        if not g["GATING_ACTIVE"]:
            return {"present": False}
        save = _cache.get("holders")
        if save and time.time() - save[1] < 60:
            return save[0]
        token = g["ORYNX_TOKEN"].lower()
        try:
            info = await _info_launch(token)
            if not info:
                raise RuntimeError("launch not found")
            des = await _decimals()
            st = _cache.setdefault("balance", {"block": info["block"] - 1, "balance": {}, "log": []})
            tip = await _block_latest()
            if tip > st["block"]:
                fresh = await _log_window(token, [TOPIC_TRANSFER], st["block"] + 1, tip)
                for lg in fresh:
                    sender, receiver = _address(lg["topics"][1]), _address(lg["topics"][2])
                    n = int(lg.get("data", "0x0") or "0x0", 16)
                    st["balance"][sender] = st["balance"].get(sender, 0) - n
                    st["balance"][receiver] = st["balance"].get(receiver, 0) + n
                    st["log"].append({"sender": sender, "receiver": receiver, "n": n, "tx": lg["transactionHash"], "block": lg["blockNumber"]})
                st["log"] = st["log"][-40:]
                st["block"] = tip
            curve = info["curve"].lower()
            excluding = {ZERO, DEAD, curve, PONS_V2}
            count = sum(1 for a, v in st["balance"].items() if v > 0 and a not in excluding)
            group: dict = {}
            for lg in st["log"]:
                if lg["sender"] != ZERO:
                    group.setdefault(lg["tx"], []).append(lg)
            feed = []
            for tx in reversed(list(group)):
                L = group[tx]
                burn = [x for x in L if x["receiver"] == DEAD]
                buy = [x for x in L if x["sender"] == curve]
                sell = [x for x in L if x["receiver"] == curve]
                if burn:
                    kind, who, n = "burn", L[0]["sender"], sum(x["n"] for x in burn)
                elif buy:
                    kind, who, n = "buy", L[-1]["receiver"], sum(x["n"] for x in buy)
                elif sell:
                    kind, who, n = "sell", L[0]["sender"], sum(x["n"] for x in sell)
                else:
                    kind, who, n = "transfer", L[-1]["receiver"], max(x["n"] for x in L)
                feed.append({"kind": kind, "who": who, "count": n / 10 ** des, "tx": tx,
                             "time": await _time_block(L[-1]["block"])})
                if len(feed) >= 10:
                    break
        except Exception as err:
            log.warning("Holders failed: %s", err)
            if save:
                return save[0]
            return {"present": False}
        result = {"present": True, "holders": count, "feed": feed}
        _cache["holders"] = (result, time.time())
        return result

    # ------------------------------------------------------- kit of the day
    @app.get("/api/kotd")
    async def kit_today():
        if not (g["REDIS_URL"] and g["REDIS_TOKEN"]):
            return {"present": False}
        day = g["today"]()
        save = _cache.get("kotd")
        if save and save[1] == day and time.time() - save[2] < 60:
            return save[0]
        try:
            pick = await _redis("GET", f"orynx:kotd:{day}")
            if not pick:
                raw = await _redis("LRANGE", "orynx:gallery", "0", "299") or []
                items = []
                for row in raw:
                    try:
                        items.append(json.loads(row))
                    except Exception:
                        pass
                if not items:
                    return {"present": False}
                seen = set(await _redis("SMEMBERS", "orynx:kotd:seen") or [])
                ids = [it["id"] for it in items]
                likes = await _redis("HMGET", "orynx:likes", *ids) or []
                score = {i: int(n or 0) for i, n in zip(ids, likes)}
                now = time.time()
                candidate = [it for it in items if it["id"] not in seen and now - it.get("t", 0) < 7 * 86400] \
                    or [it for it in items if it["id"] not in seen] or items
                candidate.sort(key=lambda it: (score.get(it["id"], 0), it.get("t", 0)), reverse=True)
                pick = candidate[0]["id"]
                await _redis("SET", f"orynx:kotd:{day}", pick, "EX", "172800")
                await _redis("SADD", "orynx:kotd:seen", pick)
            it = await g["get_item"](pick)
            if not it:
                await _redis("DEL", f"orynx:kotd:{day}")
                return {"present": False}
            n = await _redis("HGET", "orynx:likes", pick)
            result = {"present": True, "date": day, "item": {**it, "likes": int(n or 0)}}
        except Exception as err:
            log.warning("Kit of the day failed: %s", err)
            return save[0] if save else {"present": False}
        _cache["kotd"] = (result, day, time.time())
        return result

    # ------------------------------------------------- early access + badge
    EARLY = {"badge": {"name": "Embed badge", "public": 1795885200}}

    def _open(features: str) -> bool:
        return time.time() >= EARLY[features]["public"]

    @app.get("/api/early")
    async def early():
        return {"features": [{"id": k, "name": v["name"], "public": v["public"], "opened": _open(k)} for k, v in EARLY.items()]}

    def _text_abi(hexdata: str) -> str:
        try:
            h = hexdata[2:]
            if len(h) >= 128:
                n = int(h[64:128], 16)
                return bytes.fromhex(h[128:128 + n * 2]).decode("utf-8", "ignore")
            return bytes.fromhex(h[:64]).rstrip(b"\x00").decode("utf-8", "ignore")
        except Exception:
            return ""

    async def _info_token(token: str) -> dict:
        key = "tok:" + token
        if key not in _cache:
            name = _text_abi(await _rpc("eth_call", [{"to": token, "data": "0x06fdde03"}, "latest"]) or "0x")
            symbol = _text_abi(await _rpc("eth_call", [{"to": token, "data": "0x95d89b41"}, "latest"]) or "0x")
            _cache[key] = {"name": name[:40], "symbol": symbol[:12]}
        return _cache[key]

    async def _bonding_token(token: str) -> dict | None:
        key = "bt:" + token
        save = _cache.get(key)
        if save and time.time() - save[1] < 60:
            return save[0]
        data = await _bonding_v2(token, [])
        if data:
            data["percent"] = 100.0 if data["graduated"] else max(0.0, min(100.0, data["current"] / data["threshold"] * 100))
            if len(_cache) > 2000:
                for k in [k for k in _cache if k.startswith("bt:")][:500]:
                    _cache.pop(k, None)
            _cache[key] = (data, time.time())
        return data

    class BadgeRequest(BaseModel):
        token: str = Field(pattern=r"^0x[0-9a-fA-F]{40}$")

    def _sign_badge(token: str) -> str:
        return g["sign_content"]("badge", token.lower())[:16]

    @app.post("/api/badge")
    async def make_badge(data: BadgeRequest, request: Request):
        token = data.token.lower()
        if not _open("badge"):
            _, holder = await g["who_and_holder"](request)
            if not holder:
                raise HTTPException(403, "Holders of 1M $ORYNX get the badge first. Everyone can use it from Nov 29.")
        try:
            info = await _info_launch(token)
        except Exception:
            raise HTTPException(502, "Couldn't read Robinhood Chain right now. Try again in a minute.")
        if not info:
            raise HTTPException(400, "We couldn't find this token on pons. Check the contract address.")
        k = _sign_badge(token)
        site = g["SITE"]
        code = f'<script src="{site}/badge.js" data-orynx="{token}" data-k="{k}" async></script>'
        return {"code": code, "url": f"{site}/badge?t={token}&k={k}"}

    @app.get("/badge.js", include_in_schema=False)
    async def badge_js():
        js = ("(function(){var s=document.currentScript||document.querySelector('script[data-orynx]');if(!s)return;"
              "var f=document.createElement('iframe');f.src=s.src.replace(/\\/badge\\.js.*$/,'')+'/badge?t='+encodeURIComponent(s.dataset.orynx||'')+'&k='+encodeURIComponent(s.dataset.k||'');"
              "f.title='Orynx bonding badge';f.loading='lazy';f.style.cssText='border:0;width:100%;max-width:380px;height:132px;display:block;border-radius:18px;color-scheme:dark';"
              "s.parentNode.insertBefore(f,s.nextSibling);})();")
        return Response(js, media_type="application/javascript", headers={"Cache-Control": "public, max-age=3600"})

    @app.get("/badge", include_in_schema=False)
    async def badge(t: str = "", k: str = ""):
        site = g["SITE"]
        token = t.lower()
        ok = bool(re.fullmatch(r"0x[0-9a-f]{40}", token)) and hmac.compare_digest(k, _sign_badge(token) if token else "x")
        fill = f'<a class="cta" href="{site}" target="_blank" rel="noopener">Get your badge at orynxai.xyz</a>'
        if ok:
            try:
                info = await _info_token(token)
                b = await _bonding_token(token)
            except Exception:
                info, b = {"name": "", "symbol": ""}, None
            import html as _html
            name = _html.escape(info["name"] or "Token")
            symbol = _html.escape(info["symbol"])
            if b:
                percent = b["percent"]
                note = "Graduated to Uniswap v4" if b["graduated"] else f'{b["current"]:.3f} of {b["threshold"]:.2f} ETH on the pons curve'
            else:
                percent, note = 0.0, "Bonding data is loading"
            fill = (f'<div class="top"><b>{name}</b><span>{"$" + symbol if symbol else ""}</span><em>{percent:.1f}%</em></div>'
                   f'<div class="bar"><i style="width:{max(2.0, percent):.2f}%"></i></div>'
                   f'<div class="ft"><span>{note}</span><a href="{site}" target="_blank" rel="noopener">'
                   '<svg viewBox="0 0 512 512"><circle cx="256" cy="256" r="150" fill="none" stroke="#fff" stroke-width="54"/>'
                   '<circle cx="362.1" cy="149.9" r="62" fill="#0b0b0d"/><circle cx="362.1" cy="149.9" r="34" fill="#fff"/></svg>Built with Orynx</a></div>')
        page = ('<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
                   '<meta http-equiv="refresh" content="120"><title>Orynx badge</title><style>'
                   'html,body{margin:0;background:transparent;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#fff}'
                   '.card{box-sizing:border-box;height:132px;padding:16px 18px;border:1px solid #2c2c2c;border-radius:18px;background:#0b0b0d;display:flex;flex-direction:column;justify-content:center;gap:10px}'
                   '.top{display:flex;align-items:baseline;gap:8px}.top b{font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
                   '.top span{color:#8c8c8c;font-size:13px;font-weight:600}.top em{margin-left:auto;font-style:normal;font-weight:700;font-size:20px}'
                   '.bar{height:9px;border-radius:9px;background:#1c1c1c;overflow:hidden}.bar i{display:block;height:100%;border-radius:9px;background:linear-gradient(90deg,#8a8a8a,#fff)}'
                   '.ft{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:12px;color:#8c8c8c}'
                   '.ft a{display:inline-flex;align-items:center;gap:6px;color:#fff;text-decoration:none;font-weight:600;white-space:nowrap}.ft svg{width:16px;height:16px}'
                   '.cta{color:#fff;font-weight:600;text-decoration:none}</style></head>'
                   f'<body><div class="card">{fill}</div></body></html>')
        return Response(page, media_type="text/html", headers={"Cache-Control": "public, max-age=60, s-maxage=60"})

    @app.get("/features.js", include_in_schema=False)
    async def features_js():
        fill = (g["Path"](__file__).parent / "static" / "features.js").read_text(encoding="utf-8")
        return Response(fill, media_type="application/javascript", headers={"Cache-Control": "public, max-age=300"})

    # ------------------------------------------------------------ mini site
    import base64 as _b64
    import html as _h
    import secrets as _sec

    THEME = {
        "night": {"font": "https://fonts.googleapis.com/css2?family=Unbounded:wght@600;800&family=Instrument+Sans:wght@400;600;700&display=swap",
                  "disp": "'Unbounded',sans-serif", "body": "'Instrument Sans',system-ui,sans-serif", "h1": "800", "h2": "600",
                  "track": "-.02em", "radius": "22px", "bw": "1px", "halo": ".55"},
        "pop": {"font": "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Instrument+Sans:wght@400;600;700&display=swap",
                "disp": "'Bricolage Grotesque',sans-serif", "body": "'Instrument Sans',system-ui,sans-serif", "h1": "800", "h2": "800",
                "track": "-.03em", "radius": "20px", "bw": "3px", "halo": "0"},
        "paper": {"font": "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,650&family=Instrument+Sans:wght@400;600;700&display=swap",
                  "disp": "'Fraunces',Georgia,serif", "body": "'Instrument Sans',system-ui,sans-serif", "h1": "650", "h2": "500",
                  "track": "-.02em", "radius": "14px", "bw": "1px", "halo": ".25"},
    }

    def _rgb(hexa: str) -> tuple[int, int, int]:
        return int(hexa[1:3], 16), int(hexa[3:5], 16), int(hexa[5:7], 16)

    def _bright(hexa: str) -> float:
        r, gg, b = _rgb(hexa)
        return (0.299 * r + 0.587 * gg + 0.114 * b) / 255

    def _mix(a: str, b: str, t: float) -> str:
        x, y = _rgb(a), _rgb(b)
        return "#" + "".join(f"{round(x[i] + (y[i] - x[i]) * t):02x}" for i in range(3))

    def _color_theme(theme: str, basic: str, accent: str) -> dict:
        if theme == "pop":
            bg = basic
            ink = "#111111" if _bright(bg) > 0.45 else "#ffffff"
            acc = "#111111" if ink == "#111111" else "#ffffff"
            return {"BG": bg, "INK": ink, "MUTED": _mix(ink, bg, .3), "CARD": "#ffffff" if ink == "#111111" else _mix(bg, "#000000", .35),
                    "LINE": ink, "ACC": acc, "ACC_INK": bg, "SHADOW": f"5px 5px 0 {ink}"}
        if theme == "paper":
            acc = accent if _bright(accent) < 0.75 else "#141414"
            return {"BG": "#f4f1ea", "INK": "#141414", "MUTED": "#5f5b53", "CARD": "#fbf9f4", "LINE": "#d9d3c7",
                    "ACC": acc, "ACC_INK": "#ffffff" if _bright(acc) < 0.6 else "#141414", "SHADOW": "0 1px 0 rgba(0,0,0,.04)"}
        acc = accent if _bright(accent) > 0.22 else "#ffffff"
        return {"BG": "#08080a", "INK": "#f5f5f5", "MUTED": "#9a9a9a", "CARD": "#111114", "LINE": "#26262b",
                "ACC": acc, "ACC_INK": "#111111" if _bright(acc) > 0.55 else "#ffffff", "SHADOW": "0 30px 80px -40px rgba(0,0,0,.8)"}

    ICON_X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.8 3h3.1l-6.8 7.8 8 10.2h-6.3l-4.9-6.4L5.3 21H2.2l7.3-8.3L1.8 3h6.4l4.4 5.9L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5z"/></svg>'
    ICON_TG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.9 4.3 18.7 19.4c-.2 1-.9 1.3-1.7.8l-4.8-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.9 8.9-8c.4-.3-.1-.5-.6-.2L6.5 13.2l-4.7-1.5c-1-.3-1-1 .2-1.5L20.5 3c.9-.3 1.6.2 1.4 1.3z"/></svg>'

    class SiteRequest(BaseModel):
        name: str = Field(min_length=1, max_length=60)
        ticker: str = Field(default="", max_length=8)
        tagline: str = Field(default="", max_length=120)
        roast: str = Field(default="", max_length=2000)
        mode: str = "ai"
        sig: str = Field(min_length=10, max_length=64)
        description: str = Field(default="", max_length=1500)
        features: list[str] = Field(default_factory=list, max_length=3)
        logo: str = Field(min_length=100, max_length=4_000_000)
        logo_sig: str = Field(min_length=10, max_length=64)
        ca: str = Field(default="", max_length=42)
        x: str = Field(default="", max_length=120)
        tg: str = Field(default="", max_length=120)
        theme: str = "night"
        basic: str = Field(default="#111111", pattern=r"^#[0-9a-fA-F]{6}$")
        accent: str = Field(default="#ffffff", pattern=r"^#[0-9a-fA-F]{6}$")
        slug: str = Field(default="", max_length=24)
        key: str = Field(default="", max_length=64)

    def _link_x(u: str) -> str:
        u = u.strip()
        if not u:
            return ""
        if re.fullmatch(r"@?[A-Za-z0-9_]{1,15}", u):
            return "https://x.com/" + u.lstrip("@")
        m = re.fullmatch(r"(?:https?://)?(?:www\.)?(?:x|twitter)\.com/([A-Za-z0-9_]{1,15})/?(?:\?.*)?", u)
        if not m:
            raise HTTPException(400, "Use your X handle, like @yourtoken or x.com/yourtoken.")
        return "https://x.com/" + m.group(1)

    def _link_tg(u: str) -> str:
        u = u.strip()
        if not u:
            return ""
        m = re.fullmatch(r"(?:https?://)?(?:t\.me|telegram\.me)/(\+?[A-Za-z0-9_]{3,64})/?", u) or re.fullmatch(r"@([A-Za-z0-9_]{4,32})", u)
        if not m:
            raise HTTPException(400, "Use your Telegram link, like t.me/yourtoken.")
        return "https://t.me/" + m.group(1)

    @app.post("/api/site")
    async def make_site(data: SiteRequest, request: Request):
        if not (g["REDIS_URL"] and g["REDIS_TOKEN"]):
            raise HTTPException(503, "Mini sites are warming up. Try again later.")
        mode = "meme" if data.mode == "meme" else "ai"
        if not hmac.compare_digest(g["sign_content"]("kit", data.name, data.ticker, data.tagline, data.roast, mode), data.sig):
            raise HTTPException(400, "Build a kit on Orynx first, then make its mini site.")
        try:
            png = _b64.b64decode(data.logo, validate=True)
        except Exception:
            raise HTTPException(400, "That logo doesn't look right.")
        if not png.startswith(b"\x89PNG") or not hmac.compare_digest(g["sign_content"]("logo", hashlib.sha256(png).hexdigest()), data.logo_sig):
            raise HTTPException(400, "Only logos made on Orynx can go on a mini site.")
        ca = data.ca.strip().lower()
        if ca and not re.fullmatch(r"0x[0-9a-f]{40}", ca):
            raise HTTPException(400, "That contract address doesn't look right. It starts with 0x and has 42 characters.")
        x, tg = _link_x(data.x), _link_tg(data.tg)
        theme = data.theme if data.theme in THEME else "night"
        features = [f.strip()[:220] for f in data.features if f.strip()][:3]
        who, holder = await g["who_and_holder"](request)
        slug = re.sub(r"[^a-z0-9-]", "", data.slug.lower())[:24]
        old = None
        if slug:
            raw = await _redis("GET", f"orynx:site:{slug}")
            old = json.loads(raw) if raw else None
            if not old or not data.key or not hmac.compare_digest(hashlib.sha256(data.key.encode()).hexdigest(), old.get("kh", "")):
                raise HTTPException(403, "You can only update a mini site you made on this device.")
        key = data.key
        if not old:
            limit = f"orynx:sitecount:{hashlib.sha256(who.encode()).hexdigest()[:20]}:{g['today']()}"
            n = int(await _redis("INCR", limit) or 0)
            await _redis("EXPIRE", limit, "90000")
            if n > 5:
                raise HTTPException(429, "That's 5 new mini sites today. Come back tomorrow.")
            basic = re.sub(r"[^a-z0-9]", "", (data.ticker or data.name).lower())[:16] or "token"
            slug = ""
            for i in range(6):
                candidate = basic if i == 0 else f"{basic}-{_sec.token_hex(2)}"
                if candidate in {"api", "admin", "orynx", "badge", "static"}:
                    continue
                ok = await _redis("SET", f"orynx:site:{candidate}", "{}", "NX")
                if ok:
                    slug = candidate
                    break
            if not slug:
                raise HTTPException(502, "Couldn't reserve a link. Try again.")
            key = _sec.token_hex(16)
            try:
                await _redis("INCR", "orynx:count:sites")
            except Exception:
                pass
        small = g["svg_to_png"](f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512">'
                                f'<image width="512" height="512" href="data:image/png;base64,{data.logo}" xlink:href="data:image/png;base64,{data.logo}"/></svg>', 512)
        site = {"name": data.name.strip(), "ticker": data.ticker.strip().upper(), "tagline": data.tagline.strip(), "mode": mode,
                 "description": data.description.strip(), "features": features, "ca": ca, "x": x, "tg": tg, "theme": theme,
                 "basic": data.basic.lower(), "accent": data.accent.lower(), "holder": bool(holder or (old or {}).get("holder")),
                 "kh": hashlib.sha256(key.encode()).hexdigest(), "t": (old or {}).get("t") or int(time.time()), "u": int(time.time())}
        await _redis("SET", f"orynx:sitelogo:{slug}", _b64.b64encode(small).decode())
        await _redis("SET", f"orynx:site:{slug}", json.dumps(site))
        _cache.pop("site:" + slug, None)
        return {"ok": True, "slug": slug, "key": key, "url": f"{g['SITE']}/s/{slug}"}

    async def _get_site(slug: str) -> dict | None:
        if not re.fullmatch(r"[a-z0-9-]{1,24}", slug):
            return None
        save = _cache.get("site:" + slug)
        if save and time.time() - save[1] < 30:
            return save[0]
        raw = await _redis("GET", f"orynx:site:{slug}")
        data = json.loads(raw) if raw else None
        if not data or not data.get("name"):
            return None
        _cache["site:" + slug] = (data, time.time())
        return data

    @app.get("/s/{slug}/logo.png", include_in_schema=False)
    async def site_logo(slug: str):
        if not re.fullmatch(r"[a-z0-9-]{1,24}", slug):
            raise HTTPException(404, "Not found")
        b64 = await _redis("GET", f"orynx:sitelogo:{slug}")
        if not b64:
            raise HTTPException(404, "Not found")
        return Response(_b64.b64decode(b64), media_type="image/png", headers={"Cache-Control": "public, max-age=300, s-maxage=3600"})

    @app.get("/s/{slug}/bonding", include_in_schema=False)
    async def site_bonding(slug: str):
        s = await _get_site(slug)
        if not s or not s.get("ca") or not (s.get("holder") or _open("badge")):
            return {"present": False}
        try:
            b = await _bonding_token(s["ca"])
        except Exception:
            b = None
        if not b:
            return {"present": False}
        return {"present": True, "percent": b["percent"], "current": b["current"], "threshold": b["threshold"], "graduated": b["graduated"]}

    async def _count_sites() -> int:
        """Mini sites published so far. Counted once from storage, then kept up to date on each new site."""
        n = await _redis("GET", "orynx:count:sites")
        if n is not None:
            return int(n)
        total, cursor = 0, "0"
        for _ in range(50):
            res = await _redis("SCAN", cursor, "MATCH", "orynx:site:*", "COUNT", "500") or ["0", []]
            cursor, keys = str(res[0]), res[1] or []
            total += len(keys)
            if cursor == "0":
                break
        await _redis("SET", "orynx:count:sites", str(total), "NX")
        return total

    @app.get("/api/stats")
    async def stats():
        """How much Orynx has been used. Only real counters; anything unknown is left out."""
        save = _cache.get("stats")
        if save and time.time() - save[1] < 120:
            return save[0]
        out: dict = {}
        try:
            out["kits"] = int(await _redis("GET", "orynx:kits") or 0)
        except Exception:
            pass
        try:
            out["shared"] = int(await _redis("LLEN", "orynx:gallery") or 0)
        except Exception:
            pass
        try:
            out["sites"] = await _count_sites()
        except Exception:
            pass
        try:
            out["scans"] = int(await _redis("GET", "orynx:count:scans") or 0)
        except Exception:
            pass
        _cache["stats"] = (out, time.time())
        return out

    @app.get("/s/{slug}/live", include_in_schema=False)
    async def site_live(slug: str):
        """Live numbers for a mini site: holders, burn, safety scan and the DEX Screener pair if one exists."""
        s = await _get_site(slug)
        if not s or not s.get("ca"):
            return {"present": False}
        ca = s["ca"]
        save = _cache.get("live:" + ca)
        if save and time.time() - save[1] < 120:
            return save[0]
        out: dict = {"present": True}
        scan = None
        if g.get("scan_quiet"):
            try:
                scan = await asyncio.wait_for(g["scan_quiet"](ca), 25)
            except Exception:
                scan = None
        if scan:
            f = scan.get("facts") or {}
            h = f.get("holders") or {}
            out["scan"] = {"verdict": scan.get("verdict"), "score": scan.get("score"),
                           "good": [x["title"] for x in scan.get("flags", []) if x.get("level") == "green"][:3],
                           "warn": [x["title"] for x in scan.get("flags", []) if x.get("level") in ("red", "amber")][:3]}
            if h:
                out["holders"] = {"count": h.get("count"), "top10": round(h.get("top10", 0), 1), "burned": round(h.get("burned", 0), 2)}
            if f.get("bonding"):
                out["bonding"] = f["bonding"]
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                r = await client.get(f"https://api.dexscreener.com/token-pairs/v1/robinhood/{ca}")
                pairs = r.json() if r.status_code == 200 else []
            if isinstance(pairs, list) and pairs:
                best = max(pairs, key=lambda p: float((p.get("liquidity") or {}).get("usd") or 0))
                if re.fullmatch(r"0x[0-9a-fA-F]{40,64}", str(best.get("pairAddress", ""))):
                    out["pair"] = best["pairAddress"].lower()
        except Exception:
            pass
        _cache["live:" + ca] = (out, time.time())
        return out

    @app.get("/s/{slug}", include_in_schema=False)
    async def site_page(slug: str):
        slug = slug.lower()
        s = await _get_site(slug)
        if not s:
            raise HTTPException(404, "This mini site doesn't exist.")
        e = _h.escape
        url = f"{g['SITE']}/s/{slug}"
        t = THEME.get(s["theme"], THEME["night"])
        w = _color_theme(s["theme"], s["basic"], s["accent"])
        tk = f"${s['ticker']}" if s["ticker"] else ""
        soc = ""
        if s["x"]:
            soc += f'<a class="ic" href="{e(s["x"])}" target="_blank" rel="noopener" aria-label="X">{ICON_X}</a>'
        if s["tg"]:
            soc += f'<a class="ic" href="{e(s["tg"])}" target="_blank" rel="noopener" aria-label="Telegram">{ICON_TG}</a>'
        cta = (f'<a class="btn main" href="https://ponsfamily.com/launchpad/{s["ca"]}" target="_blank" rel="noopener">Buy {e(tk) or "it"} on pons</a>'
               f'<a class="btn" href="#verify">Check the address</a>'
               if s["ca"] else '<span class="btn main soon">Launching soon on pons</span>')
        if s["tg"] and not s["ca"]:
            cta += f'<a class="btn" href="{e(s["tg"])}" target="_blank" rel="noopener">Join the Telegram</a>'
        if s["x"] and not s["ca"]:
            cta += f'<a class="btn" href="{e(s["x"])}" target="_blank" rel="noopener">Follow on X</a>'
        follow = "".join(f'<a class="btn" href="{e(u)}" target="_blank" rel="noopener">{lbl}</a>' for u, lbl in ((s["x"], "Follow on X"), (s["tg"], "Join the Telegram")) if u)
        ca_block = ""
        if s["ca"]:
            c = s["ca"]
            ca_block = (f'<section class="verify" id="verify" aria-labelledby="ver-h"><div class="v-head"><h2 id="ver-h">Check the address before you buy</h2>'
                        f'<p>Copycats reuse names and logos. The contract below is the only real {e(tk or s["name"])}. Match the first and last characters with what your wallet shows.</p></div>'
                        f'<div class="ca"><code id="ca" data-full="{c}"><b>{c[:6]}</b>{c[6:-4]}<b>{c[-4:]}</b></code>'
                        f'<div class="ca-act"><button class="copy" id="cpy" type="button">Copy address</button>'
                        f'<a class="lnk" href="https://robin.etherscan.io/token/{c}" target="_blank" rel="noopener">View on explorer</a></div></div>'
                        f'<div class="bond" id="bond" hidden data-src="/s/{slug}/bonding"><div class="bond-t"><span>pons curve</span><b id="bp">0%</b></div>'
                        '<div class="bar"><i id="bf"></i></div><p id="bn"></p></div></section>')
        features = "".join(f'<li>{e(f)}</li>' for f in s["features"]) or f'<li>{e(s["tagline"])}</li>'
        steps = [("Get ETH on Robinhood Chain", "Bridge or buy a little ETH in a wallet that supports Robinhood Chain.")]
        if s["ca"]:
            steps += [("Open pons", f"Go to ponsfamily.com and find {tk or s['name']}."),
                        ("Check the address", "Make sure the contract address matches the one on this page, then buy.")]
        else:
            steps += [("Follow for the launch", "The contract address will be posted here and on our socials."),
                        ("Buy on pons", f"When {tk or s['name']} goes live, buy it on ponsfamily.com.")]
        steps_html = "".join(f'<li class="step"><span class="n">{i + 1}</span><b>{e(a)}</b><p>{e(b)}</p></li>' for i, (a, b) in enumerate(steps))
        n_name = max((len(k) for k in s["name"].split()), default=4) + (3 if s["theme"] == "night" else 0)
        h1 = ("clamp(56px,9.5vw,124px)" if n_name <= 6 else "clamp(46px,7.2vw,96px)" if n_name <= 9
              else "clamp(38px,5.4vw,72px)" if n_name <= 13 else "clamp(30px,4vw,54px)")
        swap = {"H1_SIZE": h1, "NAME": e(s["name"]), "TICKER_DOLLAR": e(tk), "TICKER_DOLLAR_OR": e(tk or s["name"]), "TAGLINE": e(s["tagline"]),
                 "URL": url, "PATH": f"/s/{slug}", "FONT_URL": t["font"], "DISP": t["disp"], "BODY": t["body"], "H1_WEIGHT": t["h1"], "H2_WEIGHT": t["h2"],
                 "H1_TRACK": t["track"], "RADIUS": t["radius"], "BW": t["bw"], "HALO": t["halo"], "LABEL_CHAIN": "Robinhood Chain",
                 "SOC": soc, "CTA": cta, "CA_BLOCK": ca_block, "DESCRIPTION": e(s["description"] or s["tagline"]),
                 "TITLE_FEATURES": "The lore" if s["mode"] == "meme" else "What it does", "FEATURES": features, "STEPS": steps_html,
                 "TICKER_BIG": e(tk or s["name"]), "BUY_HREF": f"https://ponsfamily.com/launchpad/{s['ca']}" if s["ca"] else "",
                 "BODY_CLASS": "has-ca" if s["ca"] else "", "FOLLOW": follow, "THEME": s["theme"], **w}
        tpl = _cache.get("tpl_site")
        if not tpl:
            tpl = (g["Path"](__file__).parent / "static" / "site.html").read_text(encoding="utf-8")
            _cache["tpl_site"] = tpl
        page = re.sub(r"\{\{([A-Z0-9_]+)\}\}", lambda m: str(swap.get(m.group(1), "")), tpl)
        return Response(page, media_type="text/html", headers={"Cache-Control": "public, max-age=60, s-maxage=60"})

    class DeleteSiteRequest(BaseModel):
        slug: str = Field(min_length=1, max_length=24)
        key: str = Field(min_length=8, max_length=200)

    @app.post("/api/site/remove")
    async def delete_site(data: DeleteSiteRequest):
        admin = g["ADMIN_KEY"]
        s = await _redis("GET", f"orynx:site:{data.slug}")
        info = json.loads(s) if s else {}
        allowed = (admin and hmac.compare_digest(data.key, admin)) or \
            (info.get("kh") and hmac.compare_digest(hashlib.sha256(data.key.encode()).hexdigest(), info["kh"]))
        if not allowed:
            raise HTTPException(403, "Not allowed.")
        await _redis("DEL", f"orynx:site:{data.slug}")
        await _redis("DEL", f"orynx:sitelogo:{data.slug}")
        _cache.pop("site:" + data.slug, None)
        return {"ok": True}

    # shared on-chain helpers for other feature layers (red flag scanner)
    g["_chain"] = {"info_launch": _info_launch, "bonding_token": _bonding_token, "log_window": _log_window,
                   "info_token": _info_token, "block_latest": _block_latest, "time_block": _time_block,
                   "pad": _pad, "word": _word, "text_abi": _text_abi, "PONS_V2": PONS_V2}
