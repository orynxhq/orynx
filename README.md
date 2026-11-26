# Orynx

**AI launch kits for tokens on Robinhood Chain, built for [pons](https://ponsfamily.com/launchpad).**

Live: **[orynxai.xyz](https://orynxai.xyz)** · X: [@orynxhq](https://x.com/orynxhq) · Token: `$ORYNX` on Robinhood Chain

```
$ORYNX contract: 0x5f19286a65d33e7c76b2c8c07ccbd4310aefbf20
```

Describe an AI project or a meme coin in one sentence. Si Dev, the resident AI dev, roasts the idea and then builds the kit:

- 3 name and ticker options
- 2 original logos (PNG, HQ 2048 px for holders)
- Tagline, features or lore, description
- X bio, first posts and a 5-post launch-day thread
- Telegram welcome message and a launch checklist

## Features

| Feature | Where |
|---|---|
| Launch kit builder (text + logos) | `src/app.py` |
| Ask Si Dev (pre-launch advice chat) | `src/app.py` |
| Community gallery, likes, kit pages `/k/<id>` | `src/app.py` |
| Burn tracker, holders feed, bonding progress, referral board, kit of the day, embed badge | `src/fitur_lama.py` |
| Mini token websites `/s/<slug>` | `src/fitur_lama.py`, `src/static/site.html` |
| Launch pages on `/k/<id>`: CA, buy on pons, explorer, socials, on-chain ticker check | `src/launch_v1.py` |
| Launch page showcase on the homepage | `src/pamer_v1.py` |
| Bring your own logo for launch pages | `src/logo_v1.py` |
| Own logo also on mini websites | `src/situs_v1.py` |
| Link launch page ↔ mini website by contract address | `src/sambung_v1.py` |
| Site verification for HEY Research | `src/fitur.py` |

## $ORYNX holder perks

Hold 1,000,000 `$ORYNX` and connect a wallet (signature only, no transaction) to unlock 10 kits a day, HQ 2048 px logos, every logo style and 4 logo options per round. Holder status is read live from Robinhood Chain.

## Stack

- Python + FastAPI on Vercel (`src/`)
- Anthropic Claude for text and SVG logos, rendered to PNG with resvg
- Upstash Redis (Vercel KV) for the gallery, launch pages and mini sites
- Robinhood Chain RPC for holder balance, burns, bonding progress and token checks

## Run locally

```bash
cd src
pip install -r requirements.txt
cp ../.env.example .env   # fill in your keys
python app.py             # http://localhost:8000
```

## How the code is organised

`app.py` is the core app. It calls `fitur.pasang(app, globals())` at the end. Each feature file adds one layer and loads the one before it:

```
app.py → fitur.py → sambung_v1.py → situs_v1.py → logo_v1.py → pamer_v1.py → launch_v1.py → fitur_lama.py
```

## Notes

- Secrets live in environment variables on Vercel, never in this repo.
- Orynx gives launch help, not financial advice. It never predicts prices or promises returns.

© 2026 Orynx · Built for pons on Robinhood Chain
