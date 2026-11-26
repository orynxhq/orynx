"""
Showcase layer: the launch page / mini website section on the home page.
"""

from fastapi import Request
from fastapi.responses import Response

import launch_page as _lv
from launch_page import *  # noqa: F401,F403


def __getattr__(name):
    return getattr(_lv, name)


# ---------------------------------------------------------------------------
# HOME PAGE: launch page showcase section (mini website)
# ---------------------------------------------------------------------------
LOGO_FROG = ('<svg viewBox="0 0 512 512" aria-hidden="true"><rect width="512" height="512" fill="#1b1f4b"/><circle cx="392" cy="118" r="44" fill="#ffe27a"/><circle cx="410" cy="104" r="40" fill="#1b1f4b"/>'
             '<ellipse cx="256" cy="330" rx="170" ry="120" fill="#5fcf6b" stroke="#111" stroke-width="12"/><circle cx="186" cy="214" r="58" fill="#5fcf6b" stroke="#111" stroke-width="12"/>'
             '<circle cx="326" cy="214" r="58" fill="#5fcf6b" stroke="#111" stroke-width="12"/><circle cx="186" cy="214" r="26" fill="#fff"/><circle cx="326" cy="214" r="26" fill="#fff"/>'
             '<rect x="168" y="208" width="36" height="12" rx="6" fill="#111"/><rect x="308" y="208" width="36" height="12" rx="6" fill="#111"/>'
             '<path d="M190 350 Q256 390 322 350" fill="none" stroke="#111" stroke-width="12" stroke-linecap="round"/></svg>')

