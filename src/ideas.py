"""
Idea wall: anyone drops a coin idea in one sentence, the community votes,
and any idea can be turned into a launch kit with one tap.
"""

import hashlib
import hmac
import json
import re
import secrets
import time

from fastapi import HTTPException, Request
from pydantic import BaseModel, Field

KEY_IDEA = "orynx:ideas"          # hash id -> json
KEY_SCORE = "orynx:ideas:score"   # zset id -> votes
KEY_NEW = "orynx:ideas:new"       # list of newest ids
KEY_SEEN = "orynx:ideas:seen"     # set of normalised text hashes
MAX_KEEP = 400
PER_DAY = 3
GLOBAL_DAY = 400

BLOCK = re.compile(
    r"(https?://|www\.|\.(com|xyz|io|net|org|gg|app|fun|me)\b|t\.me|discord\.gg|@\w|0x[0-9a-fA-F]{6,}|"
    r"\b(nigg|fagg|tranny)\w*|\b(kike|chink|spic|rape|rapist|nazi|hitler|kys|porn|nsfw|retard)s?\b)",
    re.I)


class IdeaPost(BaseModel):
    text: str = Field(min_length=1, max_length=200)
    kind: str = "meme"


class IdeaRef(BaseModel):
    id: str = Field(pattern=r"^[0-9a-f]{10}$")


class IdeaRemove(BaseModel):
    id: str = Field(pattern=r"^[0-9a-f]{10}$")
    key: str = Field(min_length=8, max_length=200)


