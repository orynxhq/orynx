"""
Red flag scanner: paste a token contract on Robinhood Chain and get a plain-English risk read.

Every check is read straight from the chain (contract code, owner, proxy slot, pons launch,
holder spread). The AI only explains the facts it is given; it never invents findings.
Installed from features.py via install(app, g).
"""
import asyncio
import json

import httpx
import re
import time

from fastapi import HTTPException, Request
from pydantic import BaseModel, Field

ZERO = "0x0000000000000000000000000000000000000000"
DEAD = "0x000000000000000000000000000000000000dead"
TOPIC_TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
SLOT_IMPL = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"  # EIP-1967 implementation slot
CACHE_SECONDS = 300
KEY_SYMBOL = "orynx:scan:symbols"  # ticker -> list of scanned contract addresses

# function selectors that give someone special power over the token
POWERS = {
    "mint": (["40c10f19"], "red", "Someone can mint new tokens",
             "The contract has a mint function. New supply can be created, which dilutes every holder."),
    "pause": (["8456cb59"], "red", "Transfers can be paused",
              "A pause switch can freeze trading, so you may not be able to sell."),
    "blacklist": (["fe575a87", "f9f92be4", "44337ea1", "153b0d1e", "455a4396", "9c0db5f3"], "red", "Wallets can be blocked",
                  "The contract can blacklist addresses, which can stop specific wallets from selling."),
    "fees": (["69fe0e2d", "061c82d0", "0b78f9c0", "0cc835a3", "8b4cee08", "6db79437", "c647b20e", "437823ec"], "amber",
             "Taxes can be changed", "Buy or sell fees can be changed after launch, so the cost to sell may rise."),
    "limits": (["ec28438a", "ea1644d5", "5d0044ca"], "amber", "Wallet or trade limits can be changed",
               "Max transaction or max wallet rules can be tightened later."),
    "trading": (["8a8c523c", "c9567bf9", "c2e5ec04"], "amber", "Trading has an on/off switch",
                "Someone controls when trading is enabled."),
    "upgrade": (["3659cfe6", "4f1ef286"], "red", "Contract code can be upgraded",
                "The logic behind the token can be swapped for new code."),
}

RULES_SCAN = """You are {NAME}, the resident AI dev at Orynx, reviewing a token for red flags before someone buys.
You get FACTS read from Robinhood Chain and FLAGS already computed from them.
Write a short, plain-English take (2 or 3 sentences, max 60 words): what matters most here and why.
Rules: only use the facts given, never invent numbers or findings, no price predictions, no "buy" or "sell" advice,
no hype. If data is missing, say what could not be checked. Dry, honest tone. Answer with the take only."""


class ScanRequest(BaseModel):
    token: str = Field(pattern=r"^0x[0-9a-fA-F]{40}$")


def _has(code: str, selector: str) -> bool:
    return ("63" + selector) in code