SHOWCASE = """
<style>
.lps{border-top:1px solid var(--rule-d)}
.lps-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.05fr);gap:56px;align-items:center}
.lps-new{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:#d8ffd8;border:1px solid #1f3b22;background:#0b1a0d;border-radius:999px;padding:5px 12px;margin-bottom:14px}
.lps-new i{width:8px;height:8px;border-radius:50%;background:#4ade80;box-shadow:0 0 10px #4ade80;animation:pulse 2s ease-in-out infinite}
.lps h2{margin:0 0 12px}
.lps-lede{margin:0 0 22px;color:var(--graphite);max-width:48ch}
.lps-pts{list-style:none;margin:0 0 26px;padding:0;border-top:1px solid var(--rule-d)}
.lps-pts li{display:grid;grid-template-columns:28px 1fr;gap:10px;padding:14px 0;border-bottom:1px solid var(--rule-d)}
.lps-pts b{display:block;font-weight:600}.lps-pts span{color:var(--graphite);font-size:15px}
.lps-pts .n{font-family:var(--display);font-size:13px;color:var(--graphite);padding-top:3px}
.lps-acts{display:flex;gap:10px;flex-wrap:wrap}
.lps-phone{position:relative;border:1px solid #2c2c2c;border-radius:26px;overflow:hidden;background:#000;box-shadow:0 40px 140px -50px rgba(255,255,255,.4)}
.lps-bar{display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid #1c1c1c;background:#0a0a0a}
.lps-bar i{width:10px;height:10px;border-radius:50%;background:#2a2a2a}
.lps-url{flex:1;text-align:center;font-size:12px;color:var(--graphite);background:#111;border-radius:999px;padding:5px 12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lps-ex{flex:none;font:600 11px var(--body);background:#fff;color:#000;border-radius:999px;padding:3px 9px}
.lps-body{padding:22px;display:grid;gap:14px;background:radial-gradient(ellipse 70% 50% at 50% 0%,rgba(255,255,255,.08),transparent 70%)}
.lps-top{display:flex;gap:16px;align-items:center}
.lps-top svg{width:84px;height:84px;border-radius:24%;flex:none;border:1px solid #2c2c2c}
.lps-chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px}
.lps-chips span{font-size:11px;border:1px solid #333;border-radius:999px;padding:2px 9px;color:#bdbdbd}
.lps-chips .on{border-color:#1f3b22;color:#d8ffd8;background:#0b1a0d}
.lps-top b{display:block;font-family:var(--display);font-weight:400;font-size:22px;line-height:1.2}
.lps-top code{font:600 13px var(--body);color:var(--graphite);letter-spacing:.06em}
.lps-tag{margin:0;font-size:16px}
.lps-ca{display:flex;gap:8px;align-items:center;border:1px solid #2a2a2a;border-radius:12px;padding:7px 7px 7px 12px;background:#050505}
.lps-ca code{flex:1;font:13px ui-monospace,Menlo,monospace;color:#ddd;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lps-ca span{font:600 12px var(--body);border:1px solid #333;border-radius:999px;padding:4px 10px}
.lps-btns{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.lps-btns span{display:flex;align-items:center;justify-content:center;min-height:38px;border-radius:999px;font:600 13px var(--body);border:1px solid #333}
.lps-btns .s{background:#fff;color:#000;border-color:#fff}
.lps-soc{display:flex;gap:6px;flex-wrap:wrap}
.lps-soc span{font-size:12px;border:1px solid #333;border-radius:999px;padding:4px 10px;color:#ddd}
.lps-about{border:1px solid #1c1c1c;border-radius:12px;padding:12px 14px;font-size:13px;color:#bdbdbd}
.lps-about b{display:block;color:#fff;font-size:13px;margin-bottom:4px}
.lps-live{margin-top:56px}
.lps-live[hidden]{display:none}
.lps-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}
.lps-card{display:flex;gap:12px;align-items:center;border:1px solid var(--rule-d);border-radius:16px;padding:12px;background:#070707;text-decoration:none;transition:border-color .2s}
.lps-card:hover{border-color:#4a4a4a}
.lps-card img{width:52px;height:52px;border-radius:13px;object-fit:cover;flex:none;background:#151515}
.lps-card b{display:block;font-size:15px}.lps-card small{color:var(--graphite);font-size:12px}
@media (max-width:900px){.lps-grid{grid-template-columns:1fr;gap:36px}}
@media (max-width:560px){.lps-body{padding:16px}.lps-top svg{width:68px;height:68px}}
.lps-demo>input{position:absolute;opacity:0;pointer-events:none}
.lps-tabs{display:inline-flex;padding:4px;margin:0 0 14px;border:1px solid var(--rule-d);border-radius:999px;background:var(--raise)}
.lps-tabs label{font:600 13px var(--body);color:var(--graphite);padding:8px 14px;border-radius:999px;cursor:pointer}
#lpsT1:checked~.lps-tabs label[for=lpsT1],#lpsT2:checked~.lps-tabs label[for=lpsT2]{background:var(--paper);color:var(--ink)}
#lpsT1:checked~.lps-p2,#lpsT2:checked~.lps-p1{display:none}
.lps-top img{width:84px;height:84px;border-radius:24%;flex:none;border:1px solid #2c2c2c;object-fit:cover;background:#151515}
.lps-soon{border:1px dashed #333;border-radius:12px;padding:12px 14px;font-size:13px;color:#bdbdbd}
@media (max-width:560px){.lps-top img{width:68px;height:68px}.lps-tabs{display:flex}.lps-tabs label{flex:1;text-align:center;padding:8px 6px;font-size:12px}}
</style>
<section class="band lps" id="launchpage" data-page="home">
  <div class="shell">
    <div class="lps-grid">
      <div>
        <span class="lps-new"><i></i>New on Orynx</span>
        <h2>Every kit gets its own launch page</h2>
        <p class="lps-lede">Launched on pons? Paste your contract address and your kit turns into a mini website for your token. One link to pin on X, drop in Telegram and share everywhere.</p>
        <ul class="lps-pts">
          <li><span class="n">01</span><div><b>Buy on pons in one tap</b><span>Your CA with a copy button, plus buy and explorer links.</span></div></li>
          <li><span class="n">02</span><div><b>Checked on-chain</b><span>We read the token on Robinhood Chain and flag a ticker that doesn't match.</span></div></li>
          <li><span class="n">03</span><div><b>Your story and socials</b><span>Logo, tagline, description, features or lore, X, Telegram and website.</span></div></li>
          <li><span class="n">04</span><div><b>Free, and live in the gallery</b><span>Launched kits get a Live on pons badge in the community gallery.</span></div></li>
        </ul>
        <div class="lps-acts"><a class="pill solid" href="#build">Build a kit</a><a class="pill line" href="#examples">See community kits</a></div>
      </div>
      <div class="lps-demo">
        <input type="radio" name="lpsTab" id="lpsT1" checked><input type="radio" name="lpsTab" id="lpsT2">
        <div class="lps-tabs" role="tablist"><label for="lpsT1">Meme coin · Live</label><label for="lpsT2">AI project · Launching soon</label></div>
        <div class="lps-phone lps-p1" aria-label="Example launch page, meme coin">
          <div class="lps-bar"><i></i><i></i><i></i><span class="lps-url">orynxai.xyz/k/night-frog</span><span class="lps-ex">Example</span></div>
          <div class="lps-body">
            <div class="lps-top">""" + LOGO_FROG + """<div><div class="lps-chips"><span class="on">● Live on pons</span><span>Meme coin</span></div><b>Night Frog</b><code>$NFROG</code></div></div>
            <p class="lps-tag">Only trades at 3am. Never misses.</p>
            <div class="lps-ca"><code>0x3a7f…example…e91c</code><span>Copy</span></div>
            <div class="lps-btns"><span class="s">Buy on pons</span><span>View on explorer</span></div>
            <div class="lps-soc"><span>𝕏 X</span><span>Telegram</span><span>Website</span></div>
            <div class="lps-about"><b>Lore</b>The frog wakes at 3am, checks one chart, makes one trade, then goes back to sleep.</div>
          </div>
        </div>
        <div class="lps-phone lps-p2" aria-label="Example launch page, AI project">
          <div class="lps-bar"><i></i><i></i><i></i><span class="lps-url">orynxai.xyz/k/27aa7e70067c</span><span class="lps-ex">Example</span></div>
          <div class="lps-body">
            <div class="lps-top"><img src="/api/gallery/logo/27aa7e70067c" alt="Clause logo" loading="lazy"><div><div class="lps-chips"><span>Launching soon</span><span>AI project</span></div><b>Clause</b><code>$CLAUSE</code></div></div>
            <p class="lps-tag">Read the contract before it reads your wallet.</p>
            <div class="lps-soon">The contract address appears here the moment the token goes live on pons.</div>
            <div class="lps-soc"><span>𝕏 X</span><span>Telegram</span></div>
            <div class="lps-about"><b>Key features</b>Paste any token contract and the agent explains what it can really do: mint, pause, blacklist, tax, in plain words.</div>
          </div>
        </div>
      </div>
    </div>
    <div class="lps-live" id="lpsLive" hidden>
      <div class="ex-head"><div><span class="ca-live"><i></i>Live now</span><h2>Launch pages from the community</h2><p>Tokens that launched on pons with an Orynx kit.</p></div></div>
      <div class="lps-cards" id="lpsCards"></div>
    </div>
  </div>
</section>
"""

