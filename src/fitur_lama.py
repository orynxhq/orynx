"""
Fitur tambahan Orynx: burn tracker, referral, remix, dan launch thread.
Dipasang dari app.py lewat pasang(app, globals()).
"""

import asyncio
import hashlib
import hmac
import json
import re
import time

from fastapi import HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field

DEAD = "0x000000000000000000000000000000000000dead"
TOPIK_TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"

# Burn yang sudah pasti (dipakai kalau RPC tidak bisa membaca riwayat)
BURN_TERCATAT = [
    {"tx": "0x363e8db50cea756a32fd646d5b58408e82a8429063bd721a0d90cf814c995bce", "jumlah": 3_000_000, "waktu": 1795621620},
]

SKEMA_THREAD = {
    "type": "object",
    "properties": {"thread": {"type": "array", "items": {"type": "string"}}},
    "required": ["thread"],
}

TUGAS_THREAD = """Write a 5-post launch-day thread for X and put it in "thread" (exactly 5 strings):
1. The launch announcement: a scroll-stopping hook, the $TICKER, and that it is live on pons, Robinhood Chain.
2. The story: what it is or the meme's lore, told so people want to be part of it.
3. How to get it: search the ticker on pons (ponsfamily.com) on Robinhood Chain. No price talk.
4. The contract address post: use the exact placeholder [CA] where the address goes, plus a line telling people to only trust this address.
5. The community call: follow, join the Telegram, and one question people want to answer.
Each post under 260 characters, max 1 emoji, no hashtags. Never promise profits, returns or price moves.
Deliver it by calling the kirim_thread tool."""


class PermintaanThread(BaseModel):
    mode: str = "ai"
    sig: str = Field(min_length=10, max_length=64)
    nama: str = Field(default="", max_length=60)
    ticker: str = Field(default="", max_length=8)
    tagline: str = Field(default="", max_length=120)
    roast: str = Field(default="", max_length=2000)
    deskripsi: str = Field(default="", max_length=1500)
    fitur: list[str] = Field(default_factory=list, max_length=3)


class PermintaanRef(BaseModel):
    ref: str = Field(min_length=3, max_length=20)


class PermintaanBurn(BaseModel):
    tx: str = Field(pattern=r"^0x[0-9a-fA-F]{64}$")
    jumlah: float = Field(gt=0)
    kunci: str = Field(min_length=8, max_length=200)


def rapikan_ref(teks: str) -> str:
    return re.sub(r"[^a-z0-9_]", "", (teks or "").lower().lstrip("@"))[:20]