def install(app, g):
    chain = g["_chain"]
    rpc, redis, log = g["_rpc"], g["_redis"], g["log"]
    pad, word, text_abi = chain["pad"], chain["word"], chain["text_abi"]
    memo: dict = {}

    async def call(token: str, data: str) -> str:
        try:
            return await rpc("eth_call", [{"to": token, "data": data}, "latest"]) or "0x"
        except Exception:
            return "0x"

    async def holders_spread(token: str, start: int, skip: set, decimals: int, supply: float) -> dict | None:
        tip = await chain["block_latest"]()
        logs = await asyncio.wait_for(chain["log_window"](token, [TOPIC_TRANSFER], start, tip), 14)
        if len(logs) > 60000:
            return None
        bal: dict = {}
        for lg in logs:
            a, b = "0x" + lg["topics"][1][-40:], "0x" + lg["topics"][2][-40:]
            n = int(lg.get("data", "0x0") or "0x0", 16)
            bal[a] = bal.get(a, 0) - n
            bal[b] = bal.get(b, 0) + n
        dead = max(0, bal.get(DEAD, 0)) / 10 ** decimals
        rows = sorted(((v / 10 ** decimals) for a, v in bal.items() if v > 0 and a.lower() not in skip), reverse=True)
        if not supply:
            return None
        return {"count": len(rows), "top1": rows[0] / supply * 100 if rows else 0.0,
                "top10": sum(rows[:10]) / supply * 100 if rows else 0.0, "burned": dead / supply * 100}

    async def read_facts(token: str) -> dict:
        facts: dict = {"token": token, "checked": int(time.time()), "missing": []}
        code = (await rpc("eth_getCode", [token, "latest"]) or "0x").lower()
        facts["is_contract"] = len(code) > 2
        if not facts["is_contract"]:
            return facts
        facts["code_size"] = (len(code) - 2) // 2
        name = text_abi(await call(token, "0x06fdde03"))
        symbol = text_abi(await call(token, "0x95d89b41"))
        dec_raw = await call(token, "0x313ce567")
        sup_raw = await call(token, "0x18160ddd")
        facts["name"], facts["symbol"] = name[:40], symbol[:16]
        facts["is_token"] = len(sup_raw) > 2 and len(dec_raw) > 2
        decimals = int(dec_raw, 16) if len(dec_raw) > 2 else 18
        supply = int(sup_raw, 16) / 10 ** decimals if len(sup_raw) > 2 else 0.0
        facts["decimals"], facts["supply"] = decimals, supply
        facts["powers"] = [k for k, (sels, *_r) in POWERS.items() if any(_has(code, s) for s in sels)]
        # ownership
        if _has(code, "8da5cb5b"):
            raw = await call(token, "0x8da5cb5b")
            owner = ("0x" + raw[-40:]).lower() if len(raw) >= 42 else None
            facts["owner"] = owner
            facts["renounced"] = owner in (ZERO, DEAD)
        # proxy
        try:
            slot = await rpc("eth_getStorageAt", [token, SLOT_IMPL, "latest"])
            facts["proxy"] = bool(slot and int(slot, 16) != 0)
        except Exception:
            facts["missing"].append("proxy check")
        # pons launch
        info = None
        try:
            info = await asyncio.wait_for(chain["info_launch"](token), 12)
        except Exception:
            facts["missing"].append("pons launch lookup")
        facts["pons"] = bool(info)
        skip = {ZERO, DEAD, chain["PONS_V2"].lower()}
        if info:
            skip |= {info["curve"].lower(), info["pair"].lower()}
            try:
                bond = await chain["bonding_token"](token)
                if bond:
                    facts["bonding"] = {"percent": round(bond["percent"], 1), "graduated": bool(bond["graduated"])}
            except Exception:
                facts["missing"].append("bonding progress")
            try:
                ts = await chain["time_block"](hex(info["block"]))
                if ts:
                    facts["age_hours"] = round((time.time() - ts) / 3600, 1)
            except Exception:
                pass
            try:
                spread = await holders_spread(token, info["block"], skip, decimals, supply)
                if spread:
                    facts["holders"] = spread
                else:
                    facts["missing"].append("holder spread (too much history)")
            except Exception:
                facts["missing"].append("holder spread")
        else:
            facts["missing"].append("holder spread (only read for pons launches)")
        return facts

    def flags_for(f: dict) -> tuple[list, int]:
        out: list = []
        if not f.get("is_contract"):
            return [{"level": "red", "title": "Not a contract", "detail": "There is no code at this address on Robinhood Chain. It is not a token."}], 100
        if not f.get("is_token"):
            out.append({"level": "red", "title": "Not a standard token", "detail": "It does not answer basic ERC-20 calls like total supply and decimals."})
        for k in f.get("powers", []):
            _s, level, title, detail = POWERS[k]
            if f.get("renounced") and k != "upgrade":
                level = "amber" if level == "red" else level
                detail += " Ownership is renounced, so this likely can't be used anymore."
            out.append({"level": level, "title": title, "detail": detail})
        if f.get("proxy"):
            out.append({"level": "red", "title": "Upgradeable proxy", "detail": "The token points to separate logic that can be replaced."})
        if "owner" in f:
            if f.get("renounced"):
                out.append({"level": "green", "title": "Ownership renounced", "detail": "The owner is the zero or dead address."})
            elif f.get("powers"):
                out.append({"level": "amber", "title": "An owner still holds control", "detail": f"Owner wallet: {f['owner']}."})
        if f.get("pons"):
            b = f.get("bonding") or {}
            note = (" It has graduated to a locked Uniswap v4 pool." if b.get("graduated")
                    else f" Bonding curve {b['percent']}% filled." if "percent" in b else "")
            out.append({"level": "green", "title": "Launched on pons", "detail": "Created by the pons launchpad contract on Robinhood Chain." + note})
        if not f.get("powers") and not f.get("proxy") and f.get("is_token"):
            out.append({"level": "green", "title": "No special powers found", "detail": "No mint, pause, blacklist, tax or upgrade functions were found in the code."})
        h = f.get("holders")
        if h:
            if h["top1"] >= 20:
                out.append({"level": "red", "title": "One wallet holds a lot", "detail": f"The biggest holder has {h['top1']:.1f}% of supply (pool and burn excluded)."})
            elif h["top1"] >= 8:
                out.append({"level": "amber", "title": "Big top holder", "detail": f"The biggest holder has {h['top1']:.1f}% of supply."})
            if h["top10"] >= 50:
                out.append({"level": "amber", "title": "Supply is concentrated", "detail": f"The top 10 wallets hold {h['top10']:.1f}% of supply."})
            if h["count"] < 25:
                out.append({"level": "amber", "title": "Very few holders", "detail": f"Only {h['count']} wallets hold it right now."})
            elif h["top1"] < 8 and h["top10"] < 50:
                out.append({"level": "green", "title": "Healthy holder spread", "detail": f"{h['count']} holders, top 10 hold {h['top10']:.1f}%."})
            if h["burned"] >= 0.5:
                out.append({"level": "green", "title": "Supply has been burned", "detail": f"{h['burned']:.2f}% sits in the dead address."})
        if f.get("age_hours") is not None and f["age_hours"] < 24:
            out.append({"level": "amber", "title": "Brand new", "detail": f"Launched {f['age_hours']} hours ago. Very little track record."})
        score = 0
        for x in out:
            score += {"red": 30, "amber": 12, "green": -8}[x["level"]]
        score = max(0, min(100, score + 20))
        order = {"red": 0, "amber": 1, "green": 2}
        out.sort(key=lambda x: order[x["level"]])
        return out, score

    @app.get("/api/scan")
    async def scan_get(request: Request, token: str = ""):
        if not re.fullmatch(r"0x[0-9a-fA-F]{40}", token or ""):
            raise HTTPException(400, "Add ?token= with a 0x contract address.")
        return await run_scan(token.lower(), request)

    async def scan_quiet(token: str) -> dict | None:
        """Scan without a visitor quota or an AI take, for mini sites. Shares the scan cache."""
        token = token.lower()
        hit = memo.get(token)
        if hit and time.time() - hit[1] < CACHE_SECONDS:
            return hit[0]
        try:
            raw = await redis("GET", "orynx:scan:" + token)
            if raw:
                res = json.loads(raw)
                memo[token] = (res, time.time())
                return res
        except Exception:
            pass
        try:
            facts = await read_facts(token)
        except Exception as err:
            log.warning("Quiet scan failed: %s", err)
            return None
        flags, score = flags_for(facts)
        verdict = "high" if score >= 60 else "medium" if score >= 30 else "low"
        res = {"token": token, "name": facts.get("name", ""), "symbol": facts.get("symbol", ""), "verdict": verdict,
               "score": score, "flags": flags, "take": "", "facts": facts}
        memo[token] = (res, time.time())
        try:
            await redis("SET", "orynx:scan:" + token, json.dumps(res), "EX", str(CACHE_SECONDS))
        except Exception:
            pass
        return res

    g["scan_quiet"] = scan_quiet

    @app.get("/api/scan/find")
    async def scan_find(q: str = ""):
        """Turn a ticker like $ORYNX into contract addresses on Robinhood Chain."""
        sym = re.sub(r"[^A-Za-z0-9]", "", q or "").upper()[:16]
        if not sym:
            raise HTTPException(400, "Add ?q= with a ticker.")
        found: dict = {}
        own = g.get("ORYNX_TOKEN") or ""
        if own and sym == "ORYNX":
            found[own] = {"token": own, "name": "Orynx", "symbol": "ORYNX", "liquidity": None, "source": "orynx"}
        try:
            known = await redis("HGET", KEY_SYMBOL, sym)
            for a in json.loads(known or "[]"):
                found.setdefault(a, {"token": a, "name": "", "symbol": sym, "liquidity": None, "source": "scanned"})
        except Exception:
            pass
        try:
            async with httpx.AsyncClient(timeout=6) as client:
                r = await client.get("https://api.dexscreener.com/latest/dex/search", params={"q": sym})
                pairs = r.json().get("pairs") or []
            for p in pairs:
                b = p.get("baseToken") or {}
                if p.get("chainId") != "robinhood" or (b.get("symbol") or "").upper() != sym:
                    continue
                a = (b.get("address") or "").lower()
                if not re.fullmatch(r"0x[0-9a-f]{40}", a):
                    continue
                liq = float((p.get("liquidity") or {}).get("usd") or 0)
                cur = found.get(a)
                if cur is None:
                    found[a] = {"token": a, "name": (b.get("name") or "")[:40], "symbol": sym, "liquidity": liq, "source": "dexscreener"}
                else:
                    cur["name"] = cur["name"] or (b.get("name") or "")[:40]
                    cur["liquidity"] = max(cur["liquidity"] or 0, liq)
        except Exception as err:
            log.warning("Ticker search failed: %s", err)
        out = sorted(found.values(), key=lambda x: (x["source"] != "orynx", -(x["liquidity"] or 0)))
        return {"symbol": sym, "matches": out[:5]}

    async def remember_symbol(symbol: str, token: str):
        sym = re.sub(r"[^A-Za-z0-9]", "", symbol or "").upper()[:16]
        if not sym:
            return
        try:
            have = json.loads(await redis("HGET", KEY_SYMBOL, sym) or "[]")
            if token not in have:
                await redis("HSET", KEY_SYMBOL, sym, json.dumps((have + [token])[-5:]))
        except Exception:
            pass

    @app.post("/api/scan")
    async def scan(data: ScanRequest, request: Request):
        return await run_scan(data.token.lower(), request)

    async def run_scan(token: str, request: Request):
        hit = memo.get(token)
        if hit and time.time() - hit[1] < CACHE_SECONDS:
            return hit[0]
        try:
            raw = await redis("GET", "orynx:scan:" + token)
            if raw:
                res = json.loads(raw)
                memo[token] = (res, time.time())
                return res
        except Exception:
            pass
        who, holder = await g["who_and_holder"](request)
        g["check_limit"](who, "scan", holder)
        try:
            facts = await read_facts(token)
        except Exception as err:
            log.warning("Scan failed: %s", err)
            raise HTTPException(502, "Couldn't read that contract from Robinhood Chain right now. Try again in a minute.")
        flags, score = flags_for(facts)
        verdict = "high" if score >= 60 else "medium" if score >= 30 else "low"
        take = ""
        if g["client_ai"] and facts.get("is_contract"):
            try:
                take = (await g["ask_ai"](g["MODEL_TEXT"], RULES_SCAN.replace("{NAME}", g["NAME_BOT"]),
                                          "FACTS:\n" + json.dumps(facts) + "\n\nFLAGS:\n" + json.dumps(flags) +
                                          f"\n\nRisk score {score}/100 ({verdict}).", 220, timeout=40)).strip()
            except Exception as err:
                log.warning("Scan take failed: %s", err)
        res = {"token": token, "name": facts.get("name", ""), "symbol": facts.get("symbol", ""), "verdict": verdict,
               "score": score, "flags": flags, "take": take[:600], "facts": facts}
        g["add_usage"](who, "scan")
        try:
            await redis("INCR", "orynx:count:scans")
        except Exception:
            pass
        await remember_symbol(res["symbol"], token)
        memo[token] = (res, time.time())
        try:
            await redis("SET", "orynx:scan:" + token, json.dumps(res), "EX", str(CACHE_SECONDS))
        except Exception:
            pass
        return res