KITLIST_NEW = '<li><b>Launch page</b><span>Once you are live on pons, your kit becomes a mini website for your token: CA, buy button, socials and story in one link.</span></li>'


# Extra script: show launch pages that are already live on the home page
SHOWCASE_JS = r"""
// 3b) Home page: list of launch pages that are live
async function showcaseLive() {
  const box = document.getElementById("lpsCards"); if (!box || !live.size) return;
  try {
    const g = await (await fetch("/api/gallery")).json();
    const entries = [...(g.items || []), ...(g.top || [])];
    const already = new Set();
    const card = entries.filter((it) => live.has(it.id) && !already.has(it.id) && already.add(it.id)).slice(0, 8).map((it) => {
      const a = document.createElement("a"); a.className = "lps-card"; a.href = `/k/${it.id}`;
      const img = document.createElement("img"); img.loading = "lazy"; img.alt = ""; img.src = `/api/gallery/logo/${it.id}`;
      const d = document.createElement("div"); const b = document.createElement("b"); b.textContent = it.name;
      const sm = document.createElement("small"); sm.textContent = (it.ticker ? "$" + it.ticker + " · " : "") + "Live on pons";
      d.append(b, sm); a.append(img, d); return a;
    });
    if (card.length) { box.replaceChildren(...card); document.getElementById("lpsLive").hidden = false; }
  } catch (_) {}
}
"""

_lv.VERSION_JS = "2"
_lv.JS = _lv.JS.replace("badge();\n  new MutationObserver", "badge(); showcaseLive();\n  new MutationObserver", 1).replace(
    "// 4) /k/<id> page: launch page editor", SHOWCASE_JS.strip() + "\n\n// 4) /k/<id> page: launch page editor", 1)


def _install_showcase(app):
    @app.middleware("http")
    async def showcase_launch(request: Request, call_next):
        resp = await call_next(request)
        if (request.url.path not in ("/", "/index.html") or request.method != "GET" or resp.status_code != 200
                or resp.headers.get("content-encoding") or "html" not in resp.headers.get("content-type", "")):
            return resp
        body = await _lv._read_body(resp)
        try:
            body = body.replace(b"/launch.js?v=1", b"/launch.js?v=2")
            if b'id="launchpage"' not in body:
                body = body.replace(b'<section class="band hq" id="hq"', SHOWCASE.encode() + b'\n  <section class="band hq" id="hq"', 1)
                body = body.replace(b"</ul>\n    </div>\n  </section>\n\n  <section class=\"light band\" id=\"token\"",
                                    KITLIST_NEW.encode() + b"\n      </ul>\n    </div>\n  </section>\n\n  <section class=\"light band\" id=\"token\"", 1)
        except Exception:
            pass
        return _lv._response_new(resp, body)


def install(app, g):
    result = _lv.install(app, g)
    try:
        _install_showcase(app)
    except Exception:
        pass
    return result