def pasang(app, g):
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

    def _pad(alamat: str) -> str:
        return "0x" + alamat.lower()[2:].rjust(64, "0")

    def _kata(hexdata: str, i: int) -> int:
        h = hexdata[2:]
        return int(h[i * 64:(i + 1) * 64] or "0", 16)

    LEBAR = 9_000_000

    async def _blok_terbaru() -> int:
        return int(await _rpc("eth_blockNumber", []), 16)

    async def _log_jendela(alamat: str, topik: list, dari: int, sampai: int | None = None) -> list:
        if sampai is None:
            sampai = await _blok_terbaru()
        hasil, a = [], max(0, dari)
        while a <= sampai:
            b = min(sampai, a + LEBAR - 1)
            hasil += await _rpc("eth_getLogs", [{"fromBlock": hex(a), "toBlock": hex(b), "address": alamat, "topics": topik}]) or []
            a = b + 1
        return hasil

    async def _info_luncur(token: str | None = None) -> dict | None:
        """Cari event TokenLaunched pons V2 untuk sebuah token, mundur per jendela blok. Hasil disimpan permanen."""
        token = (token or g["ORYNX_TOKEN"]).lower()
        kc = "luncur:" + token
        if _cache.get(kc):
            return _cache[kc]
        try:
            lama = await _redis("GET", "orynx:luncur:" + token)
            if lama:
                _cache[kc] = json.loads(lama)
                return _cache[kc]
        except Exception:
            pass
        if time.time() - _cache.get("gagal:" + token, 0) < 600:
            return None
        akhir = await _blok_terbaru()
        for _ in range(16):
            awal = max(0, akhir - LEBAR + 1)
            logs = await _rpc("eth_getLogs", [{"fromBlock": hex(awal), "toBlock": hex(akhir), "address": PONS_V2,
                                              "topics": [T_LAUNCH, _pad(token)]}]) or []
            if logs:
                lg = logs[0]
                info = {"blok": int(lg["blockNumber"], 16), "kurva": "0x" + lg["topics"][2][-40:],
                        "pair": "0x" + lg["data"][2:66][-40:], "ambang": _kata(lg["data"], 2)}
                _cache[kc] = info
                try:
                    await _redis("SET", "orynx:luncur:" + token, json.dumps(info))
                except Exception:
                    pass
                return info
            if awal == 0:
                break
            akhir = awal - 1
        _cache["gagal:" + token] = time.time()
        return None

    # ------------------------------------------------------------------ burn
    async def _desimal() -> int:
        if "des" not in _cache:
            hasil = await _rpc("eth_call", [{"to": g["ORYNX_TOKEN"], "data": "0x313ce567"}, "latest"])
            _cache["des"] = int(hasil, 16) if hasil not in ("0x", "") else 18
        return _cache["des"]

    async def _riwayat_burn(des: int) -> list[dict]:
        try:
            luncur = await _info_luncur()
            dari = luncur["blok"] if luncur else max(0, await _blok_terbaru() - LEBAR + 1)
            logs = await _log_jendela(g["ORYNX_TOKEN"], [TOPIK_TRANSFER, None, "0x" + DEAD[2:].rjust(64, "0")], dari)
            hasil = []
            for lg in logs[-30:]:
                jumlah = int(lg.get("data", "0x0"), 16) / 10 ** des
                waktu = 0
                try:
                    blok = await _rpc("eth_getBlockByNumber", [lg["blockNumber"], False])
                    waktu = int(blok["timestamp"], 16)
                except Exception:
                    pass
                hasil.append({"tx": lg["transactionHash"], "jumlah": jumlah, "waktu": waktu})
            if hasil:
                return list(reversed(hasil))
        except Exception as err:
            log.warning("Riwayat burn dari RPC gagal: %s", err)
        tercatat = list(BURN_TERCATAT)
        try:
            for baris in await _redis("LRANGE", "orynx:burns", "0", "49") or []:
                tercatat.append(json.loads(baris))
        except Exception:
            pass
        unik = {b["tx"].lower(): b for b in tercatat}
        return sorted(unik.values(), key=lambda b: -b.get("waktu", 0))

    @app.get("/api/burn")
    async def info_burn():
        if not g["GATING_AKTIF"]:
            return {"aktif": False}
        simpan = _cache.get("burn")
        if simpan and time.time() - simpan[1] < 120:
            return simpan[0]
        try:
            des = await _desimal()
            data = "0x70a08231" + DEAD[2:].rjust(64, "0")
            mati = int(await _rpc("eth_call", [{"to": g["ORYNX_TOKEN"], "data": data}, "latest"]) or "0x0", 16) / 10 ** des
            supply = int(await _rpc("eth_call", [{"to": g["ORYNX_TOKEN"], "data": "0x18160ddd"}, "latest"]) or "0x0", 16) / 10 ** des
            riwayat = await _riwayat_burn(des)
        except Exception as err:
            log.warning("Info burn gagal: %s", err)
            if simpan:
                return simpan[0]
            raise HTTPException(502, "Couldn't read the chain right now.")
        hasil = {"aktif": True, "burned": mati, "supply": supply, "persen": (mati / supply * 100) if supply else 0,
                 "dead": DEAD, "token": g["ORYNX_TOKEN"], "riwayat": riwayat[:20]}
        _cache["burn"] = (hasil, time.time())
        return hasil

    @app.post("/api/burn/tambah")
    async def tambah_burn(data: PermintaanBurn):
        kunci = g["ADMIN_KEY"]
        if not kunci or not hmac.compare_digest(data.kunci, kunci):
            raise HTTPException(403, "Not allowed.")
        await _redis("LPUSH", "orynx:burns", json.dumps({"tx": data.tx.lower(), "jumlah": data.jumlah, "waktu": int(time.time())}))
        _cache.pop("burn", None)
        return {"ok": True}

    # -------------------------------------------------------------- referral
    @app.post("/api/ref/hit")
    async def ref_hit(data: PermintaanRef, request: Request):
        ref = rapikan_ref(data.ref)
        if len(ref) < 3 or not (g["REDIS_URL"] and g["REDIS_TOKEN"]):
            return {"ok": False}
        siapa = hashlib.sha256(("ref:" + g["id_pengunjung"](request)).encode()).hexdigest()[:20]
        try:
            baru = await _redis("SET", f"orynx:refseen:{siapa}", ref, "NX", "EX", "2592000")
            if baru is None:
                return {"ok": True, "baru": False}
            minggu = f"orynx:ref:{g['minggu_ini']()}"
            await _redis("ZINCRBY", minggu, "1", ref)
            await _redis("EXPIRE", minggu, "1814400")
            await _redis("ZINCRBY", "orynx:ref:all", "1", ref)
        except Exception as err:
            log.warning("Referral gagal: %s", err)
            return {"ok": False}
        _cache.pop("reftop", None)
        return {"ok": True, "baru": True}

    @app.get("/api/ref/top")
    async def ref_top(saya: str = ""):
        if not (g["REDIS_URL"] and g["REDIS_TOKEN"]):
            return {"aktif": False, "top": []}
        simpan = _cache.get("reftop")
        if simpan and time.time() - simpan[1] < 30:
            top = simpan[0]
        else:
            try:
                mentah = await _redis("ZREVRANGE", f"orynx:ref:{g['minggu_ini']()}", "0", "9", "WITHSCORES") or []
                top = [{"ref": mentah[i], "jumlah": int(float(mentah[i + 1]))} for i in range(0, len(mentah), 2)]
            except Exception:
                top = []
            _cache["reftop"] = (top, time.time())
        hasil = {"aktif": True, "top": top}
        saya = rapikan_ref(saya)
        if len(saya) >= 3:
            try:
                n = await _redis("ZSCORE", f"orynx:ref:{g['minggu_ini']()}", saya)
                total = await _redis("ZSCORE", "orynx:ref:all", saya)
                hasil["saya"] = {"ref": saya, "minggu": int(float(n or 0)), "total": int(float(total or 0))}
            except Exception:
                pass
        return hasil

    # ----------------------------------------------------------------- remix
    @app.get("/api/item/{id_item}")
    async def item(id_item: str):
        it = await g["ambil_item"](id_item)
        if not it:
            raise HTTPException(404, "Not found")
        return it

    # ---------------------------------------------------------- launch thread
    @app.post("/api/thread")
    async def thread(data: PermintaanThread, request: Request):
        klien = g["klien_ai"]
        if not klien:
            raise HTTPException(503, "Orynx isn't switched on yet. Please check back soon.")
        mode = "meme" if data.mode == "meme" else "ai"
        if not hmac.compare_digest(g["tanda_konten"]("kit", data.nama, data.ticker, data.tagline, data.roast, mode), data.sig):
            raise HTTPException(400, "Build a kit on Orynx first, then write its launch thread.")
        siapa, holder = await g["siapa_dan_holder"](request)
        g["cek_batas"](siapa, "ulang", holder)
        konteks = json.dumps({"name": data.nama, "ticker": data.ticker, "tagline": data.tagline,
                              "description": data.deskripsi, "points": data.fitur}, ensure_ascii=False)
        aturan = g["ATURAN_TEKS_MEME"] if mode == "meme" else g["ATURAN_TEKS"]
        sistem = g["PERSONA"] + "\n\n" + aturan + "\n\nRight now you are writing the LAUNCH-DAY THREAD for an existing kit, in the same voice."
        hasil = None
        for _ in range(2):
            try:
                respons = await klien.messages.create(
                    model=g["MODEL_TEKS"], max_tokens=1500, system=sistem,
                    messages=[{"role": "user", "content": f"Kit: {konteks}\n\n{TUGAS_THREAD}"}],
                    tools=[{"name": "kirim_thread", "description": "Return the 5-post thread.", "input_schema": SKEMA_THREAD}],
                    tool_choice={"type": "auto"},
                )
                for b in respons.content:
                    if b.type == "tool_use" and isinstance(b.input, dict):
                        hasil = b.input.get("thread")
                if not hasil:
                    hasil = g["ambil_json"]("".join(b.text for b in respons.content if b.type == "text")).get("thread")
                hasil = [str(x).strip() for x in (hasil or []) if str(x).strip()][:5]
                if len(hasil) >= 3:
                    break
                hasil = None
            except Exception as err:
                log.warning("Thread gagal: %s", err)
                hasil = None
        if not hasil:
            raise HTTPException(502, "Si Dev drew a blank. Try again (this didn't use your quota).")
        g["tambah_pemakaian"](siapa, "ulang")
        return {"thread": hasil, "sisa": max(0, g["batas_ulang"](holder) - g["pemakaian"](siapa, "ulang"))}

    # ------------------------------------------------------------- bonding
    async def _log_pons(topik: str, token: str, dari: int) -> list:
        return await _log_jendela(PONS_V2, [topik, _pad(token)], dari)

    async def _bonding_v2(token: str, catatan: list) -> dict | None:
        info = await _info_luncur(token)
        if not info:
            catatan.append("v2: no TokenLaunched log")
            return None
        kurva = info["kurva"]
        if token.lower() == g["ORYNX_TOKEN"].lower():
            kurva = g["os"].getenv("ORYNX_CURVE", "").strip().lower() or kurva
        lulus = bool(_cache.get("lulus:" + token.lower()))
        if not lulus:
            try:
                lulus = bool(await _log_pons(T_SWEPT, token, info["blok"])) or bool(await _log_pons(T_GRAD, token, info["blok"]))
                if lulus:
                    _cache["lulus:" + token.lower()] = True
            except Exception as err:
                catatan.append(f"v2 grad check: {err}"[:200])
        if int(info["pair"], 16) == 0:
            saat_ini = int(await _rpc("eth_getBalance", [kurva, "latest"]), 16)
        else:
            saat_ini = int(await _rpc("eth_call", [{"to": info["pair"], "data": "0x70a08231" + _pad(kurva)[2:]}, "latest"]) or "0x0", 16)
        return {"versi": 2, "saat_ini": saat_ini / 1e18, "ambang": info["ambang"] / 1e18, "lulus": lulus,
                "kurva": kurva, "pair": info["pair"]}

    async def _bonding_status(pabrik: str, token: str, versi: int) -> dict | None:
        hasil = await _rpc("eth_call", [{"to": pabrik, "data": SEL_STATUS + _pad(token)[2:]}, "latest"])
        if not hasil or len(hasil) < 2 + 64 * 3:
            return None
        ambang = _kata(hasil, 1)
        if not ambang:
            return None
        return {"versi": versi, "saat_ini": _kata(hasil, 0) / 1e18, "ambang": ambang / 1e18, "lulus": bool(_kata(hasil, 2))}

    @app.get("/api/bonding")
    async def bonding(debug: str = ""):
        if not g["GATING_AKTIF"]:
            return {"ada": False}
        simpan = _cache.get("bonding")
        if simpan and time.time() - simpan[1] < 45 and not debug:
            return simpan[0]
        token = g["ORYNX_TOKEN"]
        catatan: list = []
        data = None
        for coba in (lambda: _bonding_v2(token, catatan),
                     lambda: _bonding_status(PONS_V2, token, 2),
                     lambda: _bonding_status(PONS_V1, token, 1)):
            try:
                data = await coba()
            except Exception as err:
                catatan.append(str(err)[:200])
                data = None
            if data:
                break
        if not data:
            if simpan:
                return simpan[0]
            hasil = {"ada": False, "catatan": [c[:120] for c in catatan][:4]}
        else:
            persen = 100.0 if data["lulus"] else max(0.0, min(100.0, data["saat_ini"] / data["ambang"] * 100))
            hasil = {"ada": True, "persen": round(persen, 2), "saat_ini": data["saat_ini"], "ambang": data["ambang"],
                     "lulus": data["lulus"], "versi": data["versi"]}
            _cache["bonding"] = (hasil, time.time())
        kunci = g["ADMIN_KEY"]
        if debug and kunci and hmac.compare_digest(debug, kunci):
            return {**hasil, "catatan": catatan, "detail": data}
        return hasil

    # -------------------------------------------------------------- favicon
    def _svg_ikon(rx: int, skala: float = 1.0) -> str:
        t = f'translate(256 256) scale({skala}) translate(-256 -256)'
        return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">'
                f'<rect width="512" height="512" rx="{rx}" fill="#000"/><g transform="{t}">'
                '<circle cx="256" cy="256" r="150" fill="none" stroke="#fff" stroke-width="54"/>'
                '<circle cx="362.1" cy="149.9" r="62" fill="#000"/><circle cx="362.1" cy="149.9" r="34" fill="#fff"/></g></svg>')

    _ikon: dict = {}

    def _png(kunci: str, ukuran: int, rx: int, skala: float = 1.0) -> bytes:
        if kunci not in _ikon:
            _ikon[kunci] = g["svg_ke_png"](_svg_ikon(rx, skala), ukuran)
        return _ikon[kunci]

    def _ico() -> bytes:
        if "ico" not in _ikon:
            gambar = [(16, _png("p16", 16, 110)), (32, _png("p32", 32, 110)), (48, _png("p48", 48, 110))]
            kepala = (0).to_bytes(2, "little") + (1).to_bytes(2, "little") + len(gambar).to_bytes(2, "little")
            dir_, isi, off = b"", b"", 6 + 16 * len(gambar)
            for u, data in gambar:
                dir_ += bytes([u, u, 0, 0]) + (1).to_bytes(2, "little") + (32).to_bytes(2, "little") + len(data).to_bytes(4, "little") + off.to_bytes(4, "little")
                isi += data
                off += len(data)
            _ikon["ico"] = kepala + dir_ + isi
        return _ikon["ico"]

    SIMPAN_LAMA = {"Cache-Control": "public, max-age=86400, s-maxage=604800"}

    @app.get("/favicon.ico", include_in_schema=False)
    async def favicon_ico():
        return Response(_ico(), media_type="image/x-icon", headers=SIMPAN_LAMA)

    @app.get("/favicon.svg", include_in_schema=False)
    async def favicon_svg():
        return Response(_svg_ikon(110), media_type="image/svg+xml", headers=SIMPAN_LAMA)

    @app.get("/favicon-32.png", include_in_schema=False)
    async def favicon_32():
        return Response(_png("p32", 32, 110), media_type="image/png", headers=SIMPAN_LAMA)

    @app.get("/apple-touch-icon.png", include_in_schema=False)
    @app.get("/apple-touch-icon-precomposed.png", include_in_schema=False)
    async def ikon_apple():
        return Response(_png("p180", 180, 0, 0.86), media_type="image/png", headers=SIMPAN_LAMA)

    @app.get("/icon-192.png", include_in_schema=False)
    async def ikon_192():
        return Response(_png("p192", 192, 0, 0.86), media_type="image/png", headers=SIMPAN_LAMA)

    @app.get("/icon-512.png", include_in_schema=False)
    async def ikon_512():
        return Response(_png("p512", 512, 0, 0.86), media_type="image/png", headers=SIMPAN_LAMA)

    @app.get("/site.webmanifest", include_in_schema=False)
    async def manifest():
        data = {"name": "Orynx", "short_name": "Orynx", "description": "AI launch kits for pons on Robinhood Chain.",
                "start_url": "/", "display": "standalone", "background_color": "#000000", "theme_color": "#000000",
                "icons": [{"src": "/icon-192.png", "sizes": "192x192", "type": "image/png"},
                          {"src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable"}]}
        return Response(json.dumps(data), media_type="application/manifest+json", headers=SIMPAN_LAMA)

    # ------------------------------------------------------- holders + feed
    NOL = "0x0000000000000000000000000000000000000000"

    def _alamat(topik: str) -> str:
        return "0x" + topik[-40:].lower()

    async def _waktu_blok(nomor: str) -> int:
        kunci = "blk:" + nomor
        if kunci not in _cache:
            try:
                _cache[kunci] = int((await _rpc("eth_getBlockByNumber", [nomor, False]))["timestamp"], 16)
            except Exception:
                return 0
        return _cache[kunci]

    @app.get("/api/holders")
    async def holders():
        if not g["GATING_AKTIF"]:
            return {"ada": False}
        simpan = _cache.get("holders")
        if simpan and time.time() - simpan[1] < 60:
            return simpan[0]
        token = g["ORYNX_TOKEN"].lower()
        try:
            info = await _info_luncur(token)
            if not info:
                raise RuntimeError("launch not found")
            des = await _desimal()
            st = _cache.setdefault("saldo", {"blok": info["blok"] - 1, "saldo": {}, "log": []})
            ujung = await _blok_terbaru()
            if ujung > st["blok"]:
                baru = await _log_jendela(token, [TOPIK_TRANSFER], st["blok"] + 1, ujung)
                for lg in baru:
                    dari, ke = _alamat(lg["topics"][1]), _alamat(lg["topics"][2])
                    n = int(lg.get("data", "0x0") or "0x0", 16)
                    st["saldo"][dari] = st["saldo"].get(dari, 0) - n
                    st["saldo"][ke] = st["saldo"].get(ke, 0) + n
                    st["log"].append({"dari": dari, "ke": ke, "n": n, "tx": lg["transactionHash"], "blok": lg["blockNumber"]})
                st["log"] = st["log"][-40:]
                st["blok"] = ujung
            kurva = info["kurva"].lower()
            kecuali = {NOL, DEAD, kurva, PONS_V2}
            jumlah = sum(1 for a, v in st["saldo"].items() if v > 0 and a not in kecuali)
            grup: dict = {}
            for lg in st["log"]:
                if lg["dari"] != NOL:
                    grup.setdefault(lg["tx"], []).append(lg)
            feed = []
            for tx in reversed(list(grup)):
                L = grup[tx]
                bakar = [x for x in L if x["ke"] == DEAD]
                beli = [x for x in L if x["dari"] == kurva]
                jual = [x for x in L if x["ke"] == kurva]
                if bakar:
                    jenis, siapa, n = "burn", L[0]["dari"], sum(x["n"] for x in bakar)
                elif beli:
                    jenis, siapa, n = "buy", L[-1]["ke"], sum(x["n"] for x in beli)
                elif jual:
                    jenis, siapa, n = "sell", L[0]["dari"], sum(x["n"] for x in jual)
                else:
                    jenis, siapa, n = "transfer", L[-1]["ke"], max(x["n"] for x in L)
                feed.append({"jenis": jenis, "siapa": siapa, "jumlah": n / 10 ** des, "tx": tx,
                             "waktu": await _waktu_blok(L[-1]["blok"])})
                if len(feed) >= 10:
                    break
        except Exception as err:
            log.warning("Holders gagal: %s", err)
            if simpan:
                return simpan[0]
            return {"ada": False}
        hasil = {"ada": True, "holders": jumlah, "feed": feed}
        _cache["holders"] = (hasil, time.time())
        return hasil

    # ------------------------------------------------------- kit of the day
    @app.get("/api/kotd")
    async def kit_hari_ini():
        if not (g["REDIS_URL"] and g["REDIS_TOKEN"]):
            return {"ada": False}
        hari = g["hari_ini"]()
        simpan = _cache.get("kotd")
        if simpan and simpan[1] == hari and time.time() - simpan[2] < 60:
            return simpan[0]
        try:
            pilih = await _redis("GET", f"orynx:kotd:{hari}")
            if not pilih:
                mentah = await _redis("LRANGE", "orynx:galeri", "0", "299") or []
                items = []
                for baris in mentah:
                    try:
                        items.append(json.loads(baris))
                    except Exception:
                        pass
                if not items:
                    return {"ada": False}
                pernah = set(await _redis("SMEMBERS", "orynx:kotd:pernah") or [])
                ids = [it["id"] for it in items]
                suka = await _redis("HMGET", "orynx:suka", *ids) or []
                skor = {i: int(n or 0) for i, n in zip(ids, suka)}
                kini = time.time()
                calon = [it for it in items if it["id"] not in pernah and kini - it.get("t", 0) < 7 * 86400] \
                    or [it for it in items if it["id"] not in pernah] or items
                calon.sort(key=lambda it: (skor.get(it["id"], 0), it.get("t", 0)), reverse=True)
                pilih = calon[0]["id"]
                await _redis("SET", f"orynx:kotd:{hari}", pilih, "EX", "172800")
                await _redis("SADD", "orynx:kotd:pernah", pilih)
            it = await g["ambil_item"](pilih)
            if not it:
                await _redis("DEL", f"orynx:kotd:{hari}")
                return {"ada": False}
            n = await _redis("HGET", "orynx:suka", pilih)
            hasil = {"ada": True, "tanggal": hari, "item": {**it, "suka": int(n or 0)}}
        except Exception as err:
            log.warning("Kit of the day gagal: %s", err)
            return simpan[0] if simpan else {"ada": False}
        _cache["kotd"] = (hasil, hari, time.time())
        return hasil

    # ------------------------------------------------- early access + badge
    EARLY = {"badge": {"nama": "Embed badge", "publik": 1795885200}}

    def _terbuka(fitur: str) -> bool:
        return time.time() >= EARLY[fitur]["publik"]

    @app.get("/api/early")
    async def early():
        return {"fitur": [{"id": k, "nama": v["nama"], "publik": v["publik"], "terbuka": _terbuka(k)} for k, v in EARLY.items()]}

    def _teks_abi(hexdata: str) -> str:
        try:
            h = hexdata[2:]
            if len(h) >= 128:
                n = int(h[64:128], 16)
                return bytes.fromhex(h[128:128 + n * 2]).decode("utf-8", "ignore")
            return bytes.fromhex(h[:64]).rstrip(b"\x00").decode("utf-8", "ignore")
        except Exception:
            return ""

    async def _info_token(token: str) -> dict:
        kunci = "tok:" + token
        if kunci not in _cache:
            nama = _teks_abi(await _rpc("eth_call", [{"to": token, "data": "0x06fdde03"}, "latest"]) or "0x")
            simbol = _teks_abi(await _rpc("eth_call", [{"to": token, "data": "0x95d89b41"}, "latest"]) or "0x")
            _cache[kunci] = {"nama": nama[:40], "simbol": simbol[:12]}
        return _cache[kunci]

    async def _bonding_token(token: str) -> dict | None:
        kunci = "bt:" + token
        simpan = _cache.get(kunci)
        if simpan and time.time() - simpan[1] < 60:
            return simpan[0]
        data = await _bonding_v2(token, [])
        if data:
            data["persen"] = 100.0 if data["lulus"] else max(0.0, min(100.0, data["saat_ini"] / data["ambang"] * 100))
            if len(_cache) > 2000:
                for k in [k for k in _cache if k.startswith("bt:")][:500]:
                    _cache.pop(k, None)
            _cache[kunci] = (data, time.time())
        return data

    class PermintaanBadge(BaseModel):
        token: str = Field(pattern=r"^0x[0-9a-fA-F]{40}$")

    def _tanda_badge(token: str) -> str:
        return g["tanda_konten"]("badge", token.lower())[:16]

    @app.post("/api/badge")
    async def buat_badge(data: PermintaanBadge, request: Request):
        token = data.token.lower()
        if not _terbuka("badge"):
            _, holder = await g["siapa_dan_holder"](request)
            if not holder:
                raise HTTPException(403, "Holders of 1M $ORYNX get the badge first. Everyone can use it from Nov 29.")
        try:
            info = await _info_luncur(token)
        except Exception:
            raise HTTPException(502, "Couldn't read Robinhood Chain right now. Try again in a minute.")
        if not info:
            raise HTTPException(400, "We couldn't find this token on pons. Check the contract address.")
        k = _tanda_badge(token)
        situs = g["SITUS"]
        kode = f'<script src="{situs}/badge.js" data-orynx="{token}" data-k="{k}" async></script>'
        return {"kode": kode, "url": f"{situs}/badge?t={token}&k={k}"}

    @app.get("/badge.js", include_in_schema=False)
    async def badge_js():
        js = ("(function(){var s=document.currentScript||document.querySelector('script[data-orynx]');if(!s)return;"
              "var f=document.createElement('iframe');f.src=s.src.replace(/\\/badge\\.js.*$/,'')+'/badge?t='+encodeURIComponent(s.dataset.orynx||'')+'&k='+encodeURIComponent(s.dataset.k||'');"
              "f.title='Orynx bonding badge';f.loading='lazy';f.style.cssText='border:0;width:100%;max-width:380px;height:132px;display:block;border-radius:18px;color-scheme:dark';"
              "s.parentNode.insertBefore(f,s.nextSibling);})();")
        return Response(js, media_type="application/javascript", headers={"Cache-Control": "public, max-age=3600"})

    @app.get("/badge", include_in_schema=False)
    async def badge(t: str = "", k: str = ""):
        situs = g["SITUS"]
        token = t.lower()
        ok = bool(re.fullmatch(r"0x[0-9a-f]{40}", token)) and hmac.compare_digest(k, _tanda_badge(token) if token else "x")
        isi = f'<a class="cta" href="{situs}" target="_blank" rel="noopener">Get your badge at orynxai.xyz</a>'
        if ok:
            try:
                info = await _info_token(token)
                b = await _bonding_token(token)
            except Exception:
                info, b = {"nama": "", "simbol": ""}, None
            import html as _html
            nama = _html.escape(info["nama"] or "Token")
            simbol = _html.escape(info["simbol"])
            if b:
                persen = b["persen"]
                ket = "Graduated to Uniswap v4" if b["lulus"] else f'{b["saat_ini"]:.3f} of {b["ambang"]:.2f} ETH on the pons curve'
            else:
                persen, ket = 0.0, "Bonding data is loading"
            isi = (f'<div class="top"><b>{nama}</b><span>{"$" + simbol if simbol else ""}</span><em>{persen:.1f}%</em></div>'
                   f'<div class="bar"><i style="width:{max(2.0, persen):.2f}%"></i></div>'
                   f'<div class="ft"><span>{ket}</span><a href="{situs}" target="_blank" rel="noopener">'
                   '<svg viewBox="0 0 512 512"><circle cx="256" cy="256" r="150" fill="none" stroke="#fff" stroke-width="54"/>'
                   '<circle cx="362.1" cy="149.9" r="62" fill="#0b0b0d"/><circle cx="362.1" cy="149.9" r="34" fill="#fff"/></svg>Built with Orynx</a></div>')
        halaman = ('<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
                   '<meta http-equiv="refresh" content="120"><title>Orynx badge</title><style>'
                   'html,body{margin:0;background:transparent;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#fff}'
                   '.card{box-sizing:border-box;height:132px;padding:16px 18px;border:1px solid #2c2c2c;border-radius:18px;background:#0b0b0d;display:flex;flex-direction:column;justify-content:center;gap:10px}'
                   '.top{display:flex;align-items:baseline;gap:8px}.top b{font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
                   '.top span{color:#8c8c8c;font-size:13px;font-weight:600}.top em{margin-left:auto;font-style:normal;font-weight:700;font-size:20px}'
                   '.bar{height:9px;border-radius:9px;background:#1c1c1c;overflow:hidden}.bar i{display:block;height:100%;border-radius:9px;background:linear-gradient(90deg,#8a8a8a,#fff)}'
                   '.ft{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:12px;color:#8c8c8c}'
                   '.ft a{display:inline-flex;align-items:center;gap:6px;color:#fff;text-decoration:none;font-weight:600;white-space:nowrap}.ft svg{width:16px;height:16px}'
                   '.cta{color:#fff;font-weight:600;text-decoration:none}</style></head>'
                   f'<body><div class="card">{isi}</div></body></html>')
        return Response(halaman, media_type="text/html", headers={"Cache-Control": "public, max-age=60, s-maxage=60"})

    @app.get("/fitur.js", include_in_schema=False)
    async def fitur_js():
        isi = (g["Path"](__file__).parent / "static" / "fitur.js").read_text(encoding="utf-8")
        return Response(isi, media_type="application/javascript", headers={"Cache-Control": "public, max-age=300"})

    # ------------------------------------------------------------ mini site
    import base64 as _b64
    import html as _h
    import secrets as _sec

    TEMA = {
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

    def _terang(hexa: str) -> float:
        r, gg, b = _rgb(hexa)
        return (0.299 * r + 0.587 * gg + 0.114 * b) / 255

    def _campur(a: str, b: str, t: float) -> str:
        x, y = _rgb(a), _rgb(b)
        return "#" + "".join(f"{round(x[i] + (y[i] - x[i]) * t):02x}" for i in range(3))

    def _warna_tema(tema: str, dasar: str, aksen: str) -> dict:
        if tema == "pop":
            bg = dasar
            ink = "#111111" if _terang(bg) > 0.45 else "#ffffff"
            acc = "#111111" if ink == "#111111" else "#ffffff"
            return {"BG": bg, "INK": ink, "MUTED": _campur(ink, bg, .3), "CARD": "#ffffff" if ink == "#111111" else _campur(bg, "#000000", .35),
                    "LINE": ink, "ACC": acc, "ACC_INK": bg, "SHADOW": f"5px 5px 0 {ink}"}
        if tema == "paper":
            acc = aksen if _terang(aksen) < 0.75 else "#141414"
            return {"BG": "#f4f1ea", "INK": "#141414", "MUTED": "#5f5b53", "CARD": "#fbf9f4", "LINE": "#d9d3c7",
                    "ACC": acc, "ACC_INK": "#ffffff" if _terang(acc) < 0.6 else "#141414", "SHADOW": "0 1px 0 rgba(0,0,0,.04)"}
        acc = aksen if _terang(aksen) > 0.22 else "#ffffff"
        return {"BG": "#08080a", "INK": "#f5f5f5", "MUTED": "#9a9a9a", "CARD": "#111114", "LINE": "#26262b",
                "ACC": acc, "ACC_INK": "#111111" if _terang(acc) > 0.55 else "#ffffff", "SHADOW": "0 30px 80px -40px rgba(0,0,0,.8)"}

    IKON_X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.8 3h3.1l-6.8 7.8 8 10.2h-6.3l-4.9-6.4L5.3 21H2.2l7.3-8.3L1.8 3h6.4l4.4 5.9L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5z"/></svg>'
    IKON_TG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.9 4.3 18.7 19.4c-.2 1-.9 1.3-1.7.8l-4.8-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.9 8.9-8c.4-.3-.1-.5-.6-.2L6.5 13.2l-4.7-1.5c-1-.3-1-1 .2-1.5L20.5 3c.9-.3 1.6.2 1.4 1.3z"/></svg>'

    class PermintaanSite(BaseModel):
        nama: str = Field(min_length=1, max_length=60)
        ticker: str = Field(default="", max_length=8)
        tagline: str = Field(default="", max_length=120)
        roast: str = Field(default="", max_length=2000)
        mode: str = "ai"
        sig: str = Field(min_length=10, max_length=64)
        deskripsi: str = Field(default="", max_length=1500)
        fitur: list[str] = Field(default_factory=list, max_length=3)
        logo: str = Field(min_length=100, max_length=4_000_000)
        logo_sig: str = Field(min_length=10, max_length=64)
        ca: str = Field(default="", max_length=42)
        x: str = Field(default="", max_length=120)
        tg: str = Field(default="", max_length=120)
        tema: str = "night"
        dasar: str = Field(default="#111111", pattern=r"^#[0-9a-fA-F]{6}$")
        aksen: str = Field(default="#ffffff", pattern=r"^#[0-9a-fA-F]{6}$")
        slug: str = Field(default="", max_length=24)
        kunci: str = Field(default="", max_length=64)

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
    async def buat_site(data: PermintaanSite, request: Request):
        if not (g["REDIS_URL"] and g["REDIS_TOKEN"]):
            raise HTTPException(503, "Mini sites are warming up. Try again later.")
        mode = "meme" if data.mode == "meme" else "ai"
        if not hmac.compare_digest(g["tanda_konten"]("kit", data.nama, data.ticker, data.tagline, data.roast, mode), data.sig):
            raise HTTPException(400, "Build a kit on Orynx first, then make its mini site.")
        try:
            png = _b64.b64decode(data.logo, validate=True)
        except Exception:
            raise HTTPException(400, "That logo doesn't look right.")
        if not png.startswith(b"\x89PNG") or not hmac.compare_digest(g["tanda_konten"]("logo", hashlib.sha256(png).hexdigest()), data.logo_sig):
            raise HTTPException(400, "Only logos made on Orynx can go on a mini site.")
        ca = data.ca.strip().lower()
        if ca and not re.fullmatch(r"0x[0-9a-f]{40}", ca):
            raise HTTPException(400, "That contract address doesn't look right. It starts with 0x and has 42 characters.")
        x, tg = _link_x(data.x), _link_tg(data.tg)
        tema = data.tema if data.tema in TEMA else "night"
        fitur = [f.strip()[:220] for f in data.fitur if f.strip()][:3]
        siapa, holder = await g["siapa_dan_holder"](request)
        slug = re.sub(r"[^a-z0-9-]", "", data.slug.lower())[:24]
        lama = None
        if slug:
            mentah = await _redis("GET", f"orynx:site:{slug}")
            lama = json.loads(mentah) if mentah else None
            if not lama or not data.kunci or not hmac.compare_digest(hashlib.sha256(data.kunci.encode()).hexdigest(), lama.get("kh", "")):
                raise HTTPException(403, "You can only update a mini site you made on this device.")
        kunci = data.kunci
        if not lama:
            batas = f"orynx:sitecount:{hashlib.sha256(siapa.encode()).hexdigest()[:20]}:{g['hari_ini']()}"
            n = int(await _redis("INCR", batas) or 0)
            await _redis("EXPIRE", batas, "90000")
            if n > 5:
                raise HTTPException(429, "That's 5 new mini sites today. Come back tomorrow.")
            dasar = re.sub(r"[^a-z0-9]", "", (data.ticker or data.nama).lower())[:16] or "token"
            slug = ""
            for i in range(6):
                calon = dasar if i == 0 else f"{dasar}-{_sec.token_hex(2)}"
                if calon in {"api", "admin", "orynx", "badge", "static"}:
                    continue
                ok = await _redis("SET", f"orynx:site:{calon}", "{}", "NX")
                if ok:
                    slug = calon
                    break
            if not slug:
                raise HTTPException(502, "Couldn't reserve a link. Try again.")
            kunci = _sec.token_hex(16)
        kecil = g["svg_ke_png"](f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512">'
                                f'<image width="512" height="512" href="data:image/png;base64,{data.logo}" xlink:href="data:image/png;base64,{data.logo}"/></svg>', 512)
        situs = {"nama": data.nama.strip(), "ticker": data.ticker.strip().upper(), "tagline": data.tagline.strip(), "mode": mode,
                 "deskripsi": data.deskripsi.strip(), "fitur": fitur, "ca": ca, "x": x, "tg": tg, "tema": tema,
                 "dasar": data.dasar.lower(), "aksen": data.aksen.lower(), "holder": bool(holder or (lama or {}).get("holder")),
                 "kh": hashlib.sha256(kunci.encode()).hexdigest(), "t": (lama or {}).get("t") or int(time.time()), "u": int(time.time())}
        await _redis("SET", f"orynx:sitelogo:{slug}", _b64.b64encode(kecil).decode())
        await _redis("SET", f"orynx:site:{slug}", json.dumps(situs))
        _cache.pop("site:" + slug, None)
        return {"ok": True, "slug": slug, "kunci": kunci, "url": f"{g['SITUS']}/s/{slug}"}

    async def _ambil_site(slug: str) -> dict | None:
        if not re.fullmatch(r"[a-z0-9-]{1,24}", slug):
            return None
        simpan = _cache.get("site:" + slug)
        if simpan and time.time() - simpan[1] < 30:
            return simpan[0]
        mentah = await _redis("GET", f"orynx:site:{slug}")
        data = json.loads(mentah) if mentah else None
        if not data or not data.get("nama"):
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
        s = await _ambil_site(slug)
        if not s or not s.get("ca") or not (s.get("holder") or _terbuka("badge")):
            return {"ada": False}
        try:
            b = await _bonding_token(s["ca"])
        except Exception:
            b = None
        if not b:
            return {"ada": False}
        return {"ada": True, "persen": b["persen"], "saat_ini": b["saat_ini"], "ambang": b["ambang"], "lulus": b["lulus"]}

    @app.get("/s/{slug}", include_in_schema=False)
    async def site_halaman(slug: str):
        slug = slug.lower()
        s = await _ambil_site(slug)
        if not s:
            raise HTTPException(404, "This mini site doesn't exist.")
        e = _h.escape
        url = f"{g['SITUS']}/s/{slug}"
        t = TEMA.get(s["tema"], TEMA["night"])
        w = _warna_tema(s["tema"], s["dasar"], s["aksen"])
        tk = f"${s['ticker']}" if s["ticker"] else ""
        soc = ""
        if s["x"]:
            soc += f'<a class="ic" href="{e(s["x"])}" target="_blank" rel="noopener" aria-label="X">{IKON_X}</a>'
        if s["tg"]:
            soc += f'<a class="ic" href="{e(s["tg"])}" target="_blank" rel="noopener" aria-label="Telegram">{IKON_TG}</a>'
        cta = (f'<a class="btn main" href="https://ponsfamily.com/launchpad/{s["ca"]}" target="_blank" rel="noopener">Buy {e(tk) or "it"} on pons</a>'
               if s["ca"] else '<span class="btn main soon">Launching soon on pons</span>')
        if s["tg"]:
            cta += f'<a class="btn" href="{e(s["tg"])}" target="_blank" rel="noopener">Join the Telegram</a>'
        if s["x"]:
            cta += f'<a class="btn" href="{e(s["x"])}" target="_blank" rel="noopener">Follow on X</a>'
        ca_blok = ""
        if s["ca"]:
            ca_blok = (f'<div class="ca"><small>Contract address</small><code id="ca">{s["ca"]}</code><button class="copy" id="cpy" type="button">Copy</button></div>'
                       f'<div class="bond" id="bond" hidden data-src="/s/{slug}/bonding"><div class="bond-t"><span>Bonding progress</span><b id="bp">0%</b></div>'
                       '<div class="bar"><i id="bf"></i></div><p id="bn"></p></div>')
        fitur = "".join(f'<div class="card"><span class="k">{i + 1:02d}</span><p>{e(f)}</p></div>' for i, f in enumerate(s["fitur"])) \
            or f'<div class="card"><span class="k">01</span><p>{e(s["tagline"])}</p></div>'
        langkah = [("Get ETH on Robinhood Chain", "Bridge or buy a little ETH in a wallet that supports Robinhood Chain.")]
        if s["ca"]:
            langkah += [("Open pons", f"Go to ponsfamily.com and find {tk or s['nama']}."),
                        ("Check the address", "Make sure the contract address matches the one on this page, then buy.")]
        else:
            langkah += [("Follow for the launch", "The contract address will be posted here and on our socials."),
                        ("Buy on pons", f"When {tk or s['nama']} goes live, buy it on ponsfamily.com.")]
        langkah_html = "".join(f'<div class="step"><b>{e(a)}</b><p>{e(b)}</p></div>' for a, b in langkah)
        n_nama = max((len(k) for k in s["nama"].split()), default=4) + (3 if s["tema"] == "night" else 0)
        h1 = ("clamp(56px,9.5vw,124px)" if n_nama <= 6 else "clamp(46px,7.2vw,96px)" if n_nama <= 9
              else "clamp(38px,5.4vw,72px)" if n_nama <= 13 else "clamp(30px,4vw,54px)")
        ganti = {"H1_SIZE": h1, "NAMA": e(s["nama"]), "TICKER_DOLAR": e(tk), "TICKER_DOLAR_ATAU": e(tk or s["nama"]), "TAGLINE": e(s["tagline"]),
                 "URL": url, "PATH": f"/s/{slug}", "FONT_URL": t["font"], "DISP": t["disp"], "BODY": t["body"], "H1_WEIGHT": t["h1"], "H2_WEIGHT": t["h2"],
                 "H1_TRACK": t["track"], "RADIUS": t["radius"], "BW": t["bw"], "HALO": t["halo"], "LABEL_CHAIN": "Robinhood Chain",
                 "SOC": soc, "CTA": cta, "CA_BLOK": ca_blok, "DESKRIPSI": e(s["deskripsi"] or s["tagline"]),
                 "JUDUL_FITUR": "The lore" if s["mode"] == "meme" else "What it does", "FITUR": fitur, "LANGKAH": langkah_html, **w}
        tpl = _cache.get("tpl_site")
        if not tpl:
            tpl = (g["Path"](__file__).parent / "static" / "site.html").read_text(encoding="utf-8")
            _cache["tpl_site"] = tpl
        halaman = re.sub(r"\{\{([A-Z0-9_]+)\}\}", lambda m: str(ganti.get(m.group(1), "")), tpl)
        return Response(halaman, media_type="text/html", headers={"Cache-Control": "public, max-age=60, s-maxage=60"})

    class PermintaanHapusSite(BaseModel):
        slug: str = Field(min_length=1, max_length=24)
        kunci: str = Field(min_length=8, max_length=200)

    @app.post("/api/site/hapus")
    async def hapus_site(data: PermintaanHapusSite):
        admin = g["ADMIN_KEY"]
        s = await _redis("GET", f"orynx:site:{data.slug}")
        info = json.loads(s) if s else {}
        boleh = (admin and hmac.compare_digest(data.kunci, admin)) or \
            (info.get("kh") and hmac.compare_digest(hashlib.sha256(data.kunci.encode()).hexdigest(), info["kh"]))
        if not boleh:
            raise HTTPException(403, "Not allowed.")
        await _redis("DEL", f"orynx:site:{data.slug}")
        await _redis("DEL", f"orynx:sitelogo:{data.slug}")
        _cache.pop("site:" + data.slug, None)
        return {"ok": True}
