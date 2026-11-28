/* Orynx: milestone bonding, live holders feed, kit of the day, embed badge, holder early access */
(() => {
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
  const short = (a) => a.slice(0, 6) + "…" + a.slice(-4);
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const save = (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} };
  const read = (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } };
  async function api(url, data) {
    const r = await fetch(url, { method: data ? "POST" : "GET", headers: { "Content-Type": "application/json" }, body: data ? JSON.stringify(data) : undefined });
    let fill = {}; try { fill = await r.json(); } catch (_) {}
    if (!r.ok) throw new Error(typeof fill.detail === "string" ? fill.detail : "Something went wrong. Try again in a moment.");
    return fill;
  }
  function then(det) {
    if (!det) return "";
    const s = Math.max(0, Date.now() / 1000 - det);
    if (s < 60) return "just now";
    if (s < 3600) return Math.floor(s / 60) + "m ago";
    if (s < 86400) return Math.floor(s / 3600) + "h ago";
    return Math.floor(s / 86400) + "d ago";
  }
  const dateShort = (ts) => new Date(ts * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const pageNow = () => { const h = decodeURIComponent(location.hash.slice(1)); return ({ examples: "examples", token: "token", faq: "faq", consult: "consult" })[h] || "home"; };

  const st = document.createElement("style");
  st.textContent = `
  .ms-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
  .ms-row span{font-size:12px;font-weight:600;border:1px solid #2e2e2e;border-radius:999px;padding:5px 11px;color:#8c8c8c}
  .ms-row span.on{color:#000;background:#fff;border-color:#fff}
  .bond-bar .tk{position:absolute;top:0;bottom:0;width:2px;background:rgba(0,0,0,.55);z-index:2}
  .ms-hit{display:none;margin:12px 0 0;padding:12px 14px;border-radius:12px;background:#fff;color:#000;font-size:14px;font-weight:600;align-items:center;justify-content:space-between;gap:10px}
  .ms-hit.on{display:flex}.ms-hit a{color:#000;white-space:nowrap}
  .bond-hold{margin:8px 0 0;font-size:13px;color:#dcdcdc}
  #confetti{position:fixed;inset:0;pointer-events:none;z-index:99}
  .feed-card{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:40px;border:1px solid #2c2c2c;border-radius:28px;padding:36px;background:#0a0a0c}
  .feed-num{font:400 clamp(56px,9vw,96px)/1 Michroma,sans-serif;margin:18px 0 8px}
  .feed-list{list-style:none;margin:0;padding:0}
  .feed-list li{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #1c1c1c;font-size:14px}
  .feed-list li:last-child{border-bottom:0}
  .feed-list .jn{flex:none;width:72px;text-align:center;font-size:12px;font-weight:700;border-radius:999px;padding:4px 0;border:1px solid #333;color:#dcdcdc}
  .feed-list .jn.buy{background:#fff;color:#000;border-color:#fff}.feed-list .jn.burn{border-color:#ff6a2b;color:#ff6a2b}
  .feed-list b{font-weight:600}.feed-list .who{color:#8c8c8c}.feed-list a{margin-left:auto;color:#8c8c8c;white-space:nowrap}
  .feed-empty{color:#8c8c8c;font-size:14px}
  .kotd-card{display:grid;grid-template-columns:220px minmax(0,1fr);gap:36px;align-items:center;border:1px solid #2c2c2c;border-radius:28px;padding:32px;background:linear-gradient(150deg,rgba(255,255,255,.08),rgba(255,255,255,0) 45%),#0a0a0c}
  .kotd-card img{width:220px;height:220px;border-radius:44px;display:block;background:#111}
  .kotd-card h2{margin:14px 0 4px}.kotd-card code{color:#8c8c8c;font-size:16px}
  .kotd-tag{font-size:20px;margin:14px 0 8px}.kotd-roast{color:#9a9a9a;font-size:15px;margin:0 0 18px}
  .kotd-acts{display:flex;flex-wrap:wrap;gap:10px}
  .bdg{margin:56px 0;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:40px;border:1px solid #2c2c2c;border-radius:28px;padding:36px;background:#0a0a0c}
  .bdg h2{margin:14px 0 10px}.bdg p{color:#9a9a9a;margin:0 0 18px}
  .bdg form{display:flex;gap:10px;flex-wrap:wrap}.bdg input{flex:1;min-width:0;background:#000;border:1px solid #333;border-radius:999px;padding:12px 18px;color:#fff;font:inherit;font-size:14px}
  .bdg-msg{font-size:14px;color:#ff8a8a;margin:12px 0 0}
  .bdg-out iframe{width:100%;max-width:380px;height:132px;border:0;display:block}
  .bdg-code{position:relative;margin-top:14px;background:#000;border:1px solid #2c2c2c;border-radius:14px;padding:14px 16px;font:12px/1.5 ui-monospace,monospace;color:#cfcfcf;word-break:break-all}
  .bdg-ph{border:1px dashed #333;border-radius:18px;height:132px;display:grid;place-items:center;color:#666;font-size:14px;max-width:380px}
  .early-pill{display:inline-flex;gap:8px;align-items:center;font-size:13px;font-weight:600;border:1px solid #444;border-radius:999px;padding:6px 14px;color:#fff}
  .early-pill i{width:8px;height:8px;border-radius:50%;background:#f5c542;box-shadow:0 0 10px #f5c542}
  .early-card{margin-top:22px;border:1px solid rgba(0,0,0,.15);border-radius:18px;padding:18px 20px}
  .early-card b{display:block;margin-bottom:4px}.early-card span{font-size:14px;opacity:.7}
  @media (max-width:760px){.feed-card,.bdg{grid-template-columns:1fr;padding:24px;gap:24px}.kotd-card{grid-template-columns:1fr;padding:24px;gap:20px}.kotd-card img{width:140px;height:140px;border-radius:32px}}
  `;
  document.head.appendChild(st);

  /* ---------------- 1. Bonding milestones ---------------- */
  const MS = [25, 50, 75, 100];
  function confetti() {
    if (reducedMotion) return;
    const cv = document.createElement("canvas"); cv.id = "confetti"; document.body.appendChild(cv);
    const c = cv.getContext("2d"), r = devicePixelRatio || 1;
    cv.width = innerWidth * r; cv.height = innerHeight * r; c.scale(r, r);
    const ps = Array.from({ length: 140 }, () => ({ x: innerWidth / 2, y: innerHeight / 3, vx: (Math.random() - .5) * 14, vy: Math.random() * -12 - 4, s: Math.random() * 6 + 4, a: Math.random() * 6.28, w: Math.random() * .3 - .15, col: ["#fff", "#cfcfcf", "#22c55e", "#f5c542"][Math.floor(Math.random() * 4)] }));
    const t0 = performance.now();
    const f = (n) => {
      const t = (n - t0) / 1000; c.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of ps) { p.vy += .35; p.x += p.vx; p.y += p.vy; p.a += p.w; c.save(); c.translate(p.x, p.y); c.rotate(p.a); c.globalAlpha = Math.max(0, 1 - t / 3.2); c.fillStyle = p.col; c.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); c.restore(); }
      if (t < 3.2) requestAnimationFrame(f); else cv.remove();
    };
    requestAnimationFrame(f);
  }
  async function decorateBonding(holdersN) {
    const box = $("bond"); if (!box) return false;
    let h; try { h = await api("/api/bonding"); } catch (_) { return true; }
    if (!h.present) return true;
    if (h.graduated) {
      if (Number(read("orynx_ms") || 0) < 100) { save("orynx_ms", "100"); confetti(); }
      return true;
    }
    const pct = h.percent;
    const bar = $("bondBar");
    if (bar && !bar.querySelector(".tk")) [25, 50, 75].forEach((m) => { const i = document.createElement("span"); i.className = "tk"; i.style.left = m + "%"; bar.appendChild(i); });
    let row = box.querySelector(".ms-row");
    if (!row) { row = document.createElement("div"); row.className = "ms-row"; box.appendChild(row); }
    row.replaceChildren(...MS.map((m) => { const s = document.createElement("span"); s.textContent = m === 100 ? "Graduate" : m + "%"; if (pct >= m) s.className = "on"; return s; }));
    let hold = box.querySelector(".bond-hold");
    if (holdersN) { if (!hold) { hold = document.createElement("p"); hold.className = "bond-hold"; box.appendChild(hold); } hold.textContent = `${fmt(holdersN)} wallets hold $ORYNX`; }
    const reached = MS.filter((m) => pct >= m).pop() || 0;
    const old = Number(read("orynx_ms") || 0);
    if (reached > old) {
      let hit = box.querySelector(".ms-hit");
      if (!hit) { hit = document.createElement("div"); hit.className = "ms-hit"; box.appendChild(hit); }
      const text = reached === 100 ? "$ORYNX graduated from the pons curve!" : `$ORYNX passed ${reached}% on the pons curve`;
      const a = document.createElement("a"); a.target = "_blank"; a.rel = "noopener"; a.textContent = "Share on X";
      a.href = "https://x.com/intent/post?text=" + encodeURIComponent(`${text} 📈\n\nTrack it live on Robinhood Chain:\norynxai.xyz`);
      const sp = document.createElement("span"); sp.textContent = "🎉 " + text;
      hit.replaceChildren(sp, a); hit.classList.add("on");
      if (old > 0 || reached === 100) { if (reached === 100) confetti(); }
      save("orynx_ms", String(reached));
    }
    return true;
  }

  /* ---------------- 2. Live holders feed ---------------- */
  const LABEL = { buy: "Buy", sell: "Sell", burn: "Burn", transfer: "Transfer" };
  function installFeed() {
    if ($("feed")) return;
    const sec = document.createElement("section");
    sec.className = "band"; sec.id = "feed"; sec.dataset.page = "token"; sec.hidden = pageNow() !== "token";
    sec.innerHTML = `<div class="shell"><div class="feed-card">
      <div><span class="ca-live"><i></i>Live on Robinhood Chain</span><p class="feed-num" id="feedNum">0</p><p style="margin:0;color:#9a9a9a">wallets hold $ORYNX right now, read straight from the chain.</p></div>
      <div><h3 style="margin:0 0 8px">Latest activity</h3><ul class="feed-list" id="feedList"><li class="feed-empty">Loading the latest moves…</li></ul></div>
    </div></div>`;
    const ref = $("burn") || $("token");
    ref.insertAdjacentElement("afterend", sec);
  }
  async function loadFeed() {
    let h; try { h = await api("/api/holders"); } catch (_) { return 0; }
    if (!h.present) { const f = $("feed"); if (f) f.remove(); return 0; }
    installFeed();
    $("feedNum").textContent = fmt(h.holders);
    const list = $("feedList");
    if (!h.feed.length) { list.innerHTML = '<li class="feed-empty">No moves yet. Be the first.</li>'; return h.holders; }
    list.replaceChildren(...h.feed.map((x) => {
      const li = document.createElement("li");
      const j = document.createElement("span"); j.className = "jn " + x.kind; j.textContent = LABEL[x.kind] || x.kind;
      const d = document.createElement("div"); const b = document.createElement("b"); b.textContent = fmt(x.count) + " $ORYNX";
      const w = document.createElement("div"); w.className = "who"; w.textContent = short(x.who) + (x.time ? " · " + then(x.time) : "");
      d.append(b, w);
      const a = document.createElement("a"); a.href = "https://robin.etherscan.io/tx/" + x.tx; a.target = "_blank"; a.rel = "noopener"; a.textContent = "View tx";
      li.append(j, d, a); return li;
    }));
    return h.holders;
  }

  /* ---------------- 7. Kit of the day ---------------- */
  async function loadKotd() {
    let h; try { h = await api("/api/kotd"); } catch (_) { return; }
    if (!h.present || $("kotd")) return;
    const it = h.item, url = `${location.origin}/k/${it.id}`;
    const sec = document.createElement("section");
    sec.className = "band"; sec.id = "kotd"; sec.dataset.page = "home"; sec.hidden = pageNow() !== "home";
    sec.innerHTML = `<div class="shell"><div class="kotd-card">
      <img alt="" id="kotdImg"><div>
      <span class="ca-live"><i></i>Kit of the day</span>
      <h2 id="kotdName"></h2><code id="kotdTk"></code>
      <p class="kotd-tag" id="kotdTag"></p><p class="kotd-roast" id="kotdRoast"></p>
      <div class="kotd-acts"><a class="pill solid" id="kotdOpen">Open kit page</a><a class="pill line" id="kotdX" target="_blank" rel="noopener">Share on X</a><a class="pill line" id="kotdRemix">Remix it</a></div>
      </div></div></div>`;
    const ref = $("fresh") || $("mykits");
    ref.insertAdjacentElement("beforebegin", sec);
    $("kotdImg").src = `/api/gallery/logo/${it.id}`; $("kotdImg").alt = `${it.name} logo`;
    $("kotdName").textContent = it.name; $("kotdTk").textContent = it.ticker ? "$" + it.ticker : "";
    $("kotdTag").textContent = it.tagline || "";
    $("kotdRoast").textContent = it.roast ? "Si Dev: " + it.roast : "";
    $("kotdOpen").href = `/k/${it.id}`;
    $("kotdRemix").href = `/?remix=${it.id}#build`;
    $("kotdX").href = "https://x.com/intent/post?text=" + encodeURIComponent(`Today's Orynx Kit of the day 🏆\n\n${it.name}${it.ticker ? " $" + it.ticker : ""}\n${it.tagline || ""}\n\n${url}`);
  }

  /* ---------------- 10 + 11. Embed badge with holder early access ---------------- */
  let early = {};
  async function loadEarly() {
    try { const h = await api("/api/early"); (h.features || []).forEach((f) => { early[f.id] = f; }); } catch (_) {}
  }
  function installBadge() {
    const ref = $("refBox"); if (!ref || $("bdg")) return;
    const e = early.badge;
    const pill = e && !e.opened ? `<span class="early-pill"><i></i>Holder early access · everyone from ${dateShort(e.public)}</span>` : '<span class="ca-live"><i></i>New</span>';
    const div = document.createElement("div"); div.className = "bdg"; div.id = "bdg";
    div.innerHTML = `<div>${pill}<h2>Show your bonding progress anywhere</h2>
      <p>Paste your pons token's contract address and get a live badge for your website: your token, its bonding bar, and a link back to Orynx.</p>
      <form id="bdgForm" autocomplete="off"><input id="bdgIn" maxlength="42" placeholder="0x… your token contract address" aria-label="Token contract address"><button class="pill solid" type="submit" id="bdgBtn">Get my badge</button></form>
      <p class="bdg-msg" id="bdgMsg" hidden></p></div>
      <div class="bdg-out" id="bdgOut"><div class="bdg-ph">Your live badge shows up here</div></div>`;
    ref.insertAdjacentElement("afterend", div);
    $("bdgForm").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const t = $("bdgIn").value.trim(), msg = $("bdgMsg"), btn = $("bdgBtn");
      msg.hidden = true;
      if (!/^0x[0-9a-fA-F]{40}$/.test(t)) { msg.textContent = "That doesn't look like a contract address. It starts with 0x and has 42 characters."; msg.hidden = false; return; }
      btn.disabled = true; btn.textContent = "Checking pons…";
      try {
        const h = await api("/api/badge", { token: t });
        const out = $("bdgOut");
        const fr = document.createElement("iframe"); fr.src = h.url; fr.title = "Badge preview"; fr.loading = "lazy";
        const code = document.createElement("div"); code.className = "bdg-code"; code.textContent = h.code;
        const cp = document.createElement("button"); cp.className = "pill line"; cp.type = "button"; cp.textContent = "Copy code"; cp.style.marginTop = "12px";
        cp.onclick = () => navigator.clipboard.writeText(h.code).then(() => { cp.textContent = "Copied"; setTimeout(() => cp.textContent = "Copy code", 1400); }).catch(() => {});
        const tip = document.createElement("p"); tip.style.cssText = "font-size:13px;color:#8c8c8c;margin:10px 0 0"; tip.textContent = "Paste this code where you want the badge on your site. It updates by itself.";
        out.replaceChildren(fr, code, cp, tip);
      } catch (err) { msg.textContent = err.message; msg.hidden = false; }
      finally { btn.disabled = false; btn.textContent = "Get my badge"; }
    });
  }
  function installEarlyToken() {
    const e = early.badge; const perks = document.querySelector("#token .perks");
    if (!e || e.opened || !perks || $("earlyCard")) return;
    const d = document.createElement("div"); d.className = "early-card"; d.id = "earlyCard";
    d.innerHTML = `<b>Now in holder early access: Embed badge</b><span>Holders of 1M $ORYNX can use it today. It opens to everyone on ${dateShort(e.public)}.</span>`;
    perks.insertAdjacentElement("afterend", d);
  }


  /* ---------------- Mini site builder ---------------- */
  const THEME_MS = [
    { id: "night", name: "Night", w: ["#08080a", "#c9b8ff"] },
    { id: "pop", name: "Pop", w: ["#c9b8ff", "#111111"] },
    { id: "paper", name: "Paper", w: ["#f4f1ea", "#141414"] },
  ];
  const st2 = document.createElement("style");
  st2.textContent = `
  .ms-sub{margin:0 0 14px;color:var(--graphite,#9a9a9a);font-size:14px}
  .ms-theme{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px}
  .ms-theme button{display:flex;flex-direction:column;gap:8px;align-items:flex-start;padding:10px;border-radius:14px;border:1px solid #2e2e2e;background:#0b0b0d;color:#fff;font-family:inherit;font-weight:600;font-size:13px;cursor:pointer}
  .ms-theme button[aria-pressed="true"]{border-color:#fff;box-shadow:0 0 0 1px #fff}
  .ms-theme i{display:block;width:100%;height:38px;border-radius:9px;position:relative;overflow:hidden}
  .ms-theme i b{position:absolute;left:8px;bottom:8px;width:44%;height:8px;border-radius:4px}
  .ms-in{display:grid;gap:8px;margin-bottom:12px}
  .ms-in input{background:#000;border:1px solid #333;border-radius:12px;padding:12px 14px;color:#fff;font:inherit;font-size:14px;min-width:0}
  .ms-out{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:12px}.ms-out[hidden],#siteGroup[hidden]{display:none}
  .ms-out code{flex:1 1 100%;font-size:14px;color:#fff;word-break:break-all}
  .ms-msg{font-size:14px;margin:10px 0 0;color:#9a9a9a}.ms-msg.err{color:#ff8a8a}
  `;
  document.head.appendChild(st2);
  const SITES = "orynx_sites";
  const readSites = () => { try { return JSON.parse(localStorage.getItem(SITES) || "{}"); } catch (_) { return {}; } };
  function kitNow() {
    try { if (typeof kitActive !== "undefined" && kitActive && kitActive.kit) return kitActive; } catch (_) {}
    try { return JSON.parse(localStorage.getItem("orynx_kit_v1") || "null"); } catch (_) { return null; }
  }
  function logoNow() {
    const a = document.querySelector("#logos .logo.pick a") || document.querySelector("#logos .logo a");
    return a && a.dataset.sig ? { src: a.href, sig: a.dataset.sig } : null;
  }
  async function colorLogo(src) {
    const im = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
    const cv = document.createElement("canvas"); cv.width = cv.height = 16; const c = cv.getContext("2d"); c.drawImage(im, 0, 0, 16, 16);
    const d = c.getImageData(0, 0, 16, 16).data; const hx = (r, g, b) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
    const basic = hx(d[0], d[1], d[2]);
    let best = null, score = -1;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const sat = mx ? (mx - mn) / mx : 0; const sk = sat * (l > .25 && l < .92 ? 1 : .2);
      if (sk > score) { score = sk; best = hx(r, g, b); }
    }
    return { basic, accent: score > .15 ? best : "#ffffff" };
  }
  let themePick = "night";
  function installSite() {
    const ref = $("threadGroup"); if (!ref || $("siteGroup")) return;
    const g = document.createElement("div"); g.className = "group"; g.id = "siteGroup";
    g.innerHTML = `<h3>Mini website <span>(free, hosted on orynxai.xyz)</span></h3>
      <p class="ms-sub">Turn this kit into a one-page site for your token. No coding needed. Add your contract address now or after you launch.</p>
      <div class="ms-theme" role="group" aria-label="Site style">${THEME_MS.map((t) => `<button type="button" data-t="${t.id}" aria-pressed="${t.id === themePick}"><i style="background:${t.w[0]}"><b style="background:${t.w[1]}"></b></i>${t.name}</button>`).join("")}</div>
      <div class="ms-in"><input id="msCa" maxlength="42" placeholder="Contract address (optional, 0x…)" aria-label="Contract address">
      <input id="msX" maxlength="60" placeholder="X handle, e.g. @yourtoken (optional)" aria-label="X handle">
      <input id="msTg" maxlength="80" placeholder="Telegram link, e.g. t.me/yourtoken (optional)" aria-label="Telegram link"></div>
      <div class="banner-act"><button class="pill solid" id="msBtn" type="button">Publish my site</button></div>
      <p class="ms-msg" id="msMsg" hidden></p>
      <div class="ms-out" id="msOut" hidden><code id="msUrl"></code><a class="pill solid" id="msOpen" target="_blank" rel="noopener">Open site</a><button class="pill line" id="msCopy" type="button">Copy link</button><a class="pill line" id="msX2" target="_blank" rel="noopener">Post on X</a></div>`;
    ref.insertAdjacentElement("afterend", g);
    g.querySelectorAll(".ms-theme button").forEach((b) => b.onclick = () => { themePick = b.dataset.t; g.querySelectorAll(".ms-theme button").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); });
    $("msBtn").onclick = publish;
    fillSite();
  }
  function showResultSite(r, k) {
    $("msOut").hidden = false; $("msUrl").textContent = r.url.replace(/^https?:\/\//, "");
    $("msOpen").href = r.url; $("msCopy").onclick = () => navigator.clipboard.writeText(r.url).then(() => { $("msCopy").textContent = "Copied"; setTimeout(() => $("msCopy").textContent = "Copy link", 1400); }).catch(() => {});
    const u = (k.kit.options || [])[0] || {};
    $("msX2").href = "https://x.com/intent/post?text=" + encodeURIComponent(`${u.name || ""}${u.ticker ? " $" + u.ticker : ""} has a home now 🏠\n${k.kit.tagline || ""}\n\n${r.url}`);
    $("msBtn").textContent = "Update my site";
  }
  function fillSite() {
    if (!$("siteGroup")) return;
    const k = kitNow(); const s = k && readSites()[k.kid];
    $("msOut").hidden = true; $("msMsg").hidden = true; $("msBtn").textContent = "Publish my site";
    ["msCa", "msX", "msTg"].forEach((id) => { $(id).value = ""; });
    if (s) {
      $("msCa").value = s.ca || ""; $("msX").value = s.x || ""; $("msTg").value = s.tg || "";
      themePick = s.theme || "night"; document.querySelectorAll("#siteGroup .ms-theme button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.t === themePick)));
      showResultSite(s, k);
    }
    $("siteGroup").hidden = !(k && k.sig);
  }
  async function publish() {
    const k = kitNow(), logo = logoNow(), msg = $("msMsg"), btn = $("msBtn");
    msg.hidden = true; msg.className = "ms-msg";
    if (!k || !k.sig) { msg.textContent = "Build a kit first."; msg.hidden = false; return; }
    if (!logo) { msg.textContent = "Wait for your logos, then publish."; msg.hidden = false; return; }
    const ca = $("msCa").value.trim();
    if (ca && !/^0x[0-9a-fA-F]{40}$/.test(ca)) { msg.textContent = "That contract address doesn't look right. It starts with 0x and has 42 characters."; msg.className = "ms-msg err"; msg.hidden = false; return; }
    const start = btn.textContent; btn.disabled = true; btn.textContent = "Publishing…";
    try {
      const w = await colorLogo(logo.src).catch(() => ({ basic: "#111111", accent: "#ffffff" }));
      const u = (k.kit.options || [])[0] || {}; const old = readSites()[k.kid] || {};
      const r = await api("/api/site", { name: u.name || "", ticker: u.ticker || "", tagline: k.kit.tagline || "", roast: k.kit.roast || "", mode: k.mode || "ai", sig: k.sig,
        description: k.kit.description || "", features: k.kit.features || [], logo: logo.src.split(",")[1], logo_sig: logo.sig,
        ca, x: $("msX").value.trim(), tg: $("msTg").value.trim(), theme: themePick, basic: w.basic, accent: w.accent, slug: old.slug || "", key: old.key || "" });
      const entries = readSites(); entries[k.kid] = { slug: r.slug, key: r.key, url: r.url, ca, x: $("msX").value.trim(), tg: $("msTg").value.trim(), theme: themePick };
      save(SITES, JSON.stringify(entries));
      showResultSite(r, k);
      msg.textContent = old.slug ? "Updated. Changes show up within a minute." : "Your site is live. Share the link!"; msg.hidden = false;
    } catch (err) { msg.textContent = err.message; msg.className = "ms-msg err"; msg.hidden = false; btn.textContent = start; }
    finally { btn.disabled = false; }
  }
  function watchKit() {
    installSite();
    try {
      const original = Storage.prototype.setItem; let t2 = null;
      Storage.prototype.setItem = function (k, v) { const r = original.call(this, k, v); if (k === "orynx_kit_v1") { clearTimeout(t2); t2 = setTimeout(fillSite, 150); } return r; };
    } catch (_) {}
    const roast = $("roast"); if (!roast) return;
    let timer = null;
    new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(fillSite, 400); }).observe(roast, { childList: true, characterData: true, subtree: true });
  }

  async function t_start() {
    watchKit();
    await loadEarly();
    installBadge(); installEarlyToken();
    loadKotd();
    const n = await loadFeed();
    let attempt = 0;
    const wait = async () => { if (await decorateBonding(n) || ++attempt > 20) return; setTimeout(wait, 700); };
    wait();
    setInterval(async () => { if (document.hidden) return; const m = await loadFeed(); decorateBonding(m); }, 60000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", t_start); else t_start();
})();