def install(app, g):
    redis, log = g["_redis"], g["log"]
    memo: dict = {}

    def who(request: Request, salt: str) -> str:
        return hashlib.sha256((salt + ":" + g["id_visitor"](request)).encode()).hexdigest()[:20]

    def ready():
        if not (g["REDIS_URL"] and g["REDIS_TOKEN"]):
            raise HTTPException(503, "The idea wall is warming up. Try again later.")

    async def rows(ids: list) -> list:
        if not ids:
            return []
        raw = await redis("HMGET", KEY_IDEA, *ids) or []
        try:
            votes = await redis("ZMSCORE", KEY_SCORE, *ids) or []
        except Exception:
            votes = [await redis("ZSCORE", KEY_SCORE, i) for i in ids]
        out = []
        for i, r, v in zip(ids, raw, votes):
            if not r:
                continue
            try:
                it = json.loads(r)
            except Exception:
                continue
            out.append({"id": i, "text": it["text"], "kind": it.get("kind", "meme"), "t": it.get("t", 0),
                        "votes": int(float(v or 0))})
        return out

    @app.get("/api/ideas")
    async def ideas_list():
        if not (g["REDIS_URL"] and g["REDIS_TOKEN"]):
            return {"present": False, "top": [], "new": []}
        hit = memo.get("list")
        if hit and time.time() - hit[1] < 15:
            return hit[0]
        try:
            top_ids = await redis("ZREVRANGE", KEY_SCORE, "0", "11") or []
            new_ids = await redis("LRANGE", KEY_NEW, "0", "11") or []
            res = {"present": True, "top": await rows(top_ids), "new": await rows(new_ids)}
        except Exception as err:
            log.warning("Idea wall read failed: %s", err)
            return hit[0] if hit else {"present": False, "top": [], "new": []}
        memo["list"] = (res, time.time())
        return res

    @app.post("/api/ideas")
    async def ideas_post(data: IdeaPost, request: Request):
        ready()
        text = re.sub(r"\s+", " ", data.text).strip()
        if len(text) < 12:
            raise HTTPException(400, "Give it a bit more: one full sentence works best.")
        if len(text) > 140:
            raise HTTPException(400, "Keep it to one sentence, 140 characters max.")
        if BLOCK.search(text):
            raise HTTPException(400, "Ideas only: no links, handles, contract addresses or slurs.")
        kind = "ai" if data.kind == "ai" else "meme"
        day = g["today"]()
        me = who(request, "idea")
        norm = hashlib.sha256(re.sub(r"[^a-z0-9]", "", text.lower()).encode()).hexdigest()[:16]
        try:
            if await redis("SISMEMBER", KEY_SEEN, norm):
                raise HTTPException(409, "That idea is already on the wall. Give it a vote instead.")
            if int(await redis("INCR", f"orynx:ideacount:{me}:{day}") or 0) > PER_DAY:
                raise HTTPException(429, f"You've posted {PER_DAY} ideas today. Come back tomorrow.")
            await redis("EXPIRE", f"orynx:ideacount:{me}:{day}", "90000")
            if int(await redis("INCR", f"orynx:ideacount:__ALL__:{day}") or 0) > GLOBAL_DAY:
                raise HTTPException(429, "The wall is full for today. Come back tomorrow.")
            await redis("EXPIRE", f"orynx:ideacount:__ALL__:{day}", "90000")
            iid = secrets.token_hex(5)
            await redis("HSET", KEY_IDEA, iid, json.dumps({"text": text, "kind": kind, "t": int(time.time()), "n": norm}))
            await redis("ZADD", KEY_SCORE, "0", iid)
            await redis("LPUSH", KEY_NEW, iid)
            await redis("LTRIM", KEY_NEW, "0", "49")
            await redis("SADD", KEY_SEEN, norm)
            total = int(await redis("ZCARD", KEY_SCORE) or 0)
            if total > MAX_KEEP:
                old = await redis("ZRANGE", KEY_SCORE, "0", str(total - MAX_KEEP - 1)) or []
                if old:
                    await redis("ZREM", KEY_SCORE, *old)
                    await redis("HDEL", KEY_IDEA, *old)
        except HTTPException:
            raise
        except Exception as err:
            log.error("Idea post failed: %s", err)
            raise HTTPException(502, "Couldn't post that idea. Try again.")
        memo.pop("list", None)
        return {"ok": True, "idea": {"id": iid, "text": text, "kind": kind, "votes": 0}}

    @app.post("/api/ideas/vote")
    async def ideas_vote(data: IdeaRef, request: Request):
        ready()
        me = who(request, "ideavote")
        try:
            if not await redis("HEXISTS", KEY_IDEA, data.id):
                raise HTTPException(404, "That idea is gone.")
            fresh = await redis("SET", f"orynx:ideavote:{data.id}:{me}", "1", "NX", "EX", "2592000")
            if fresh is None:
                n = await redis("ZSCORE", KEY_SCORE, data.id)
                return {"ok": True, "votes": int(float(n or 0)), "already": True}
            day = g["today"]()
            if int(await redis("INCR", f"orynx:ideavotes:{me}:{day}") or 0) > 60:
                raise HTTPException(429, "That's a lot of votes for one day. Come back tomorrow.")
            await redis("EXPIRE", f"orynx:ideavotes:{me}:{day}", "90000")
            n = await redis("ZINCRBY", KEY_SCORE, "1", data.id)
        except HTTPException:
            raise
        except Exception as err:
            log.error("Idea vote failed: %s", err)
            raise HTTPException(502, "Couldn't save that vote. Try again.")
        memo.pop("list", None)
        return {"ok": True, "votes": int(float(n or 0))}

    async def drop(iid: str):
        raw = await redis("HGET", KEY_IDEA, iid)
        await redis("ZREM", KEY_SCORE, iid)
        await redis("HDEL", KEY_IDEA, iid)
        await redis("LREM", KEY_NEW, "0", iid)
        memo.pop("list", None)
        return raw

    @app.post("/api/ideas/report")
    async def ideas_report(data: IdeaRef, request: Request):
        ready()
        me = who(request, "ideareport")
        try:
            if await redis("SET", f"orynx:idearep:{data.id}:{me}", "1", "NX", "EX", "2592000") is None:
                return {"ok": True}
            n = int(await redis("INCR", f"orynx:idearep:{data.id}") or 0)
            if n >= 3:
                await drop(data.id)
                return {"ok": True, "hidden": True}
        except Exception as err:
            log.warning("Idea report failed: %s", err)
        return {"ok": True}

    @app.post("/api/ideas/remove")
    async def ideas_remove(data: IdeaRemove):
        admin = g["ADMIN_KEY"]
        if not (admin and hmac.compare_digest(data.key, admin)):
            raise HTTPException(403, "Not allowed.")
        await drop(data.id)
        return {"ok": True}
