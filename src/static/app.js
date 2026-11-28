{
const LINKS = {};

const $ = (id) => document.getElementById(id);
const countLogo = () => (gating && holder ? 4 : 2);
let brief = "", ticker = "logo", busy = false, mode = "ai", modeKit = "ai";
const MODES = {
  ai: { label: "What does your AI project do?", placeholder: "An AI agent that tracks whale wallets", features: "Key features",
        ideas: ["An AI agent that tracks whale wallets", "An AI that explains any token contract", "An AI copilot for trading stock tokens"] },
  meme: { label: "What's your meme?", placeholder: "A frog who only trades at 3am", features: "Lore",
        ideas: ["A frog who only trades at 3am", "A cat CEO who never sells", "A chicken scared of liquidation"] },
};
function pickMode(m) {
  mode = m;
  document.querySelectorAll(".mode").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === m)));
  $("ideLabel").textContent = MODES[m].label;
  $("ide").placeholder = MODES[m].placeholder;
  $("ideas").replaceChildren(...MODES[m].ideas.map((t) => {
    const b = document.createElement("button"); b.className = "idea"; b.type = "button"; b.textContent = t;
    b.onclick = () => { $("ide").value = t; $("ide").focus(); };
    return b;
  }));
}

const messageWait = [
  "Reading your idea... bold move.",
  "Checking whether this has been done a thousand times...",
  "Naming it something you won't regret...",
  "Drawing your logos...",
];

function showStatus(t) { $("statusText").textContent = t; $("status").classList.add("show"); }
function hideStatus() { $("status").classList.remove("show"); }
function showError(t) { $("error").textContent = t; $("error").classList.add("show"); }
function hideError() { $("error").classList.remove("show"); }

async function api(url, data) {
  const r = await fetch(url, {
    method: data ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: data ? JSON.stringify(data) : undefined,
  });
  let fill = {};
  try { fill = await r.json(); } catch (_) {}
  if (!r.ok) throw new Error(typeof fill.detail === "string" ? fill.detail : "Something went wrong. Try again in a moment.");
  return fill;
}

let gating = false, holder = false;
const short = (a) => a.slice(0, 6) + "…" + a.slice(-4);
const num = (n) => Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });

async function loadQuota() {
  try {
    const s = await api("/api/quota");
    $("quota").textContent = `Free today: ${s.kit} kit${s.kit === 1 ? "" : "s"} and ${s.logo} logo${s.logo === 1 ? "" : "s"} left`;
    gating = !!s.gating; holder = !!s.holder;
    if (s.total) { $("totalNum").textContent = num(s.total); $("totalKit").hidden = false; $("metaRight").hidden = true; }
    $("logoInfo").textContent = gating && holder ? "(PNG, HQ 2048 × 2048 · 4 options)" : "(PNG, 1024 × 1024 · HQ 2048 for $ORYNX holders)";
    showWallet(s);
    if (s.token) showToken(s.token);
    if (typeof s.chat === "number" && !records.length) $("chatQuota").textContent = `${holder ? "Holder" : "Free"} questions left today: ${s.chat}`;
  } catch (_) {}
}

let tokenShow = false, tokenCa = "";
function showToken(ca) {
  if (tokenShow || !/^0x[0-9a-f]{40}$/.test(ca)) return;
  tokenShow = true; tokenCa = ca;
  $("caHome").textContent = ca; $("caBuy").href = `https://ponsfamily.com/launchpad/${ca}`; $("caScan").href = `https://robin.etherscan.io/token/${ca}`;
  $("caHomeCopy").onclick = () => copy(ca, $("caHomeCopy")); $("ca").classList.add("on");
  const box = $("tokenBox");
  box.innerHTML = `<span class="live-tag"><i></i>$ORYNX is live on pons</span>
    <p>Contract address</p>
    <div class="ca"><code>${ca}</code><button type="button" id="caCopy">Copy</button></div>
    <div class="live-acts">
      <a class="pill solid" href="https://ponsfamily.com/launchpad/${ca}" target="_blank" rel="noopener">Buy on pons</a>
      <a class="pill line" href="https://robin.etherscan.io/token/${ca}" target="_blank" rel="noopener">View on explorer</a>
    </div>
    <p>Only trust this address and posts from <a href="https://x.com/orynxhq" target="_blank" rel="noopener">@orynxhq</a>.</p>`;
  $("caCopy").onclick = () => copy(ca, $("caCopy"));
}

function showWallet(s) {
  $("wallet").hidden = !gating;
  if (!gating) return;
  const info = $("walletInfo"), btn = $("walletBtn");
  if (s.wallet && s.holder) {
    btn.textContent = "Disconnect";
    info.innerHTML = `<b>Holder ✓</b> ${short(s.wallet)} · every logo style unlocked`;
  } else if (s.wallet) {
    btn.textContent = "Disconnect";
    info.textContent = `${short(s.wallet)} holds ${num(s.balance)} $ORYNX. Hold ${num(s.min_hold)} to unlock 10 kits a day.`;
  } else {
    btn.textContent = "Connect wallet";
    info.textContent = `Hold ${num(s.min_hold)} $ORYNX for 10 kits a day and every logo style.`;
  }
  btn.dataset.state = s.wallet ? "on" : "off";
  setButtonStyle(!busy);
}

const ROBINHOOD = { chainId: "0x1237", chainName: "Robinhood Chain", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: ["https://rpc.mainnet.chain.robinhood.com"], blockExplorerUrls: ["https://robin.etherscan.io"] };
async function toRobinhood(eth) {
  try { await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: ROBINHOOD.chainId }] }); }
  catch (e) {
    const code = e && (e.code || (e.data && e.data.originalError && e.data.originalError.code));
    if (code === 4902 || code === -32603) { try { await eth.request({ method: "wallet_addEthereumChain", params: [ROBINHOOD] }); } catch (_) {} }
  }
}

const WC_ID = "8f450ba8226f631e15b7e760c44b2d4c";
const WC_SRC = ["https://esm.sh/@walletconnect/ethereum-provider@2.26.0", "https://cdn.jsdelivr.net/npm/@walletconnect/ethereum-provider@2.26.0/+esm"];
let wcProv = null;
async function providerWc() {
  if (!wcProv) {
    let mod = null;
    for (const src of WC_SRC) { try { mod = await import(src); break; } catch (_) {} }
    const EP = mod && (mod.EthereumProvider || (mod.default && (mod.default.EthereumProvider || mod.default)));
    if (!EP || !EP.init) throw new Error("Couldn't load WalletConnect. Check your connection and try again.");
    wcProv = await EP.init({
      projectId: WC_ID, showQrModal: true, optionalChains: [4663, 1],
      rpcMap: { 4663: ROBINHOOD.rpcUrls[0] },
      metadata: { name: "Orynx", description: "AI launch kits for Robinhood Chain", url: location.origin, icons: [location.origin + "/og.png"] },
    });
    wcProv.on && wcProv.on("disconnect", () => { wcProv = null; });
  }
  if (!wcProv.session) await wcProv.connect();
  return wcProv;
}

async function connectWallet() {
  hideError();
  const btn = $("walletBtn");
  if (btn.dataset.state === "on") {
    await api("/api/wallet/logout", {});
    if (wcProv && wcProv.session) { try { await wcProv.disconnect(); } catch (_) {} wcProv = null; }
    return loadQuota();
  }
  const useWc = !window.ethereum;
  if (useWc && !/^[0-9a-f]{32}$/i.test(WC_ID)) { showError("No wallet found. Open orynxai.xyz in your wallet app's browser (MetaMask, Rabby or Coinbase Wallet) to connect."); return; }
  const start = btn.textContent;
  btn.disabled = true;
  try {
    let eth = window.ethereum;
    if (useWc) { btn.textContent = "Opening wallets..."; eth = await providerWc(); }
    const account = await eth.request({ method: "eth_requestAccounts" });
    const address = account && account[0];
    if (!address) throw new Error("No account found in your wallet.");
    await toRobinhood(eth);
    const message = `Sign in to Orynx\nAddress: ${address.toLowerCase()}\nNetwork: Robinhood Chain\nTime: ${Math.floor(Date.now() / 1000)}\n\nThis only proves you own this wallet. It is free and never moves your funds.`;
    const hex = "0x" + Array.from(new TextEncoder().encode(message), (b) => b.toString(16).padStart(2, "0")).join("");
    if (useWc) { btn.textContent = "Approve in your wallet..."; $("walletInfo").textContent = "Open your wallet app and approve the free sign-in request."; }
    const signature = await eth.request({ method: "personal_sign", params: [hex, address] });
    await api("/api/wallet", { address, message, signature });
  } catch (err) {
    const cancel = err && (err.code === 4001 || /reject|denied|closed|cancel/i.test(err.message || ""));
    if (!cancel) showError(err.message || "Couldn't connect your wallet. Try again.");
  } finally {
    btn.disabled = false; btn.textContent = start;
    loadQuota();
  }
}

function copy(text, button) {
  navigator.clipboard.writeText(text).then(() => {
    if (!button) return;
    const start = button.textContent;
    button.textContent = "Copied"; button.classList.add("done");
    setTimeout(() => { button.textContent = start; button.classList.remove("done"); }, 1400);
  }).catch(() => {});
}

function blockCopy(text, postX) {
  const div = document.createElement("div");
  div.className = "copyblock"; div.textContent = text;
  const b = document.createElement("button");
  b.className = "copy"; b.type = "button"; b.textContent = "Copy";
  b.onclick = () => copy(text, b);
  div.appendChild(b);
  if (postX) {
    const a = document.createElement("a");
    a.className = "xpost"; a.target = "_blank"; a.rel = "noopener";
    a.href = "https://x.com/intent/post?text=" + encodeURIComponent(text);
    a.textContent = "Post on X";
    div.append(document.createElement("br"), a);
  }
  return div;
}

function fill(id, ...el) { $(id).replaceChildren(...el); }
// Names: tap one to make it the name your kit uses (share, header, video, mini site). Copy stays one tap away.
function drawNames(kit) {
  fill("names", ...kit.options.map((p, i) => {
    const b = document.createElement("div");
    b.className = "name" + (i === 0 ? " on" : ""); b.tabIndex = 0; b.setAttribute("role", "button");
    b.setAttribute("aria-pressed", String(i === 0)); b.title = i === 0 ? "This is the name your kit uses" : "Use this name";
    const name = document.createElement("span"); name.textContent = p.name;
    if (i === 0) { const t = document.createElement("em"); t.className = "nm-use"; t.textContent = "In use"; name.append(t); }
    const code = document.createElement("code"); code.textContent = "$" + p.ticker;
    const cp = document.createElement("button"); cp.type = "button"; cp.className = "nm-copy"; cp.textContent = "Copy"; cp.setAttribute("aria-label", `Copy ${p.name}`);
    cp.onclick = (e) => { e.stopPropagation(); copy(`${p.name} ($${p.ticker})`); cp.textContent = "Copied"; setTimeout(() => cp.textContent = "Copy", 1200); };
    b.append(name, code, cp);
    const go = () => { if (i > 0) pickName(i, b); };
    b.onclick = go; b.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } };
    return b;
  }));
}
let pickingName = false;
async function pickName(i, el) {
  if (pickingName || !kitActive) return;
  const k = kitActive.kit, cur = k.options[0] || {}, want = k.options[i]; if (!want) return;
  pickingName = true; el.classList.add("busy");
  try {
    let sig = kitActive.sig;
    if (sig) {
      const h = await api("/api/kit/pick", { mode: kitActive.mode, sig, name: cur.name || "", ticker: cur.ticker || "", tagline: k.tagline, roast: k.roast,
        pick_name: want.name, pick_ticker: want.ticker });
      sig = h.sig;
    }
    k.options = [want, ...k.options.filter((_, j) => j !== i)];
    kitActive.sig = sig; ticker = want.ticker || ticker; kitActive.ticker = ticker;
    if (kitActive.link) { kitActive.link = ""; $("shareRow").hidden = true; }
    $("shareKit").disabled = false; $("shareKit").textContent = "Share to community"; $("shareKit").hidden = !galleryActive || !kitActive.sig;
    drawNames(k); checkTicker(k.options); drawThread(); saveKit(); makeBanner();
  } catch (err) { showError(err.message); }
  finally { pickingName = false; el.classList.remove("busy"); }
}

function showKit(kit) {
  $("roast").textContent = kit.roast || "Fine. Idea accepted. Don't get cocky.";
  drawNames(kit);
  $("featuresLabel").textContent = MODES[modeKit].features;
  fill("tagline", blockCopy(kit.tagline));
  fill("features", blockCopy(kit.features.map((f) => "• " + f).join("\n")));
  fill("description", blockCopy(kit.description));
  fill("bio", blockCopy(kit.bio_x));
  fill("tweets", ...kit.tweet.map((t) => blockCopy(t, true)));
  fill("welcome", blockCopy(kit.welcome_telegram));
  checkTicker(kit.options);
  drawChecklist();
  drawThread();
  $("result").classList.add("show");
}

function setButtonStyle(active) {
  document.querySelectorAll(".style").forEach((b) => {
    const key = gating && !holder && b.dataset.style !== "classic";
    b.classList.toggle("locked", key);
    b.disabled = !active || key;
    b.title = key ? "For $ORYNX holders" : "";
  });
}

async function makeLogo(style) {
  setButtonStyle(false);
  const box = $("logos"); box.replaceChildren();
  const slot = Array.from({ length: countLogo() }, () => {
    const k = document.createElement("div"); k.className = "logo loading";
    const g = document.createElement("div"); g.className = "img";
    k.appendChild(g); box.appendChild(k); return k;
  });
  await Promise.all(slot.map(async (k, i) => {
    const g = k.querySelector(".img");
    try {
      const h = await api("/api/logo", { brief, style, variant: i + 1, mode: modeKit, background: logoBg });
      const src = "data:image/png;base64," + h.png;
      const img = document.createElement("img"); img.src = src; img.alt = `Logo option ${i + 1}`;
      g.replaceChildren(img, usedMark()); g.onclick = () => pickLogo(k);
      const a = document.createElement("a");
      a.href = src; a.download = `${ticker}_${style}_${i + 1}${h.hq ? "_hq" : ""}.png`; a.textContent = h.hq ? "Download HQ PNG" : "Download PNG";
      if (h.sig) a.dataset.sig = h.sig;
      if (h.svg) { a.dataset.svg = h.svg; a.dataset.style = style; a.dataset.bg = logoBg; }
      k.appendChild(a);
    } catch (err) {
      g.textContent = err.message;
    } finally { k.classList.remove("loading"); }
  }));
  setButtonStyle(true);
  if (kitActive) kitActive.pick = 0;
  markOptions();
  saveKit();
  makeBanner();
  loadQuota();
}

$("form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const ide = $("ide").value.trim();
  if (!ide) { $("ide").focus(); return; }
  if (busy) return;
  busy = true; $("send").disabled = true; hideError();
  let n = 0; showStatus(messageWait[0]);
  const play = setInterval(() => showStatus(messageWait[++n % messageWait.length]), 2500);
  try {
    modeKit = mode;
    const name = $("nameOwn").value.trim(), tickerWant = $("tickerOwn").value.replace(/[^a-z0-9]/gi, "").toUpperCase();
    const h = await api("/api/kit", { ide, mode: modeKit, name, ticker: tickerWant });
    if (h.rejected) { showError("Can't build this one: " + h.reason + " Try an original idea. This didn't use your free kits."); return; }
    brief = h.kit.brief_logo || ide;
    ticker = (h.kit.options[0] && h.kit.options[0].ticker) || "logo";
    kitActive = { kit: h.kit, mode: modeKit, brief, ticker, sig: h.sig || "", kid: Date.now().toString(36), check: [], pick: 0, link: "" };
    $("shareRow").hidden = true;
    $("shareKit").hidden = !galleryActive || !kitActive.sig; $("shareKit").disabled = false; $("shareKit").textContent = "Share to community";
    $("restored").hidden = true; $("redoMsg").hidden = true; $("bannerGroup").hidden = true; bannerData = "";
    resetVideo(); $("videoGroup").hidden = true; $("studioGroup").hidden = true;
    setRedo();
    showKit(h.kit);
    saveKit();
    recordRef();
    clearInterval(play); hideStatus();
    $("result").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    await makeLogo("classic");
  } catch (err) {
    showError(err.message);
  } finally {
    clearInterval(play); hideStatus();
    busy = false; $("send").disabled = false;
    loadQuota();
  }
});

document.querySelectorAll(".mode").forEach((b) => b.onclick = () => pickMode(b.dataset.mode));
$("walletBtn").onclick = connectWallet;
$("ownToggle").onclick = () => {
  const openIt = $("own").hidden;
  $("own").hidden = !openIt; $("ownToggle").setAttribute("aria-expanded", String(openIt));
  $("ownToggle").textContent = openIt ? "Let Si Dev pick the name" : "Have your own name or logo?";
  if (openIt) $("nameOwn").focus(); else { $("nameOwn").value = ""; $("tickerOwn").value = ""; }
};
pickMode("ai");
document.querySelectorAll(".style").forEach((b) => b.onclick = () => { if (brief) makeLogo(b.dataset.style); });

// Logo background colour: applies to the next logos, and recolours the current ones without using quota
let logoBg = "";
function markSwatch() {
  document.querySelectorAll("#bgPick .swatch").forEach((b) => b.classList.toggle("on", (b.dataset.bg || "") === logoBg));
  $("bgCustomWrap").classList.toggle("on", !!logoBg && !Array.from(document.querySelectorAll("#bgPick .swatch")).some((b) => b.dataset.bg === logoBg));
  $("bgCustomWrap").style.setProperty("--c", logoBg || "#888");
}
async function recolorLogos() {
  const links = Array.from(document.querySelectorAll("#logos .logo a")).filter((a) => a.dataset.svg);
  if (!links.length) return;
  $("bgPick").classList.add("busy");
  await Promise.all(links.map(async (a) => {
    const k = a.closest(".logo"), img = k.querySelector("img");
    if (!a.dataset.orig) { a.dataset.orig = a.href; a.dataset.origSig = a.dataset.sig || ""; a.dataset.origSvg = a.dataset.svg; }
    try {
      let src, sig;
      if (!logoBg) { src = a.dataset.orig; sig = a.dataset.origSig; a.dataset.svg = a.dataset.origSvg; }
      else {
        const h = await api("/api/logo/recolor", { svg: a.dataset.origSvg, background: logoBg, mode: modeKit, style: a.dataset.style || "classic" });
        src = "data:image/png;base64," + h.png; sig = h.sig || "";
      }
      img.src = src; a.href = src; a.dataset.sig = sig; a.dataset.bg = logoBg;
    } catch (_) {}
  }));
  $("bgPick").classList.remove("busy");
  saveKit(); resetVideo(); makeBanner();
}
document.querySelectorAll("#bgPick .swatch").forEach((b) => b.onclick = () => { logoBg = b.dataset.bg || ""; markSwatch(); recolorLogos(); });
$("bgCustom").addEventListener("change", (e) => { logoBg = e.target.value.toLowerCase(); markSwatch(); recolorLogos(); });
markSwatch();

Object.entries(LINKS).forEach(([name, url]) => {
  if (!url.startsWith("https://")) return;
  const a = document.createElement("a");
  a.className = "pill line"; a.href = url; a.target = "_blank"; a.rel = "noopener"; a.textContent = name;
  $("socials").appendChild(a);
});

document.querySelectorAll(".ex-cta").forEach((b) => b.onclick = () => { pickMode(b.dataset.mode); toBuild(); });

(() => {
  const cv = $("stars"); const ctx = cv.getContext && cv.getContext("2d"); if (!ctx) return;
  const idle = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let w = 0, h = 0, pts = [], running = true;
  const measure = () => {
    const r = window.devicePixelRatio || 1; w = cv.clientWidth; h = cv.clientHeight;
    cv.width = w * r; cv.height = h * r; ctx.setTransform(r, 0, 0, r, 0, 0);
    const n = Math.round(Math.min(90, w * h / 14000));
    pts = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.4 + .3, v: Math.random() * .25 + .05, f: Math.random() * Math.PI * 2 }));
  };
  const draw = (t) => {
    ctx.clearRect(0, 0, w, h);
    for (const p of pts) {
      if (!idle) { p.y -= p.v; if (p.y < -4) { p.y = h + 4; p.x = Math.random() * w; } }
      const a = .25 + .55 * (0.5 + 0.5 * Math.sin(t / 900 + p.f));
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`; ctx.fill();
    }
  };
  const loop = (t) => { if (running) draw(t); if (!idle) requestAnimationFrame(loop); };
  measure(); new ResizeObserver(measure).observe(cv);
  new IntersectionObserver(([e]) => { running = e.isIntersecting; }).observe(cv);
  requestAnimationFrame(loop);
})();

const SAVE = "orynx_kit_v1";
let kitActive = null;
function textKit(k, m) {
  const main = k.options[0] || { name: "My token", ticker: "" };
  const bag = [
    `${main.name}${main.ticker ? " ($" + main.ticker + ")" : ""}`,
    "Launch kit made with Orynx · orynxai.xyz", "",
    "NAME OPTIONS", ...k.options.map((p) => `- ${p.name} ($${p.ticker})`), "",
    "TAGLINE", k.tagline, "",
    (m === "meme" ? "LORE" : "KEY FEATURES"), ...k.features.map((f) => "• " + f), "",
    "DESCRIPTION", k.description, "",
    "X BIO", k.bio_x, "",
    "FIRST POSTS ON X", ...k.tweet.map((t, i) => `${i + 1}. ${t}`), "",
    "TELEGRAM WELCOME", k.welcome_telegram, "",
  ];
  return bag.join("\n");
}
const TABLE_CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) c = TABLE_CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (~c) >>> 0; }
function makeZip(files) {
  const enc = new TextEncoder(), fill = [], central = []; let off = 0;
  for (const f of files) {
    const nm = enc.encode(f.name), crc = crc32(f.data), n = f.data.length;
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(12, 0x21, true);
    lh.setUint32(14, crc, true); lh.setUint32(18, n, true); lh.setUint32(22, n, true); lh.setUint16(26, nm.length, true);
    fill.push(new Uint8Array(lh.buffer), nm, f.data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(14, 0x21, true);
    ch.setUint32(16, crc, true); ch.setUint32(20, n, true); ch.setUint32(24, n, true); ch.setUint16(28, nm.length, true); ch.setUint32(42, off, true);
    central.push(new Uint8Array(ch.buffer), nm);
    off += 30 + nm.length + n;
  }
  const size = central.reduce((a, b) => a + b.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, size, true); end.setUint32(16, off, true);
  return new Blob([...fill, ...central, new Uint8Array(end.buffer)], { type: "application/zip" });
}
function logoCurrent() {
  return Array.from(document.querySelectorAll("#logos .logo a")).map((a) => ({ src: a.href, name: a.download, hq: a.textContent.includes("HQ"), sig: a.dataset.sig || "", svg: a.dataset.svg || "", style: a.dataset.style || "", bg: a.dataset.bg || "" }));
}
function saveKit() {
  if (!kitActive) return;
  if (!kitActive.kid) kitActive.kid = Date.now().toString(36);
  const data = { ...kitActive, logos: logoCurrent(), t: Date.now() };
  saveHistory(data);
  try { localStorage.setItem(SAVE, JSON.stringify(data)); }
  catch (_) { try { localStorage.setItem(SAVE, JSON.stringify({ ...data, logos: [] })); } catch (_) {} }
}
function installLogo(items) {
  const box = $("logos"); box.replaceChildren();
  items.forEach((l, i) => {
    const k = document.createElement("div"); k.className = "logo";
    const g = document.createElement("div"); g.className = "img";
    const img = document.createElement("img"); img.src = l.src; img.alt = `Logo option ${i + 1}`; g.append(img, usedMark()); g.onclick = () => pickLogo(k);
    const a = document.createElement("a"); a.href = l.src; a.download = l.name; a.textContent = l.hq ? "Download HQ PNG" : "Download PNG";
    if (l.sig) a.dataset.sig = l.sig;
    if (l.svg) { a.dataset.svg = l.svg; a.dataset.style = l.style || "classic"; }
    if (l.bg) a.dataset.bg = l.bg;
    k.append(g, a); box.append(k);
  });
}
async function downloadAll() {
  if (!kitActive) return;
  const button = $("dlAll"), start = button.textContent;
  button.disabled = true; button.textContent = "Packing...";
  try {
    const enc = new TextEncoder();
    const files = [{ name: "launch-kit.txt", data: enc.encode(textKit(kitActive.kit, kitActive.mode)) }];
    if (bannerData) {
      const bb = atob(bannerData.split(",")[1] || ""); const ba = new Uint8Array(bb.length);
      for (let i = 0; i < bb.length; i++) ba[i] = bb.charCodeAt(i);
      files.push({ name: `${(kitActive.ticker || "orynx").toLowerCase()}_x_header.png`, data: ba });
    }
    for (const l of logoCurrent()) {
      const binary = atob(l.src.split(",")[1] || ""); const arr = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
      files.push({ name: l.name, data: arr });
    }
    const url = URL.createObjectURL(makeZip(files));
    const a = document.createElement("a"); a.href = url; a.download = `${(kitActive.ticker || "orynx").toLowerCase()}_launch_kit.zip`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    button.textContent = "Downloaded";
  } catch (_) { button.textContent = "Try again"; }
  setTimeout(() => { button.textContent = start; button.disabled = false; }, 1600);
}
function restoreKit() {
  let data = null;
  try { data = JSON.parse(localStorage.getItem(SAVE) || "null"); } catch (_) {}
  if (!data || !data.kit || !Array.isArray(data.kit.options) || Date.now() - (data.t || 0) > 7 * 864e5) return;
  openData(data);
  $("restored").hidden = false;
}
function openData(data) {
  kitActive = { kit: data.kit, mode: data.mode, brief: data.brief, ticker: data.ticker, sig: data.sig || "", kid: data.kid || Date.now().toString(36), check: data.check || [], pick: data.pick || 0, link: data.link || "" };
  modeKit = data.mode || "ai"; brief = data.brief || ""; ticker = data.ticker || "logo";
  resetVideo(); $("redoMsg").hidden = true;
  showKit(data.kit);
  $("logos").replaceChildren();
  if (data.logos && data.logos.length) installLogo(data.logos);
  markOptions();
  setButtonStyle(true);
  setRedo();
  showLinkKit();
  $("shareKit").hidden = !galleryActive || !kitActive.sig; $("shareKit").disabled = !!kitActive.link; $("shareKit").textContent = kitActive.link ? "Shared to community ✓" : "Share to community";
  makeBanner();
  drawHistory();
}
$("dlAll").onclick = downloadAll;
$("copyAll").onclick = () => { if (kitActive) copy(textKit(kitActive.kit, kitActive.mode), $("copyAll")); };
$("clearKit").onclick = () => {
  try { localStorage.removeItem(SAVE); } catch (_) {}
  kitActive = null; brief = ""; $("shareKit").hidden = true; $("shareRow").hidden = true; $("tkNote").hidden = true; $("pickHint").hidden = true; drawHistory(); $("bannerGroup").hidden = true; bannerData = ""; setRedo(); resetVideo(); $("videoGroup").hidden = true; $("studioGroup").hidden = true; $("result").classList.remove("show"); $("restored").hidden = true; $("logos").replaceChildren();
};

let galleryActive = false;
const ADMIN = new URLSearchParams(location.search).has("admin");
function cardCommunity(it, rank) {
  const a = document.createElement("article"); a.className = "ex";
  const mime = document.createElement("span"); mime.className = "ex-type" + (it.mode === "meme" ? " meme" : ""); mime.textContent = it.mode === "meme" ? "Meme coin" : "AI project";
  const top = document.createElement("div"); top.className = "ex-top";
  const img = document.createElement("img"); img.className = "ex-logo"; img.loading = "lazy"; img.alt = `${it.name} logo`; img.src = `/api/gallery/logo/${it.id}`;
  const nm = document.createElement("div"); const b = document.createElement("b"); b.textContent = it.name; const c = document.createElement("code"); c.textContent = it.ticker ? "$" + it.ticker : "";
  nm.append(b, c); top.append(img, nm);
  const tag = document.createElement("p"); tag.className = "ex-tag"; tag.textContent = it.tagline;
  a.append(mime, top, tag);
  if (it.roast) { const r = document.createElement("p"); r.className = "ex-roast"; const s = document.createElement("b"); s.textContent = "Si Dev: "; r.append(s, document.createTextNode(it.roast)); a.append(r); }
  if (rank) { const rk = document.createElement("span"); rk.className = "ex-rank"; rk.textContent = "#" + rank; a.append(rk); }
  const foot = document.createElement("div"); foot.className = "ex-foot";
  const like = document.createElement("button"); like.type = "button"; like.className = "ex-like" + (alreadyLiked(it.id) ? " on" : "");
  like.setAttribute("aria-label", "Like " + it.name);
  const cnt = document.createElement("span"); cnt.textContent = it.likes || 0;
  like.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>';
  like.append(cnt);
  like.onclick = () => doLike(it, like, cnt);
  const openIt = document.createElement("a"); openIt.className = "ex-open"; openIt.href = `/k/${it.id}`; openIt.textContent = "Open kit page";
  const remix = document.createElement("button"); remix.type = "button"; remix.className = "ex-remix"; remix.textContent = "Remix";
  remix.onclick = () => remixKit(it);
  foot.append(like, remix, openIt); a.append(foot);
  if (ADMIN) {
    const x = document.createElement("button"); x.className = "ex-del"; x.type = "button"; x.textContent = "×"; x.title = "Remove";
    x.onclick = async () => { const key = prompt("Admin key"); if (!key) return; try { await api("/api/gallery/remove", { id: it.id, key }); a.remove(); } catch (err) { alert(err.message); } };
    a.append(x);
  }
  return a;
}
async function loadGallery() {
  try {
    const g = await api("/api/gallery");
    galleryActive = !!g.active;
    $("shareKit").hidden = !galleryActive || !kitActive || !kitActive.sig;
    if (g.items && g.items.length) { $("comGrid").replaceChildren(...g.items.map((it) => cardCommunity(it))); $("community").hidden = false;
      $("freshGrid").replaceChildren(...g.items.slice(0, 6).map((it) => cardCommunity(it))); $("fresh").classList.add("on"); }
    const top = g.top || [];
    $("topWrap").hidden = !top.length;
    if (top.length) $("topGrid").replaceChildren(...top.map((it, i) => cardCommunity(it, i + 1)));
  } catch (_) {}
}
async function shareKit() {
  if (!kitActive || !kitActive.sig) return;
  const logo = [logoOptions(), ...logoCurrent()].find((l) => l && l.sig);
  if (!logo) { showError("Wait for your logos, then share."); return; }
  const btn = $("shareKit"); btn.disabled = true; btn.textContent = "Sharing...";
  const main = kitActive.kit.options[0] || {};
  try {
    const h = await api("/api/gallery", { name: main.name || "", ticker: main.ticker || "", tagline: kitActive.kit.tagline, roast: kitActive.kit.roast,
      mode: kitActive.mode, sig: kitActive.sig, logo: logo.src.split(",")[1], logo_sig: logo.sig });
    btn.textContent = "Shared to community ✓";
    if (h && h.url) { kitActive.link = h.url; showLinkKit(); tick(5, true); saveKit(); }
    loadGallery();
  } catch (err) { btn.disabled = false; btn.textContent = "Share to community"; showError(err.message); }
}
$("shareKit").onclick = shareKit;

const KEY_LIKES = "orynx_likes_v1";
function listLikes() { try { return JSON.parse(localStorage.getItem(KEY_LIKES) || "[]"); } catch (_) { return []; } }
function alreadyLiked(id) { return listLikes().includes(id); }
async function doLike(it, button, cnt) {
  if (button.classList.contains("on")) return;
  button.classList.add("on", "pop"); setTimeout(() => button.classList.remove("pop"), 180);
  cnt.textContent = (Number(cnt.textContent) || 0) + 1;
  try {
    const h = await api("/api/gallery/like", { id: it.id });
    document.querySelectorAll(".ex-like").forEach((b) => { if (b.getAttribute("aria-label") === button.getAttribute("aria-label")) { b.classList.add("on"); b.lastChild.textContent = h.likes; } });
    try { localStorage.setItem(KEY_LIKES, JSON.stringify([...listLikes(), it.id].slice(-500))); } catch (_) {}
  } catch (err) {
    button.classList.remove("on"); cnt.textContent = Math.max(0, (Number(cnt.textContent) || 1) - 1);
  }
}

let bannerData = "";
function loadDraw(src) { return new Promise((ok, failed) => { const im = new Image(); im.onload = () => ok(im); im.onerror = failed; im.src = src; }); }
function wrap(ctx, text, cap) {
  const word = String(text || "").split(/\s+/); const row = []; let now = "";
  for (const k of word) { const attempt = now ? now + " " + k : k; if (ctx.measureText(attempt).width > cap && now) { row.push(now); now = k; } else now = attempt; }
  if (now) row.push(now); return row;
}
async function makeBanner() {
  setVideo();
  const logo = logoOptions();
  if (!kitActive || !logo) { $("bannerGroup").hidden = true; bannerData = ""; return; }
  try {
    try { await Promise.all([document.fonts.load("64px Michroma"), document.fonts.load("600 32px 'Instrument Sans'")]); } catch (_) {}
    const im = await loadDraw(logo.src);
    const W = 1500, H = 500, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const c = cv.getContext("2d");
    const s = document.createElement("canvas"); s.width = s.height = 8; const sc = s.getContext("2d"); sc.drawImage(im, 0, 0, 8, 8);
    const [r, g, b] = sc.getImageData(0, 0, 1, 1).data;
    const meme = kitActive.mode === "meme";
    const basic = meme ? `rgb(${r},${g},${b})` : "#050507";
    c.fillStyle = basic; c.fillRect(0, 0, W, H);
    const bright = meme && (0.299 * r + 0.587 * g + 0.114 * b) > 150;
    const gl = c.createRadialGradient(1190, 250, 0, 1190, 250, 520);
    gl.addColorStop(0, bright ? "rgba(255,255,255,.35)" : "rgba(255,255,255,.14)"); gl.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = gl; c.fillRect(0, 0, W, H);
    c.strokeStyle = bright ? "rgba(0,0,0,.10)" : "rgba(255,255,255,.08)"; c.lineWidth = 2;
    for (const rr of [230, 300, 370]) { c.beginPath(); c.arc(1190, 250, rr, 0, Math.PI * 2); c.stroke(); }
    c.save(); c.shadowColor = "rgba(0,0,0,.45)"; c.shadowBlur = 50; c.shadowOffsetY = 18;
    const L = 300, lx = 1040, ly = 100, rad = 64;
    c.beginPath(); c.moveTo(lx + rad, ly); c.arcTo(lx + L, ly, lx + L, ly + L, rad); c.arcTo(lx + L, ly + L, lx, ly + L, rad); c.arcTo(lx, ly + L, lx, ly, rad); c.arcTo(lx, ly, lx + L, ly, rad); c.closePath();
    c.fillStyle = "#000"; c.fill(); c.restore();
    c.save(); c.clip(); c.drawImage(im, lx, ly, L, L); c.restore();
    const color = bright ? "#111111" : "#ffffff", dim = bright ? "rgba(17,17,17,.7)" : "rgba(255,255,255,.62)";
    const main = kitActive.kit.options[0] || { name: "", ticker: "" };
    let size = 72; c.font = `${size}px Michroma, Arial Black, sans-serif`;
    while (c.measureText(main.name).width > 780 && size > 36) { size -= 4; c.font = `${size}px Michroma, Arial Black, sans-serif`; }
    c.fillStyle = color; c.textBaseline = "alphabetic"; c.fillText(main.name, 150, 205);
    c.font = "600 34px 'Instrument Sans', Arial, sans-serif"; c.fillStyle = dim; c.fillText(main.ticker ? "$" + main.ticker : "", 150, 262);
    c.font = "500 36px 'Instrument Sans', Arial, sans-serif"; c.fillStyle = color;
    wrap(c, kitActive.kit.tagline, 800).slice(0, 2).forEach((bar, i) => c.fillText(bar, 150, 342 + i * 48));
    bannerData = cv.toDataURL("image/png");
    $("bannerImg").src = bannerData; $("bannerDl").href = bannerData;
    $("bannerDl").download = `${(main.ticker || "orynx").toLowerCase()}_x_header.png`;
    $("bannerGroup").hidden = false;
  } catch (_) { $("bannerGroup").hidden = true; bannerData = ""; }
}

const DURATION_VIDEO = 14;
let videoUrl = "";
function setVideo() {
  const present = !!(kitActive && logoOptions());
  $("videoGroup").hidden = !present; $("studioGroup").hidden = !present;
  const hq = gating && holder;
  $("vidInfo").textContent = hq ? "(14 sec, HQ 1080p, no watermark)" : "(14 sec, 720p · HQ 1080p with no watermark for $ORYNX holders)";
}
function resetVideo() {
  if (videoUrl) { URL.revokeObjectURL(videoUrl); videoUrl = ""; }
  $("vidBox").replaceChildren($("vidEmpty") || Object.assign(document.createElement("div"), { id: "vidEmpty", className: "vid-empty" }));
  $("vidEmpty").textContent = "Your logo, name and story, animated with original music. Ready to post on X.";
  $("vidDl").hidden = true; $("vidMsg").textContent = ""; $("vidMake").textContent = "Make intro video"; $("vidMake").disabled = false;
}
function musicIntro(ac, out, meme, t_start) {
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const master = ac.createGain(); master.gain.value = 0.85;
  const comp = ac.createDynamicsCompressor(); master.connect(comp); comp.connect(out);
  master.gain.setValueAtTime(0.85, t_start + DURATION_VIDEO - 0.9); master.gain.linearRampToValueAtTime(0.0001, t_start + DURATION_VIDEO - 0.05);
  const bpm = meme ? 118 : 96, beat = 60 / bpm, bar = beat * 4;
  const prog = meme ? [[60, 64, 67], [65, 69, 72], [67, 71, 74], [60, 64, 67]] : [[57, 60, 64], [53, 57, 60], [48, 55, 60], [55, 59, 62]];
  const noise = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate); const dd = noise.getChannelData(0); for (let i = 0; i < dd.length; i++) dd[i] = Math.random() * 2 - 1;
  const tone = (f, t, dur, mime, vol, attack = 0.005) => {
    const o = ac.createOscillator(), g = ac.createGain(); o.type = mime; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  };
  for (let k = 0, t = 0; t < DURATION_VIDEO - 0.6; t += bar, k++) {
    const ch = prog[k % 4], lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = meme ? 1800 : 900; lp.connect(master);
    for (const m of ch) for (const det of [-6, 6]) {
      const o = ac.createOscillator(), g = ac.createGain(); o.type = meme ? "triangle" : "sawtooth"; o.frequency.value = hz(m); o.detune.value = det;
      const t0 = t_start + t, t1 = Math.min(t_start + t + bar + 0.2, t_start + DURATION_VIDEO);
      g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(meme ? 0.035 : 0.025, t0 + 0.4); g.gain.linearRampToValueAtTime(0.0001, t1);
      o.connect(g); g.connect(lp); o.start(t0); o.stop(t1 + 0.05);
    }
  }
  for (let t = 2.2; t < 11; t += beat) {
    const o = ac.createOscillator(), g = ac.createGain(), t0 = t_start + t;
    o.frequency.setValueAtTime(130, t0); o.frequency.exponentialRampToValueAtTime(45, t0 + 0.14);
    g.gain.setValueAtTime(0.55, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + 0.4);
    const s = ac.createBufferSource(), hp = ac.createBiquadFilter(), hg = ac.createGain(); s.buffer = noise; hp.type = "highpass"; hp.frequency.value = 7000;
    const th = t0 + beat / 2; hg.gain.setValueAtTime(0.09, th); hg.gain.exponentialRampToValueAtTime(0.0001, th + 0.05);
    s.connect(hp); hp.connect(hg); hg.connect(master); s.start(th); s.stop(th + 0.06);
  }
  let i = 0;
  for (let t = 4.5; t < 11; t += beat / 2, i++) {
    const ch = prog[Math.floor(t / bar) % 4]; const m = ch[[0, 2, 1, 2][i % 4]] + 12;
    tone(hz(m), t_start + t, 0.28, meme ? "square" : "triangle", meme ? 0.035 : 0.05);
  }
  for (const [t, m] of [[0.25, 79], [2.2, 84], [3.4, 88], [4.6, 83], [7.7, 86], [8.5, 88], [9.3, 91]]) tone(hz(m), t_start + t, 0.35, "sine", 0.12);
  const o = ac.createOscillator(), g = ac.createGain(), t0 = t_start + 11;
  o.frequency.setValueAtTime(90, t0); o.frequency.exponentialRampToValueAtTime(38, t0 + 0.6);
  g.gain.setValueAtTime(0.7, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.6); o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + 1.7);
  for (const m of prog[0].concat([prog[0][0] + 12])) tone(hz(m), t0, DURATION_VIDEO - 11, "sine", 0.06, 0.3);
}
function drawIntro(c, W, H, t, d) {
  const S = W / 1280, eo = (x) => 1 - Math.pow(1 - x, 3), p = (a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
  c.globalAlpha = 1; c.fillStyle = d.basic; c.fillRect(0, 0, W, H);
  const gl = c.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.45, W * 0.55);
  gl.addColorStop(0, d.bright ? "rgba(255,255,255,.35)" : "rgba(255,255,255,.12)"); gl.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = gl; c.fillRect(0, 0, W, H);
  c.strokeStyle = d.bright ? "rgba(0,0,0,.08)" : "rgba(255,255,255,.07)"; c.lineWidth = 2 * S;
  for (const r of [260, 340, 420]) { c.beginPath(); c.arc(W / 2, H * 0.45, r * S * (1 + 0.02 * Math.sin(t * 0.8 + r)), 0, Math.PI * 2); c.stroke(); }
  for (const b of d.star) { const y = ((b.y - b.v * t) % 1 + 1) % 1; c.globalAlpha = 0.25 + 0.5 * (0.5 + 0.5 * Math.sin(t * 1.3 + b.f)); c.fillStyle = d.color; c.beginPath(); c.arc(b.x * W, y * H, b.r * S, 0, Math.PI * 2); c.fill(); }
  c.globalAlpha = 1;
  const logo = (cx, cy, L, a, sk) => {
    if (a <= 0) return; c.save(); c.globalAlpha = a; c.translate(cx, cy); c.scale(sk, sk);
    const r = L * 0.22; c.shadowColor = "rgba(0,0,0,.45)"; c.shadowBlur = 40 * S; c.shadowOffsetY = 14 * S;
    c.beginPath(); c.moveTo(-L / 2 + r, -L / 2); c.arcTo(L / 2, -L / 2, L / 2, L / 2, r); c.arcTo(L / 2, L / 2, -L / 2, L / 2, r); c.arcTo(-L / 2, L / 2, -L / 2, -L / 2, r); c.arcTo(-L / 2, -L / 2, L / 2, -L / 2, r); c.closePath();
    c.fillStyle = "#000"; c.fill(); c.shadowColor = "transparent"; c.clip(); c.drawImage(d.im, -L / 2, -L / 2, L, L); c.restore();
  };
  const text = (s, x, y, font, color, a, dy = 0) => { if (a <= 0) return; c.save(); c.globalAlpha = a; c.font = font; c.fillStyle = color; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(s, x, y + dy); c.restore(); };
  const load = (font, s, cap, start, min) => { let u = start; c.font = font.replace("@", u * S); while (c.measureText(s).width > cap && u > min) { u -= 2; c.font = font.replace("@", u * S); } return font.replace("@", u * S); };
  if (t < 4.7) {
    const out = 1 - p(4.3, 4.7), a1 = p(0.2, 0.9);
    const sk = 0.6 + 0.4 * eo(a1) + 0.06 * Math.sin(Math.PI * p(0.7, 1.1));
    logo(W / 2, H * 0.38, 250 * S, eo(a1) * out, sk);
    const n = Math.round(d.name.length * p(2.2, 3.3)); const f = load("@px Michroma, Arial Black, sans-serif", d.name, W * 0.8, 60, 28);
    text(d.name.slice(0, n), W / 2, H * 0.72, f, d.color, out);
    text(d.ticker ? "$" + d.ticker : "", W / 2, H * 0.81, `600 ${26 * S}px 'Instrument Sans', Arial, sans-serif`, d.dim, eo(p(3.4, 3.8)) * out, (1 - eo(p(3.4, 3.8))) * 12 * S);
  } else if (t < 7.6) {
    const out = 1 - p(7.3, 7.6);
    c.font = `600 ${50 * S}px 'Instrument Sans', Arial, sans-serif`;
    const row = wrap(c, d.tagline, W * 0.78).slice(0, 3); const height = 66 * S, y0 = H / 2 - (row.length - 1) * height / 2;
    row.forEach((b, i) => { const a = eo(p(4.6 + i * 0.35, 5.2 + i * 0.35)); text(b, W / 2, y0 + i * height, `600 ${50 * S}px 'Instrument Sans', Arial, sans-serif`, d.color, a * out, (1 - a) * 16 * S); });
  } else if (t < 11.1) {
    const out = 1 - p(10.8, 11.1);
    text(d.title, W / 2, H * 0.17, `600 ${24 * S}px 'Instrument Sans', Arial, sans-serif`, d.dim, eo(p(7.6, 8.0)) * out);
    d.features.slice(0, 3).forEach((f, i) => {
      const a = eo(p(7.7 + i * 0.8, 8.2 + i * 0.8)) * out; if (a <= 0) return;
      const w = W * 0.72, h = H * 0.15, x = (W - w) / 2, y = H * (0.27 + i * 0.2) + (1 - a) * 20 * S;
      c.save(); c.globalAlpha = a; c.fillStyle = d.bright ? "rgba(255,255,255,.55)" : "rgba(255,255,255,.06)"; c.strokeStyle = d.bright ? "rgba(0,0,0,.14)" : "rgba(255,255,255,.16)"; c.lineWidth = 2 * S;
      const r = 22 * S; c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); c.fill(); c.stroke();
      c.font = `500 ${27 * S}px 'Instrument Sans', Arial, sans-serif`; const bs = wrap(c, f, w - 80 * S).slice(0, 2);
      c.fillStyle = d.color; c.textAlign = "left"; c.textBaseline = "middle"; bs.forEach((b, j) => c.fillText(b, x + 40 * S, y + h / 2 + (j - (bs.length - 1) / 2) * 34 * S)); c.restore();
    });
  } else {
    const a = eo(p(11.1, 11.7));
    logo(W / 2, H * 0.34, 190 * S, a, 0.85 + 0.15 * a);
    text(d.name, W / 2, H * 0.6, load("@px Michroma, Arial Black, sans-serif", d.name, W * 0.8, 52, 26), d.color, eo(p(11.4, 12.0)));
    text("Launching on pons · Robinhood Chain", W / 2, H * 0.7, `500 ${26 * S}px 'Instrument Sans', Arial, sans-serif`, d.dim, eo(p(11.8, 12.4)));
    if (!d.hq) text("Made with Orynx · orynxai.xyz", W / 2, H * 0.92, `600 ${18 * S}px 'Instrument Sans', Arial, sans-serif`, d.dim, eo(p(12.2, 12.8)));
  }
}
async function makeVideo() {
  if (!kitActive) return;
  const logo = logoOptions();
  if (!logo) { $("vidMsg").textContent = "Wait for your logos first."; return; }
  const cv0 = document.createElement("canvas");
  if (!window.MediaRecorder || !cv0.captureStream) { $("vidMsg").textContent = "Your browser can't record video. Try Chrome or Safari."; return; }
  const button = $("vidMake"); button.disabled = true; $("vidDl").hidden = true;
  if (videoUrl) { URL.revokeObjectURL(videoUrl); videoUrl = ""; }
  let ac = null;
  try {
    try { await Promise.all([document.fonts.load("60px Michroma"), document.fonts.load("600 32px 'Instrument Sans'")]); } catch (_) {}
    const im = await loadDraw(logo.src);
    const hq = gating && holder, W = hq ? 1920 : 1280, H = hq ? 1080 : 720;
    const s = document.createElement("canvas"); s.width = s.height = 8; const sc = s.getContext("2d"); sc.drawImage(im, 0, 0, 8, 8);
    const [r, g, b] = sc.getImageData(0, 0, 1, 1).data;
    const meme = kitActive.mode === "meme", bright = meme && (0.299 * r + 0.587 * g + 0.114 * b) > 150;
    const main = kitActive.kit.options[0] || { name: "", ticker: "" };
    const d = { im, hq, bright, basic: meme ? `rgb(${r},${g},${b})` : "#050507", color: bright ? "#111111" : "#ffffff", dim: bright ? "rgba(17,17,17,.7)" : "rgba(255,255,255,.62)",
      name: main.name, ticker: main.ticker, tagline: kitActive.kit.tagline, features: kitActive.kit.features || [], title: meme ? "The lore" : "What it does",
      star: Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.6 + 0.4, v: Math.random() * 0.012 + 0.004, f: Math.random() * 6.28 })) };
    const cv = cv0; cv.width = W; cv.height = H; const c = cv.getContext("2d");
    drawIntro(c, W, H, 0, d);
    $("vidBox").replaceChildren(cv);
    ac = new (window.AudioContext || window.webkitAudioContext)(); await ac.resume();
    const target = ac.createMediaStreamDestination();
    const stream = new MediaStream([...cv.captureStream(30).getVideoTracks(), ...target.stream.getAudioTracks()]);
    const kind = ['video/mp4;codecs="avc1.640028,mp4a.40.2"', 'video/mp4;codecs="avc1.4D401F,mp4a.40.2"', 'video/mp4;codecs="avc1.42E01E,mp4a.40.2"', "video/mp4;codecs=avc1,mp4a.40.2",
      "video/mp4;codecs=avc1,opus", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m)) || "";
    const rec = new MediaRecorder(stream, kind ? { mimeType: kind, videoBitsPerSecond: hq ? 8e6 : 5e6, audioBitsPerSecond: 128000 } : undefined);
    const chunks = []; rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const done = new Promise((ok) => { rec.onstop = ok; });
    const t_start = ac.currentTime + 0.1; musicIntro(ac, target, meme, t_start);
    rec.start(250);
    const t0 = performance.now() + 100;
    await new Promise((ok) => {
      const play = () => {
        const t = (performance.now() - t0) / 1000;
        drawIntro(c, W, H, Math.max(0, t), d);
        button.textContent = `Recording... ${Math.max(0, Math.ceil(DURATION_VIDEO - t))}s`;
        if (t < DURATION_VIDEO) requestAnimationFrame(play); else ok();
      };
      requestAnimationFrame(play);
    });
    $("vidMsg").textContent = "Keep this tab open while it records.";
    rec.stop(); await done;
    const mime = (rec.mimeType || kind || "video/webm").split(";")[0];
    const blob = new Blob(chunks, { type: mime });
    videoUrl = URL.createObjectURL(blob);
    const v = document.createElement("video"); v.src = videoUrl; v.controls = true; v.playsInline = true; v.id = "vidOut";
    $("vidBox").replaceChildren(v);
    const ext = mime.includes("mp4") ? "mp4" : "webm";
    $("vidDl").href = videoUrl; $("vidDl").download = `${(main.ticker || "orynx").toLowerCase()}_intro.${ext}`; $("vidDl").hidden = false;
    const readyX = ext === "mp4" && !/opus/i.test(rec.mimeType || kind);
    $("vidMsg").textContent = readyX ? "Ready to post on X." : "This browser can't make X-ready audio. For posting on X, make it on your phone (Safari or Chrome) or Chrome on Windows or Mac.";
    button.textContent = "Make another";
  } catch (err) {
    $("vidMsg").textContent = "Couldn't record the video. Try again in Chrome or Safari.";
    button.textContent = "Make intro video";
  } finally {
    button.disabled = false;
    if (ac) { try { await ac.close(); } catch (_) {} }
  }
}
$("vidMake").onclick = makeVideo;

function usedMark() { const s = document.createElement("span"); s.className = "use"; s.textContent = "In use"; return s; }
function logoOptions() {
  const entries = logoCurrent(); if (!entries.length) return null;
  const i = kitActive && kitActive.pick < entries.length ? kitActive.pick : 0; return entries[i];
}
function markOptions() {
  const card = Array.from(document.querySelectorAll("#logos .logo"));
  const i = kitActive && kitActive.pick < card.length ? kitActive.pick : 0;
  card.forEach((k, j) => k.classList.toggle("pick", j === i && card.length > 1));
  $("pickHint").hidden = card.length < 2;
}
function pickLogo(k) {
  if (!kitActive) return;
  const card = Array.from(document.querySelectorAll("#logos .logo")); const i = card.indexOf(k);
  if (i < 0 || !k.querySelector("a") || i === kitActive.pick) return;
  kitActive.pick = i; markOptions(); resetVideo(); makeBanner(); saveKit();
}
function showLinkKit() {
  const present = !!(kitActive && kitActive.link); $("shareRow").hidden = !present; if (!present) return;
  const main = kitActive.kit.options[0] || {};
  $("shareUrl").textContent = kitActive.link.replace(/^https?:\/\//, "");
  $("shareCopy").onclick = () => copy(kitActive.link, $("shareCopy"));
  $("shareX").href = "https://x.com/intent/post?text=" + encodeURIComponent(`${main.name || ""}${main.ticker ? " $" + main.ticker : ""}\n${kitActive.kit.tagline}\n\nmade with Orynx\n${kitActive.link}`);
}
async function checkTicker(options) {
  const note = $("tkNote"); note.hidden = true;
  const items = (options || []).map((p) => p.ticker).filter(Boolean);
  if (!items.length) return;
  let result = {};
  try { result = (await api("/api/ticker?t=" + encodeURIComponent(items.join(",")))).result || {}; } catch (_) {}
  let used = 0;
  document.querySelectorAll("#names .name").forEach((b, i) => {
    const p = options[i]; if (!p) return; const old = b.querySelector(".tk-tag"); if (old) old.remove();
    if (result[p.ticker]) { const t = document.createElement("span"); t.className = "tk-tag"; t.textContent = "Used on Orynx"; b.firstChild.append(t); used++; }
  });
  note.innerHTML = used ? `Tickers marked "Used on Orynx" already appear in our community gallery. Also search <a href="https://ponsfamily.com/launchpad" target="_blank" rel="noopener">pons</a> before you launch.`
    : `None of these tickers are in the Orynx gallery yet. Also search <a href="https://ponsfamily.com/launchpad" target="_blank" rel="noopener">pons</a> before you launch.`;
  note.hidden = false;
}
const CHECKLIST = [
  "Download your logo and X header",
  "Set up your X profile: name, bio and header",
  "Post your first post on X",
  "Open a Telegram group and pin the welcome message",
  'Create your token on <a href="https://www.ponsfamily.com/launchpad/create" target="_blank" rel="noopener">pons</a>',
  "Share your kit with the community",
];
function drawChecklist() {
  if (!kitActive) return;
  const check = kitActive.check || (kitActive.check = []);
  $("checkList").replaceChildren(...CHECKLIST.map((t, i) => {
    const li = document.createElement("li"); const l = document.createElement("label");
    const c = document.createElement("input"); c.type = "checkbox"; c.checked = !!check[i];
    c.onchange = () => tick(i, c.checked);
    const s = document.createElement("span"); s.innerHTML = t; l.append(c, s); li.append(l); return li;
  }));
  countChecklist();
}
function tick(i, value) {
  if (!kitActive) return; kitActive.check[i] = value;
  const c = $("checkList").querySelectorAll("input")[i]; if (c) c.checked = value;
  countChecklist(); saveKit();
}
function countChecklist() {
  const n = (kitActive && kitActive.check || []).filter(Boolean).length;
  $("checkCount").textContent = n === CHECKLIST.length ? "All done. Good luck on launch day!" : `${n} of ${CHECKLIST.length} done`;
  $("checkBar").style.width = (n / CHECKLIST.length * 100) + "%";
}
let dbPromise = null;
function openDb() {
  if (!window.indexedDB) return Promise.resolve(null);
  if (!dbPromise) dbPromise = new Promise((ok) => {
    try {
      const r = indexedDB.open("orynx", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("kits", { keyPath: "kid" });
      r.onsuccess = () => ok(r.result); r.onerror = () => ok(null);
    } catch (_) { ok(null); }
  });
  return dbPromise;
}
async function allHistory() {
  const db = await openDb(); if (!db) return [];
  return new Promise((ok) => {
    try { const q = db.transaction("kits").objectStore("kits").getAll(); q.onsuccess = () => ok((q.result || []).sort((a, b) => b.t - a.t)); q.onerror = () => ok([]); }
    catch (_) { ok([]); }
  });
}
let timerHistory = null;
function saveHistory(data) {
  clearTimeout(timerHistory);
  timerHistory = setTimeout(async () => {
    const db = await openDb(); if (!db || !data.kit) return;
    try {
      const tx = db.transaction("kits", "readwrite"); tx.objectStore("kits").put(data);
      tx.oncomplete = async () => {
        const entries = await allHistory();
        if (entries.length > 24) { const t2 = db.transaction("kits", "readwrite"); entries.slice(24).forEach((x) => t2.objectStore("kits").delete(x.kid)); }
        drawHistory();
      };
    } catch (_) {}
  }, 300);
}
async function deleteHistory(kid) {
  const db = await openDb(); if (!db) return;
  try { const tx = db.transaction("kits", "readwrite"); tx.objectStore("kits").delete(kid); tx.oncomplete = drawHistory; } catch (_) {}
}
async function drawHistory() {
  const entries = await allHistory();
  $("mykits").hidden = !entries.length;
  $("mkRow").replaceChildren(...entries.map((d) => {
    const b = document.createElement("div"); b.className = "mk" + (kitActive && kitActive.kid === d.kid ? " on" : ""); b.setAttribute("role", "button"); b.tabIndex = 0;
    const u = (d.kit.options || [])[0] || {}; const l = (d.logos || [])[d.pick || 0] || (d.logos || [])[0];
    const g = l ? Object.assign(document.createElement("img"), { src: l.src, alt: "" }) : Object.assign(document.createElement("span"), { className: "ph" });
    const t = document.createElement("div"); const nb = document.createElement("b"); nb.textContent = u.name || "Untitled";
    const sm = document.createElement("small"); const n = (d.check || []).filter(Boolean).length;
    sm.textContent = `${u.ticker ? "$" + u.ticker + " · " : ""}${n}/${CHECKLIST.length} done`;
    t.append(nb, document.createElement("br"), sm);
    const x = document.createElement("button"); x.className = "x"; x.type = "button"; x.textContent = "×"; x.setAttribute("aria-label", "Remove " + (u.name || "kit"));
    x.onclick = (e) => { e.stopPropagation(); if (confirm("Remove this kit from this device?")) deleteHistory(d.kid); };
    const openIt = () => { if (busy) return; openData(d); try { localStorage.setItem(SAVE, JSON.stringify({ ...d, t: Date.now() })); } catch (_) {} $("restored").hidden = true; $("result").scrollIntoView({ behavior: smooth(), block: "start" }); };
    b.onclick = openIt; b.onkeydown = (e) => { if (e.key === "Enter") openIt(); };
    b.append(g, t, x); return b;
  }));
}

function remixKit(it) {
  if (!it) return;
  pickMode(it.mode === "meme" ? "meme" : "ai");
  $("ide").value = `Remix of ${it.name}: ${it.tagline || ""}`.slice(0, 200);
  toBuild();
}
function drawThread() {
  const th = kitActive && kitActive.kit && kitActive.kit.thread;
  $("threadMsg").textContent = "";
  $("threadBtn").textContent = th && th.length ? "New thread" : "Write my launch thread";
  $("threadBtn").hidden = !(kitActive && kitActive.sig);
  if (!th || !th.length) {
    $("threadBox").replaceChildren(Object.assign(document.createElement("p"), { className: "th-empty", textContent: "A ready-to-post thread for the moment you go live on pons: the hook, the story, how to buy, your CA and the community call." }));
    return;
  }
  const n = th.length;
  const block = th.map((t, i) => blockCopy(`${t}\n\n${i + 1}/${n}`, i === 0));
  const cat = document.createElement("p"); cat.className = "th-note"; cat.textContent = "Replace [CA] with your contract address after you create the token on pons.";
  $("threadBox").replaceChildren(...block, cat);
}
async function makeThread() {
  if (!kitActive || !kitActive.sig) return;
  const btn = $("threadBtn"), k = kitActive.kit, main = k.options[0] || { name: "", ticker: "" };
  btn.disabled = true; btn.textContent = "Writing..."; $("threadMsg").textContent = "";
  try {
    const h = await api("/api/thread", { mode: kitActive.mode, sig: kitActive.sig, name: main.name, ticker: main.ticker, tagline: k.tagline,
      roast: k.roast, description: k.description, features: k.features });
    k.thread = h.thread; drawThread(); saveKit();
    $("threadMsg").textContent = `${h.left} rewrite${h.left === 1 ? "" : "s"} left today.`;
  } catch (err) { $("threadMsg").textContent = err.message; btn.textContent = k.thread ? "New thread" : "Write my launch thread"; }
  finally { btn.disabled = false; }
}
$("threadBtn").onclick = makeThread;

const KEY_REF = "orynx_ref_from", KEY_REF_MINE = "orynx_myref";
const tidyRef = (t) => String(t || "").toLowerCase().replace(/^@/, "").replace(/[^a-z0-9_]/g, "").slice(0, 20);
function recordRef() {
  let d = null; try { d = JSON.parse(localStorage.getItem(KEY_REF) || "null"); } catch (_) {}
  if (!d || d.use || Date.now() - d.t > 30 * 864e5) return;
  let mine = ""; try { mine = localStorage.getItem(KEY_REF_MINE) || ""; } catch (_) {}
  if (d.ref === mine) return;
  api("/api/ref/hit", { ref: d.ref }).then(() => { try { localStorage.setItem(KEY_REF, JSON.stringify({ ...d, use: true })); } catch (_) {} loadRef(); }).catch(() => {});
}
function linkRef(r) { return `${location.origin}/?ref=${r}`; }
async function loadRef() {
  let mine = ""; try { mine = localStorage.getItem(KEY_REF_MINE) || ""; } catch (_) {}
  try {
    const h = await api("/api/ref/top" + (mine ? "?mine=" + encodeURIComponent(mine) : ""));
    if (!h.active) { $("refBox").hidden = true; return; }
    const ol = $("refTop");
    if (h.top && h.top.length) ol.replaceChildren(...h.top.map((x) => { const li = document.createElement("li"); const b = document.createElement("b"); b.textContent = "@" + x.ref; const s = document.createElement("span"); s.textContent = `${x.count} builder${x.count === 1 ? "" : "s"}`; li.append(b, s); return li; }));
    if (mine) showRefMine(mine, h.mine);
  } catch (_) {}
}
function showRefMine(r, stat) {
  const url = linkRef(r);
  $("refMine").hidden = false; $("refLink").textContent = url.replace(/^https?:\/\//, ""); $("refInput").value = r;
  $("refCopy").onclick = () => copy(url, $("refCopy"));
  $("refX").href = "https://x.com/intent/post?text=" + encodeURIComponent(`build your token's launch kit in one sentence: name, logo, posts and more.\n\nmade for pons on Robinhood Chain\n${url}`);
  if (stat) $("refStat").textContent = `This week: ${stat.week} · All time: ${stat.total}`;
}
$("refForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const r = tidyRef($("refInput").value);
  if (r.length < 3) { $("refInput").focus(); return; }
  try { localStorage.setItem(KEY_REF_MINE, r); } catch (_) {}
  showRefMine(r); loadRef();
});

let burnShow = false;
async function loadBurn() {
  try {
    const h = await api("/api/burn");
    if (!h.active || !h.burned) return;
    $("burn").dataset.present = "1"; if (pageActive === "token") $("burn").hidden = false;
    $("burnNum").textContent = num(h.burned);
    $("burnPct").textContent = `${h.percent.toFixed(2)}% of the ${num(h.supply)} total supply, gone for good.`;
    $("burnBar").style.width = Math.max(0.4, Math.min(100, h.percent)) + "%";
    $("burnDead").href = `https://robin.etherscan.io/token/${h.token}?a=${h.dead}`;
    $("burnList").replaceChildren(...(h.records || []).map((b) => {
      const li = document.createElement("li"); const left = document.createElement("div");
      const j = document.createElement("b"); j.textContent = num(b.count) + " $ORYNX";
      const t = document.createElement("span"); t.textContent = b.time ? " · " + new Date(b.time * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
      left.append(j, t);
      const a = document.createElement("a"); a.href = `https://robin.etherscan.io/tx/${b.tx}`; a.target = "_blank"; a.rel = "noopener"; a.textContent = b.tx.slice(0, 8) + "…" + b.tx.slice(-4);
      li.append(left, a); return li;
    }));
    drawBurnChart(h);
    $("caBurn").innerHTML = `<b>${num(h.burned)} $ORYNX</b> burned so far (${h.percent.toFixed(2)}% of supply). <a href="#burn">See the burn tracker</a>`;
    $("caBurn").hidden = false; burnShow = true;
  } catch (_) {}
}
function drawBurnChart(h) {
  const rec = (h.records || []).filter((b) => b.time && b.count > 0).slice().sort((a, b) => a.time - b.time);
  if (rec.length < 2) return;
  const listed = rec.reduce((n, b) => n + b.count, 0);
  let run = Math.max(0, h.burned - listed);
  const pts = rec.map((b) => { run += b.count; return { t: b.time, v: run, b }; });
  const narrow = innerWidth < 600, W = narrow ? 340 : 600, H = narrow ? 200 : 220, L = narrow ? 46 : 54, R = 12, T = 14, B = 30;
  const t0 = pts[0].t, t1 = Math.max(pts[pts.length - 1].t, Date.now() / 1000), vmax = Math.max(h.burned, run) * 1.08;
  const x = (t) => L + (t - t0) / (t1 - t0 || 1) * (W - L - R), y = (v) => H - B - v / vmax * (H - T - B);
  const start = pts[0].v - pts[0].b.count;
  let d = `M${x(t0)},${y(start)}`;
  pts.forEach((p, i) => { d += ` L${x(p.t)},${y(i ? pts[i - 1].v : start)} L${x(p.t)},${y(p.v)}`; });
  d += ` L${x(t1)},${y(pts[pts.length - 1].v)}`;
  const area = `${d} L${x(t1)},${y(0)} L${x(t0)},${y(0)} Z`;
  const short = (v) => v >= 1e6 ? (v / 1e6).toFixed(v >= 1e7 ? 0 : 1) + "M" : num(v);
  const day = (t) => new Date(t * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const grid = [0, .5, 1].map((f) => { const v = vmax / 1.08 * f; return `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#1f1f1f"/><text class="ax" x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${short(v)}</text>`; }).join("");
  const dots = pts.map((p) => `<circle class="dot" cx="${x(p.t)}" cy="${y(p.v)}" r="5"><title>${num(p.b.count)} $ORYNX burned on ${day(p.t)}. Total ${num(p.v)}</title></circle>`).join("");
  $("burnSvg").innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Total $ORYNX burned over time, now ${num(h.burned)}">
    <defs><linearGradient id="bg1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff6a2b" stop-opacity=".35"/><stop offset="1" stop-color="#ff6a2b" stop-opacity="0"/></linearGradient></defs>
    ${grid}<path d="${area}" fill="url(#bg1)"/><path d="${d}" fill="none" stroke="#ff6a2b" stroke-width="2.5" stroke-linejoin="round"/>${dots}
    <text class="ax" x="${L}" y="${H - 8}">${day(t0)}</text><text class="ax" x="${W - R}" y="${H - 8}" text-anchor="end">Now</text></svg>`;
  $("burnChart").hidden = false;
}
function installBondCss() {
  const st = document.createElement("style"); st.textContent = ".ca-warn{margin:14px 0 0}.ca-burn{margin:18px 0 0;padding-top:16px;border-top:1px solid var(--rule-d);line-height:1.55}.ca-card > .ca-box > p{max-width:none}"; document.head.appendChild(st);
}
function installBond() {
  if ($("bond")) return;
  const st = document.createElement("style"); st.textContent = ".bond{margin:0 0 22px;padding:16px 18px 14px;border:1px solid #2c2c2c;border-radius:16px;background:#0b0b0b} .bond-top{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:12px} .bond-top span{font-size:13px;font-weight:600;color:#dcdcdc;display:inline-flex;align-items:center;gap:8px} .bond-top span::before{content:'';width:8px;height:8px;border-radius:50%;background:#fff;box-shadow:0 0 10px rgba(255,255,255,.8);animation:pulse 2s ease-in-out infinite} .bond-top b{font:400 26px var(--display);color:#fff;font-variant-numeric:tabular-nums} .bond-bar{position:relative;height:12px;border-radius:999px;background:#1a1a1a;overflow:hidden;box-shadow:inset 0 0 0 1px #262626} .bond-bar i{overflow:hidden;position:absolute;inset:0 auto 0 0;width:0;border-radius:inherit;background:linear-gradient(90deg,#8a8a8a,#fff);box-shadow:0 0 16px rgba(255,255,255,.45);transition:width 1.4s cubic-bezier(.2,.8,.2,1)} .bond-bar i::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.55),transparent);transform:translateX(-100%);animation:bondShine 2.4s ease-in-out infinite} @keyframes bondShine{to{transform:translateX(100%)}} .bond-note{margin:10px 0 0;font-size:13px;color:var(--graphite);line-height:1.5} .bond.done .bond-top span::before{background:#22c55e;box-shadow:0 0 10px #22c55e} @media (prefers-reduced-motion:reduce){.bond-bar i{transition:none}.bond-bar i::after,.bond-top span::before{animation:none}} .ca-card > .ca-box > p{max-width:none} .ca-warn{margin:14px 0 0} .ca-burn{margin:18px 0 0;padding-top:16px;border-top:1px solid var(--rule-d);line-height:1.55}"; document.head.appendChild(st);
  const box = document.querySelector("#ca .ca-box"); if (!box) return;
  box.insertAdjacentHTML("afterbegin", '<div class="bond" id="bond" hidden><div class="bond-top"><span id="bondLbl">Bonding progress</span><b id="bondPct">0%</b></div><div class="bond-bar" role="progressbar" aria-label="Bonding progress" aria-valuemin="0" aria-valuemax="100" id="bondBar"><i id="bondFill"></i></div><p class="bond-note" id="bondNote"></p></div>');
}
let bondNow = 0;
function numEth(x) { return x >= 1 ? x.toFixed(2) : x.toFixed(3); }
async function loadBonding() {
  try {
    const h = await api("/api/bonding");
    if (!h.present) return;
    installBond(); if (!$("bond")) return;
    const el = $("bond"); el.hidden = false; el.classList.toggle("done", !!h.graduated);
    const target = Math.max(0, Math.min(100, h.percent));
    $("bondLbl").textContent = h.graduated ? "Graduated" : "Bonding progress";
    $("bondNote").textContent = h.graduated
      ? "$ORYNX finished its bonding curve and now trades in a locked Uniswap v4 pool."
      : `${numEth(h.current)} of ${numEth(h.threshold)} ETH raised on the pons curve. At 100% it graduates to a locked Uniswap v4 pool.`;
    $("bondBar").setAttribute("aria-valuenow", target.toFixed(0));
    requestAnimationFrame(() => { $("bondFill").style.width = Math.max(1.5, target) + "%"; });
    const sender = bondNow, t_start = performance.now(), old = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1400;
    const steps = (n) => {
      const k = old ? Math.min(1, (n - t_start) / old) : 1, e = 1 - Math.pow(1 - k, 3);
      bondNow = sender + (target - sender) * e;
      $("bondPct").textContent = bondNow.toFixed(target >= 100 ? 0 : 1) + "%";
      if (k < 1) requestAnimationFrame(steps);
    };
    requestAnimationFrame(steps);
  } catch (_) {}
}
function readParam() {
  const q = new URLSearchParams(location.search);
  const r = tidyRef(q.get("ref"));
  if (r.length >= 3) { try { const old = JSON.parse(localStorage.getItem(KEY_REF) || "null"); if (!old || old.use || Date.now() - old.t > 30 * 864e5) localStorage.setItem(KEY_REF, JSON.stringify({ ref: r, t: Date.now() })); } catch (_) {} }
  const remix = q.get("remix");
  if (remix && /^[0-9a-f]{12}$/.test(remix)) api("/api/item/" + remix).then(remixKit).catch(() => {});
  if (q.has("ref") || q.has("remix")) { q.delete("ref"); q.delete("remix"); const s = q.toString(); history.replaceState(null, "", location.pathname + (s ? "?" + s : "") + location.hash); }
}

function setRedo() {
  document.querySelectorAll(".redo").forEach((b) => { b.hidden = !(kitActive && kitActive.sig); });
}
async function redoPart(btn) {
  if (!kitActive || !kitActive.sig || btn.disabled) return;
  const part = btn.dataset.part, start = btn.textContent, k = kitActive.kit, main = k.options[0] || { name: "", ticker: "" };
  document.querySelectorAll(".redo").forEach((b) => b.disabled = true); btn.textContent = "Rewriting...";
  $("redoMsg").hidden = true;
  try {
    const h = await api("/api/redo", { part, mode: kitActive.mode, sig: kitActive.sig, name: main.name, ticker: main.ticker,
      tagline: k.tagline, roast: k.roast, description: k.description, options: k.options, tweet: k.tweet });
    if (part === "name") { k.options = h.value; kitActive.ticker = ticker = (h.value[0] && h.value[0].ticker) || ticker; }
    else if (part === "tagline") k.tagline = h.value;
    else k.tweet = h.value;
    kitActive.sig = h.sig;
    showKit(k); saveKit();
    $("shareKit").hidden = !galleryActive; $("shareKit").disabled = false; $("shareKit").textContent = "Share to community";
    if (part !== "tweet") makeBanner();
    $("redoMsg").textContent = `Done. ${h.left} rewrite${h.left === 1 ? "" : "s"} left today.`; $("redoMsg").hidden = false;
  } catch (err) {
    $("redoMsg").textContent = err.message; $("redoMsg").hidden = false;
  } finally {
    btn.textContent = start; document.querySelectorAll(".redo").forEach((b) => b.disabled = false);
  }
}
document.querySelectorAll(".redo").forEach((b) => b.onclick = () => redoPart(b));

const records = [];
let chatBusy = false;
function addMessage(role, text) {
  const d = document.createElement("div");
  d.className = "msg " + (role === "user" ? "me" : "bot");
  if (role !== "user") { const s = document.createElement("small"); s.textContent = "Si Dev"; d.append(s); }
  const p = document.createElement("p"); p.textContent = text; d.append(p);
  $("log").append(d); $("log").scrollTop = $("log").scrollHeight;
  return d;
}
// Si Dev can run the red flag scanner from chat: paste a 0x address, or ask "check $TICKER".
let openFullScan = null;
const CHECK_WORDS = /\b(check|scan|cek|periksa|audit|safe|aman|legit|rug|scam|red ?flags?|risk|risky)\b/i;
function scanIntent(text) {
  const ca = text.match(/0x[0-9a-fA-F]{40}/);
  if (ca) return { ca: ca[0] };
  const tk = text.match(/\$([A-Za-z][A-Za-z0-9]{1,15})\b/);
  if (tk && CHECK_WORDS.test(text)) return { ticker: tk[1].toUpperCase() };
  return null;
}
const SC_LEVEL = { low: "Low risk", medium: "Medium risk", high: "High risk" };
const SC_ICON = { red: "!", amber: "~", green: "✓" };
function el(tag, cls, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
function scanCard(r) {
  const f = r.facts || {};
  const box = el("div", "chat-scan");
  const head = el("div", "cs-head");
  const id = el("div", "cs-id");
  id.append(el("b", "", (r.name || "Unknown token") + (r.symbol ? " $" + r.symbol : "")), el("small", "", r.token.slice(0, 6) + "…" + r.token.slice(-4)));
  const v = el("div", "cs-verdict " + r.verdict); v.append(el("b", "", String(r.score)), el("span", "", SC_LEVEL[r.verdict] || r.verdict));
  head.append(id, v); box.append(head);
  const ul = el("ul", "cs-flags");
  (r.flags || []).slice(0, 4).forEach((x) => { const li = el("li", x.level); li.append(el("i", "", SC_ICON[x.level] || ""), el("span", "", x.title)); ul.append(li); });
  if (ul.children.length) box.append(ul);
  const bits = [];
  if (f.holders) bits.push(num(f.holders.count) + " holders", "top 10 hold " + f.holders.top10.toFixed(1) + "%");
  if (f.bonding) bits.push(f.bonding.graduated ? "graduated on pons" : "pons curve " + f.bonding.percent + "%");
  if ("renounced" in f) bits.push(f.renounced ? "owner renounced" : "owner active");
  if (bits.length) box.append(el("p", "cs-facts", bits.join(" · ")));
  if (r.take) box.append(el("p", "cs-take", r.take));
  const more = el("button", "cs-more", "Open full report →"); more.type = "button";
  more.onclick = () => { if (openFullScan) openFullScan(r); };
  box.append(more);
  return box;
}
function scanSummary(r) {
  const f = r.facts || {};
  const lines = [`Scan of ${r.name || "token"} ${r.symbol ? "$" + r.symbol : ""} (${r.token}): ${SC_LEVEL[r.verdict] || r.verdict}, risk score ${r.score}/100.`];
  (r.flags || []).forEach((x) => lines.push(`- [${x.level}] ${x.title}: ${x.detail}`));
  if (f.holders) lines.push(`Holders ${f.holders.count}, top 10 hold ${f.holders.top10.toFixed(1)}%, largest ${f.holders.top1.toFixed(1)}%.`);
  if (f.bonding) lines.push(f.bonding.graduated ? "Graduated from the pons curve." : `pons bonding curve ${f.bonding.percent}% filled.`);
  if (r.take) lines.push(r.take);
  return lines.join("\n");
}
async function chatScan(text, intent, t) {
  let ca = intent.ca;
  if (!ca) {
    const found = await api("/api/scan/find?q=" + encodeURIComponent(intent.ticker));
    const m = found.matches || [];
    if (!m.length) {
      const msg = `I couldn't find $${intent.ticker} on Robinhood Chain. Paste its contract address (0x…) and I'll check it.`;
      t.classList.remove("typing"); t.querySelector("p").textContent = msg;
      records.push({ role: "assistant", content: msg }); return;
    }
    if (m.length > 1 && m[0].source !== "orynx") {
      const msg = `There are ${m.length} tokens using $${intent.ticker}. Copycats are common, so pick the right contract:`;
      t.classList.remove("typing"); t.querySelector("p").textContent = msg;
      const list = el("div", "cs-pick");
      m.forEach((x) => {
        const b = el("button", "", `${x.name || "$" + x.symbol} · ${x.token.slice(0, 6)}…${x.token.slice(-4)}${x.liquidity ? " · $" + num(Math.round(x.liquidity)) + " liq" : ""}`);
        b.type = "button"; b.onclick = () => { if (!chatBusy) sendChat("Check " + x.token); };
        list.append(b);
      });
      t.append(list); records.push({ role: "assistant", content: msg + " " + m.map((x) => x.token).join(", ") }); return;
    }
    ca = m[0].token;
  }
  const r = await api("/api/scan", { token: ca });
  t.classList.remove("typing");
  t.querySelector("p").textContent = r.verdict === "low" ? "Here's what the chain says. Nothing loud, but read the details." : r.verdict === "medium" ? "A few things worth knowing before you touch this one." : "I'd be careful here. Look at these:";
  t.append(scanCard(r));
  records.push({ role: "assistant", content: scanSummary(r) });
}
async function sendChat(text) {
  text = (text || "").trim();
  if (!text || chatBusy) return;
  if (/\b(video|vid)\b/i.test(text) && /\b(make|create|build|bikin|buat|buatkan|generate|need|want|mau)\b/i.test(text)) {
    addMessage("user", text); records.push({ role: "user", content: text });
    $("chatText").value = ""; $("chatText").style.height = ""; $("starters").hidden = true;
    const hasKit = !!(kitActive && logoOptions());
    const m = hasKit ? "On it. Pick the video type in Post videos, add your numbers and I'll animate it with your logo and music."
      : "I can make post videos for holder milestones, burns, updates and launches. Build your kit first so I have your name and logo, then you'll find Post videos under the result.";
    const t = addMessage("bot", m); records.push({ role: "assistant", content: m });
    const k = /burn/i.test(text) ? "burn" : /holder|milestone/i.test(text) ? "milestone" : /launch/i.test(text) ? "launch" : /update|feature/i.test(text) ? "update" : "";
    const go = document.createElement("button"); go.type = "button"; go.className = "cs-more"; go.textContent = hasKit ? "Open Post videos" : "Build my kit";
    go.onclick = () => { location.hash = "#build"; setTimeout(() => { if (hasKit) { if (k && window.orynxStudio) window.orynxStudio(k); $("studioGroup").scrollIntoView({ behavior: "smooth", block: "start" }); } else $("ide").focus(); }, 350); };
    t.append(go); return;
  }
  const intent = scanIntent(text);
  if (intent) {
    chatBusy = true; $("chatSend").disabled = true; $("starters").hidden = true;
    addMessage("user", text); records.push({ role: "user", content: text });
    $("chatText").value = ""; $("chatText").style.height = "";
    const t = addMessage("bot", ""); t.classList.add("typing");
    t.querySelector("p").replaceChildren(...[0, 1, 2].map(() => document.createElement("i")));
    try { await chatScan(text, intent, t); }
    catch (err) { t.remove(); records.pop(); addMessage("bot", err.message).classList.add("err"); }
    finally { chatBusy = false; $("chatSend").disabled = false; $("log").scrollTop = $("log").scrollHeight; }
    return;
  }
  chatBusy = true; $("chatSend").disabled = true; $("starters").hidden = true;
  addMessage("user", text); records.push({ role: "user", content: text });
  $("chatText").value = ""; $("chatText").style.height = "";
  const t = addMessage("bot", ""); t.classList.add("typing");
  t.querySelector("p").replaceChildren(...[0, 1, 2].map(() => document.createElement("i")));
  try {
    const h = await api("/api/consult", { message: records.slice(-12) });
    const clean = h.reply.replace(/\*\*(.+?)\*\*/g, "$1").replace(/^#{1,6}\s*/gm, "");
    t.classList.remove("typing"); t.querySelector("p").textContent = clean;
    records.push({ role: "assistant", content: h.reply });
    $("chatQuota").textContent = `Questions left today: ${h.left}`;
    $("chatToKit").hidden = false;
    $("log").scrollTop = $("log").scrollHeight;
  } catch (err) {
    t.remove(); records.pop();
    addMessage("bot", err.message).classList.add("err");
  } finally {
    chatBusy = false; $("chatSend").disabled = false;
  }
}
$("chatForm").addEventListener("submit", (e) => { e.preventDefault(); sendChat($("chatText").value); });
$("chatText").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendChat($("chatText").value); } });
$("chatText").addEventListener("input", () => { const a = $("chatText"); a.style.height = "auto"; a.style.height = Math.min(a.scrollHeight, 160) + "px"; });
document.querySelectorAll("#starters button").forEach((b) => b.onclick = () => sendChat(b.textContent));
$("chatToKit").onclick = () => {
  const first = records.find((m) => m.role === "user");
  if (first) $("ide").value = first.content.slice(0, 200);
  toBuild();
};

const PAGE = { examples: "examples", token: "token", burn: "token", faq: "faq", consult: "consult", scan: "scan" };
const smooth = () => matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
let pageActive = null;
function openPage() {
  const h = decodeURIComponent(location.hash.slice(1));
  const page = PAGE[h] || "home";
  const swap = page !== pageActive;
  document.querySelectorAll("main > section[data-page]").forEach((sec) => {
    sec.hidden = sec.dataset.page !== page;
    sec.classList.remove("page-in");
    if (swap && pageActive && !sec.hidden) { void sec.offsetWidth; sec.classList.add("page-in"); }
  });
  document.querySelectorAll(".tabbar a, .nav nav a").forEach((a) => {
    const t = a.getAttribute("href").slice(1);
    a.setAttribute("aria-current", String((PAGE[t] || "home") === page && (page !== "home" || t === "home")));
  });
  pageActive = page;
  $("burn").hidden = !(page === "token" && $("burn").dataset.present);
  if (h === "burn") { const go = () => $("burn").hidden ? setTimeout(go, 200) : $("burn").scrollIntoView({ behavior: "auto", block: "start" }); setTimeout(go, 50); return; }
  const el = page === "home" && h && h !== "home" ? $(h) : null;
  if (el) requestAnimationFrame(() => el.scrollIntoView({ behavior: swap ? "auto" : smooth(), block: h === "build" ? "center" : "start" }));
  else window.scrollTo(0, 0);
}
function toBuild() {
  if (location.hash === "#build") openPage(); else location.hash = "build";
  setTimeout(() => $("ide").focus({ preventScroll: true }), 450);
}
addEventListener("hashchange", openPage);
document.querySelectorAll('a[href="#build"]').forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); toBuild(); }));
readParam();
openPage();
restoreKit();
loadGallery();
drawHistory();
loadRef();
installBondCss(); loadBurn(); loadBonding(); setInterval(() => { if (!document.hidden) loadBonding(); }, 60000);

loadQuota();
// ---------- red flag scanner ----------
(() => {
  const form = $("scanForm"); if (!form) return;
  const ICON = { red: "!", amber: "~", green: "✓" };
  const LEVEL = { low: "Low risk", medium: "Medium risk", high: "High risk" };
  const short = (a) => a.slice(0, 6) + "…" + a.slice(-4);
  const big = (n) => n >= 1e9 ? (n / 1e9).toFixed(2) + "B" : n >= 1e6 ? (n / 1e6).toFixed(2) + "M" : num(n);
  function show(r) {
    const f = r.facts || {};
    $("scName").textContent = (r.name || "Unknown token") + (r.symbol ? " $" + r.symbol : "");
    $("scAddr").textContent = r.token;
    $("scScore").textContent = r.score;
    $("scLevel").textContent = LEVEL[r.verdict] || r.verdict;
    $("scVerdict").className = "sc-verdict " + r.verdict;
    $("scTake").textContent = r.take || ""; $("scTakeBox").hidden = !r.take;
    const ul = $("scFlags"); ul.replaceChildren();
    (r.flags || []).forEach((x) => {
      const li = document.createElement("li"); li.className = x.level;
      const i = document.createElement("i"); i.textContent = ICON[x.level] || "";
      const d = document.createElement("div"); const b = document.createElement("b"); b.textContent = x.title;
      const p = document.createElement("p"); p.textContent = x.detail; d.append(b, p); li.append(i, d); ul.append(li);
    });
    const facts = [];
    if (f.supply) facts.push(["Supply", big(f.supply)]);
    if (f.holders) { facts.push(["Holders", num(f.holders.count)]); facts.push(["Top 10 hold", f.holders.top10.toFixed(1) + "%"]); }
    if (f.bonding) facts.push(["pons curve", f.bonding.graduated ? "Graduated" : f.bonding.percent + "%"]);
    if (f.age_hours != null) facts.push(["Age", f.age_hours < 48 ? f.age_hours + " h" : Math.round(f.age_hours / 24) + " days"]);
    if ("renounced" in f) facts.push(["Owner", f.renounced ? "Renounced" : short(f.owner || "")]);
    $("scFacts").replaceChildren(...facts.map(([k, v]) => { const d = document.createElement("div"); const s = document.createElement("small"); s.textContent = k; const b = document.createElement("b"); b.textContent = v; d.append(s, b); return d; }));
    $("scMiss").textContent = (f.missing || []).length ? "Couldn't check: " + f.missing.join(", ") + "." : "";
    $("scExplorer").href = "https://robin.etherscan.io/token/" + r.token;
    $("scPons").href = "https://ponsfamily.com/launchpad/" + r.token; $("scPons").hidden = !f.pons;
    $("scanOut").hidden = false;
    requestAnimationFrame(() => $("scanOut").scrollIntoView({ behavior: smooth(), block: "start" }));
  }
  async function run(ca) {
    ca = (ca || "").trim();
    $("scanErr").textContent = "";
    if (!/^0x[0-9a-fA-F]{40}$/.test(ca)) { $("scanErr").textContent = "Paste a full contract address that starts with 0x (42 characters)."; return; }
    const b = $("scanGo"), t = b.textContent; b.disabled = true; b.textContent = "Reading the chain…";
    try { show(await api("/api/scan", { token: ca })); history.replaceState(null, "", "#scan"); }
    catch (err) { $("scanErr").textContent = err.message; }
    finally { b.disabled = false; b.textContent = t; }
  }
  openFullScan = (r) => { $("scanCa").value = r.token; location.hash = "#scan"; setTimeout(() => show(r), 60); };
  form.addEventListener("submit", (e) => { e.preventDefault(); run($("scanCa").value); });
  $("scanOrynx").onclick = () => { const ca = (($("caHome") && $("caHome").textContent.trim()) || "0x5f19286a65d33e7c76b2c8c07ccbd4310aefbf20"); $("scanCa").value = ca; run(ca); };
})();

// ---------- hero live demo: an idea is typed, Si Dev builds the kit card in front of you ----------
(() => {
  const deck = $("deck"); if (!deck) return;
  const svg = (x) => "data:image/svg+xml;utf8," + encodeURIComponent(x);
  const SAMPLE = [
    { name: "Kiln", ticker: "KILN", mode: "meme", idea: "A furnace that fires raw memes into finished ones", tagline: "Memes go in raw. They come out fired.", logo: "/demo/kiln.png" },
    { name: "Ledgerline", ticker: "LDGR", mode: "ai", idea: "An AI that reads every wallet move for you", tagline: "An AI analyst that reads every wallet move so you don't have to.", logo: svg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#0a0a0a"/><rect x="136" y="136" width="240" height="240" rx="56" fill="none" stroke="#fff" stroke-width="40"/><path d="M196 300l50-60 40 36 50-70" fill="none" stroke="#fff" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/></svg>') },
    { name: "Signalnest", ticker: "NEST", mode: "ai", idea: "A copilot for trading tokenized stocks 24/7", tagline: "Your trading copilot for tokenized stocks, awake 24/7.", logo: svg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#0a0a0a"/><circle cx="256" cy="256" r="46" fill="#fff"/><path d="M160 256a96 96 0 0 1 192 0M110 256a146 146 0 0 1 292 0" fill="none" stroke="#fff" stroke-width="34" stroke-linecap="round"/></svg>') },
  ];
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let cards = [], items = SAMPLE, run = 0;
  function card(it) {
    const a = document.createElement("div"); a.className = "kc";
    const tp = document.createElement("span"); tp.className = "kc-type"; tp.textContent = it.mode === "meme" ? "Meme coin" : "AI project";
    const busy = document.createElement("span"); busy.className = "kc-busy"; busy.textContent = "Si Dev is building...";
    const top = document.createElement("div"); top.className = "kc-top";
    const img = document.createElement("img"); img.alt = ""; img.src = it.logo; img.width = 72; img.height = 72;
    const nm = document.createElement("div"); const b = document.createElement("b"); b.dataset.full = it.name; b.textContent = it.name;
    const c = document.createElement("code"); c.textContent = "$" + it.ticker; nm.append(b, c); top.append(img, nm);
    const tag = document.createElement("p"); tag.className = "kc-tag"; tag.dataset.full = it.tagline; tag.textContent = it.tagline;
    const parts = document.createElement("div"); parts.className = "kc-parts";
    ["Name", "Logo", "Tagline", "Story", "X posts", "Mini site"].forEach((t, i) => { const s = document.createElement("span"); s.textContent = t; s.style.transitionDelay = (i * 0.07) + "s"; parts.append(s); });
    const src = document.createElement("span"); src.className = "kc-src"; src.textContent = "Example kit, made with Orynx";
    a.append(tp, busy, top, tag, parts, src);
    return a;
  }
  function place() { cards.forEach((c, i) => { c.dataset.pos = i < 3 ? String(i) : "2"; c.style.visibility = i < 3 ? "visible" : "hidden"; }); }
  const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
  async function type(el, text, ms, id) { for (let i = 1; i <= text.length; i++) { if (id !== run) return; el.textContent = text.slice(0, i); await wait(ms); } }
  async function cycle(id) {
    while (id === run) {
      const front = cards[0], it = items[0];
      $("diKind").textContent = it.mode === "meme" ? "Meme coin" : "AI project";
      $("demoIdea").classList.remove("go"); $("diText").textContent = "";
      front.classList.add("building");
      const nm = front.querySelector(".kc-top b"), tg = front.querySelector(".kc-tag");
      nm.textContent = ""; tg.textContent = "";
      if (document.hidden) { await wait(800); continue; }
      await type($("diText"), it.idea, 38, id); if (id !== run) return;
      await wait(250); $("demoIdea").classList.add("go"); await wait(700);
      front.classList.remove("building");
      await type(nm, nm.dataset.full, 55, id); await type(tg, tg.dataset.full, 22, id); if (id !== run) return;
      await wait(2600); if (id !== run) return;
      front.dataset.pos = "out"; await wait(650);
      cards.push(cards.shift()); items.push(items.shift()); place();
    }
  }
  function build() {
    run++; cards = items.map((it) => card(it));
    deck.replaceChildren(...cards.slice().reverse()); place();
    if (still) { cards.forEach((c) => c.classList.remove("building")); $("diText").textContent = items[0].idea; return; }
    cycle(run);
  }
  window.orynxDeck = () => {};
  build();
  // proof strip: live numbers for $ORYNX
  const proof = $("proof");
  if (!proof) return;
  Promise.allSettled([fetch("/api/holders").then((r) => r.json()), fetch("/api/burn").then((r) => r.json()), fetch("/api/bonding").then((r) => r.json())]).then(([h, b, c]) => {
    const cells = [];
    if (h.value && h.value.holders) cells.push([num(h.value.holders), "$ORYNX holders"]);
    if (b.value && b.value.active) cells.push([b.value.percent.toFixed(2) + "%", "of supply burned"]);
    if (c.value && c.value.present) cells.push([c.value.graduated ? "Graduated" : c.value.percent.toFixed(1) + "%", c.value.graduated ? "on Uniswap v4" : "pons curve filled"]);
    if (cells.length < 2) return;
    proof.replaceChildren(...cells.map(([v, l]) => { const d = document.createElement("div"); const bb = document.createElement("b"); bb.textContent = v; const s = document.createElement("span"); s.textContent = l; d.append(bb, s); return d; }));
    proof.hidden = false;
  });
})();

// footer idea field: hand the sentence to the main builder and start it
(() => {
  const f = $("ctaForm"); if (!f) return;
  f.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = $("ctaIde").value.trim();
    location.hash = "#build";
    setTimeout(() => {
      $("ide").value = v; $("ide").focus();
      if (v) $("form").requestSubmit();
    }, 350);
  });
})();

// usage numbers: only real counters, a cell shows once it has something to say
(() => {
  const row = $("usage"); if (!row) return;
  fetch("/api/stats").then((r) => r.json()).then((s) => {
    const cells = [];
    if (s.kits >= 10) cells.push([s.kits, "launch kits built"]);
    if (s.shared >= 3) cells.push([s.shared, "kits shared with the community"]);
    if (s.sites >= 3) cells.push([s.sites, "mini sites published"]);
    if (s.scans >= 10) cells.push([s.scans, "tokens scanned for red flags"]);
    if (cells.length < 2) { row.closest("section").hidden = true; return; }
    row.replaceChildren(...cells.map(([v, l]) => { const d = document.createElement("div"); const b = document.createElement("b"); b.textContent = num(v); const sp = document.createElement("span"); sp.textContent = l; d.append(b, sp); return d; }));
    row.style.setProperty("--n", Math.min(cells.length, 4));
    row.hidden = false;
  }).catch(() => { row.closest("section").hidden = true; });
})();

// Your own name: add it to the kit and make it the one in use
$("ownName").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!kitActive) return;
  const name = $("ownNm").value.trim(), tk = $("ownTk").value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 8);
  if (!name) { $("ownNm").focus(); return; }
  const k = kitActive.kit;
  const have = k.options.findIndex((o) => o.name.toLowerCase() === name.toLowerCase());
  if (have < 0) { k.options.push({ name, ticker: tk || name.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 5) }); }
  else if (tk) k.options[have].ticker = tk;
  const i = have < 0 ? k.options.length - 1 : have;
  if (i === 0) { drawNames(k); saveKit(); makeBanner(); }
  else { const el = document.querySelectorAll("#names .name")[i] || document.createElement("div"); await pickName(i, el); }
  $("ownNm").value = ""; $("ownTk").value = "";
});

// Your own logo: any square-ish image becomes a 1024 px PNG, signed by the server like a drawn logo
$("upLogo").onclick = () => { if (kitActive) $("upFile").click(); };
$("upFile").onchange = async () => {
  const f = $("upFile").files[0]; $("upFile").value = ""; if (!f || !kitActive) return;
  const msg = $("upMsg"); msg.hidden = false; msg.className = "up-msg"; msg.textContent = "Adding your logo...";
  try {
    if (f.size > 8e6) throw new Error("That image is too big. Use one under 8 MB.");
    const url = URL.createObjectURL(f);
    const img = await new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => no(new Error("That file could not be opened as an image.")); im.src = url; });
    const S = 1024, c = document.createElement("canvas"); c.width = S; c.height = S;
    const x = c.getContext("2d");
    const w = img.naturalWidth || S, h = img.naturalHeight || S, side = Math.min(w, h);
    if (Math.abs(w - h) / Math.max(w, h) > 0.08) { x.fillStyle = logoBg || "#0a0a0a"; x.fillRect(0, 0, S, S); const r = Math.min(S / w, S / h); x.drawImage(img, (S - w * r) / 2, (S - h * r) / 2, w * r, h * r); }
    else x.drawImage(img, (w - side) / 2, (h - side) / 2, side, side, 0, 0, S, S);
    URL.revokeObjectURL(url);
    const png = c.toDataURL("image/png");
    const h2 = await api("/api/logo/upload", { png });
    const box = $("logos"), kc = document.createElement("div"); kc.className = "logo own";
    const g = document.createElement("div"); g.className = "img";
    const im = document.createElement("img"); im.src = png; im.alt = "Your logo"; g.append(im, usedMark()); g.onclick = () => pickLogo(kc);
    const a = document.createElement("a"); a.href = png; a.download = `${(kitActive.ticker || "logo").toLowerCase()}_your_logo.png`; a.textContent = "Download PNG"; a.dataset.sig = h2.sig;
    kc.append(g, a); box.prepend(kc);
    kitActive.pick = 0; markOptions(); resetVideo(); makeBanner(); saveKit();
    if (kitActive.link) { kitActive.link = ""; $("shareRow").hidden = true; $("shareKit").disabled = false; $("shareKit").textContent = "Share to community"; }
    msg.textContent = "Your logo is in use. It is used for your header, intro video, mini site and community share.";
  } catch (err) { msg.className = "up-msg err"; msg.textContent = err.message; }
};

// ---------- Si Dev video studio: post videos for milestones, burns, updates and launches ----------
const STUDIO_LEN = 20;
const STUDIO = {
  milestone: { label: "Holder milestone", fields: [["num", "Holders", "100", "number"], ["s1", "Largest wallet (optional)", "", "text"], ["s2", "Top 10 hold (optional)", "", "text"], ["s3", "Burned (optional)", "", "text"], ["close", "Closing line", "Thank you, first hundred.", "text"]] },
  burn: { label: "Burn", fields: [["num", "Amount burned", "1000000", "number"], ["idx", "Burn number (optional)", "", "number"], ["total", "Total burned so far (optional)", "", "number"], ["pct", "Share of supply burned, % (optional)", "", "text"], ["close", "Closing line", "Supply only goes one way.", "text"]] },
  update: { label: "Feature update", fields: [["head", "What shipped", "Something new just shipped.", "text"], ["p1", "Point 1", "", "text"], ["p2", "Point 2", "", "text"], ["p3", "Point 3", "", "text"], ["close", "Closing line", "Try it today.", "text"]] },
  launch: { label: "Launch", fields: [["head", "Headline", "Live now on pons.", "text"], ["ca", "Contract address (optional)", "", "text"], ["close", "Closing line", "Early is a choice.", "text"]] },
};
let studioKind = "milestone", studioUrl = "";
function studioFields() {
  const box = $("stFields"); box.replaceChildren();
  const kit = kitActive && kitActive.kit;
  STUDIO[studioKind].fields.forEach(([k, label, def, type]) => {
    const l = document.createElement("label"); l.className = "st-f";
    const s = document.createElement("span"); s.textContent = label;
    const i = document.createElement("input"); i.dataset.k = k; i.type = type === "number" ? "text" : "text"; i.inputMode = type === "number" ? "decimal" : "text"; i.maxLength = k === "ca" ? 42 : 80;
    let v = def;
    if (kit && studioKind === "update" && /^p[123]$/.test(k)) v = (kit.features || [])[+k[1] - 1] || "";
    if (kit && studioKind === "launch" && k === "head" && kit.tagline) v = "Live now on pons.";
    i.value = v; l.append(s, i); box.append(l);
  });
}
function studioData() {
  const v = {}; document.querySelectorAll("#stFields input").forEach((i) => v[i.dataset.k] = i.value.trim());
  return v;
}
document.querySelectorAll(".st-kind").forEach((b) => b.onclick = () => {
  studioKind = b.dataset.kind; document.querySelectorAll(".st-kind").forEach((x) => x.classList.toggle("on", x === b)); studioFields();
});
function stNum(s) { const n = parseFloat(String(s).replace(/[^0-9.]/g, "")); return isFinite(n) ? n : 0; }
function stFmt(n) { return Math.round(n).toLocaleString("en-US"); }

function studioScenes(kind, v, d) {
  const name = d.name || "Your token", tk = d.ticker ? "$" + d.ticker : "";
  const who = tk || name;
  if (kind === "milestone") {
    const n = Math.max(1, Math.round(stNum(v.num)));
    const stats = [["Largest wallet", v.s1], ["Top 10 hold", v.s2], ["Burned", v.s3]].filter((x) => x[1]);
    return [
      { a: 0, b: 3.6, eb: `${who} · Milestone`, ti: `${stFmt(n)} holders.`, draw: (c, t, S) => stRing(c, t, S, n, "HOLDERS", d) },
      { a: 3.6, b: 8.4, eb: `${stFmt(n)} and counting`, ti: "Every dot is a wallet.", draw: (c, t, S) => stDots(c, t - 3.6, S, n, d) },
      stats.length ? { a: 8.4, b: 13.6, eb: "Read on-chain", ti: "How it is spread.", draw: (c, t, S) => stCards(c, t - 8.4, S, stats.map(([k, x]) => [x, k]), d) }
        : { a: 8.4, b: 13.6, eb: name, ti: "What we are building.", draw: (c, t, S) => stQuote(c, t - 8.4, S, d.tagline, d) },
      { a: 13.6, b: 16.6, eb: "Next stop", ti: "More of us.", draw: (c, t, S) => stLogo(c, t - 13.6, S, d, 1) },
    ];
  }
  if (kind === "burn") {
    const n = stNum(v.num), total = stNum(v.total), pct = stNum(v.pct), idx = v.idx ? "#" + Math.round(stNum(v.idx)) : "";
    const s = [{ a: 0, b: 3.6, eb: `${who} · Burn ${idx}`.trim(), ti: "Sent to the dead address.", draw: (c, t, S) => stCounter(c, t, S, n, tk ? `${tk} burned` : "tokens burned", d, true) }];
    if (total) s.push({ a: 3.6, b: 8.4, eb: "Since launch", ti: "The total keeps climbing.", draw: (c, t, S) => stCounter(c, t - 3.6, S, total, "burned in total", d, true) });
    else s.push({ a: 3.6, b: 8.4, eb: name, ti: "Less supply, same story.", draw: (c, t, S) => stQuote(c, t - 3.6, S, d.tagline, d) });
    if (pct) s.push({ a: 8.4, b: 13.6, eb: "Share of supply", ti: `${pct}% gone for good.`, draw: (c, t, S) => stPct(c, t - 8.4, S, pct, d) });
    else s.push({ a: 8.4, b: 13.6, eb: "On-chain", ti: "Anyone can check it.", draw: (c, t, S) => stLogo(c, t - 8.4, S, d, 0) });
    s.push({ a: 13.6, b: 16.6, eb: name, ti: d.tagline ? "Why we hold." : "Still burning.", draw: (c, t, S) => stQuote(c, t - 13.6, S, d.tagline || name, d) });
    return s;
  }
  if (kind === "update") {
    const pts = [v.p1, v.p2, v.p3].filter(Boolean);
    return [
      { a: 0, b: 3.6, eb: `${who} · Update`, ti: v.head || "Something new.", draw: (c, t, S) => stLogo(c, t, S, d, 1) },
      { a: 3.6, b: 8.4, eb: "What changed", ti: "Here is what you get.", draw: (c, t, S) => stList(c, t - 3.6, S, pts.length ? pts : [d.tagline], d) },
      { a: 8.4, b: 13.6, eb: name, ti: "Why it matters.", draw: (c, t, S) => stQuote(c, t - 8.4, S, d.tagline, d) },
      { a: 13.6, b: 16.6, eb: "Live now", ti: "Go try it.", draw: (c, t, S) => stLogo(c, t - 13.6, S, d, 0) },
    ];
  }
  const ca = /^0x[0-9a-fA-F]{40}$/.test(v.ca || "") ? v.ca : "";
  return [
    { a: 0, b: 3.6, eb: "Introducing", ti: `${name}${tk ? " " + tk : ""}`, draw: (c, t, S) => stLogo(c, t, S, d, 1) },
    { a: 3.6, b: 8.4, eb: name, ti: "In one line.", draw: (c, t, S) => stQuote(c, t - 3.6, S, d.tagline, d) },
    { a: 8.4, b: 13.6, eb: d.meme ? "The lore" : "What it does", ti: "Why it exists.", draw: (c, t, S) => stList(c, t - 8.4, S, (d.features || []).slice(0, 3), d) },
    { a: 13.6, b: 16.6, eb: "On Robinhood Chain", ti: v.head || "Live now on pons.", draw: (c, t, S) => stCa(c, t - 13.6, S, ca, d) },
  ];
}

const stCl = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const stEo = (x) => 1 - Math.pow(1 - stCl(x), 4);
const stEase = (x) => { x = stCl(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const stSeg = (t, a, b) => stCl((t - a) / (b - a));
function stAlpha(t, a, b) { return Math.min(stEo(stSeg(t, a, a + .7)), 1 - stEase(stSeg(t, b - .45, b))); }
function stText(c, s, x, y, font, color, align = "center", track = 0) {
  c.font = font; c.fillStyle = color; c.textAlign = align; c.textBaseline = "alphabetic";
  if ("letterSpacing" in c) { c.letterSpacing = track + "px"; c.fillText(s, x, y); c.letterSpacing = "0px"; }
  else c.fillText(s, x, y);
}
function stWrap(c, s, maxW) {
  const words = String(s || "").split(/\s+/), lines = []; let line = "";
  words.forEach((w) => { const tr = line ? line + " " + w : w; if (c.measureText(tr).width > maxW && line) { lines.push(line); line = w; } else line = tr; });
  if (line) lines.push(line); return lines;
}
function stRound(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function stCard(c, x, y, w, h, S) {
  const g = c.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, "rgba(28,28,32,.92)"); g.addColorStop(1, "rgba(10,10,12,.94)");
  stRound(c, x, y, w, h, 28 * S); c.fillStyle = g; c.fill(); c.strokeStyle = "rgba(255,255,255,.09)"; c.lineWidth = 1.5 * S; c.stroke();
}
function stRing(c, t, S, n, label, d) {
  const cx = 960 * S, cy = 640 * S, r = 230 * S, p = stEo(stSeg(t, .6, 2.6));
  c.lineWidth = 10 * S; c.strokeStyle = "rgba(255,255,255,.08)"; c.beginPath(); c.arc(cx, cy, r, 0, 6.283); c.stroke();
  c.strokeStyle = d.acc; c.lineCap = "round"; c.beginPath(); c.arc(cx, cy, r, -1.5708, -1.5708 + 6.283 * p); c.stroke(); c.lineCap = "butt";
  stText(c, stFmt(n * p), cx, cy + 40 * S, `400 ${n >= 10000 ? 110 : 150}px Michroma, system-ui, sans-serif`, "#fff");
  stText(c, label, cx, cy + 100 * S, `600 26px 'Instrument Sans', system-ui, sans-serif`.replace("26px", 26 * S + "px"), d.acc, "center", 10 * S);
}
function stDots(c, t, S, n, d) {
  const total = Math.min(n, 216), cols = 18, sz = 40 * S, gap = 14 * S, rows = Math.ceil(total / cols);
  const w = cols * sz + (cols - 1) * gap, x0 = 960 * S - w / 2, y0 = 640 * S - (rows * (sz + gap)) / 2;
  const lit = Math.round(stEo(stSeg(t, .5, 3.4)) * total);
  for (let i = 0; i < total; i++) {
    const x = x0 + (i % cols) * (sz + gap) + sz / 2, y = y0 + Math.floor(i / cols) * (sz + gap) + sz / 2;
    c.beginPath(); c.arc(x, y, sz / 2, 0, 6.283); c.fillStyle = i < lit ? d.acc : "#1a1a20"; c.globalAlpha = i < lit ? (i >= lit - 3 ? 1 : .85) : 1; c.fill(); c.globalAlpha = 1;
  }
  stText(c, `${stFmt(lit * (n / total))} wallets holding ${d.ticker ? "$" + d.ticker : d.name}`, 960 * S, y0 + rows * (sz + gap) + 50 * S, `500 ${30 * S}px 'Instrument Sans', system-ui, sans-serif`, "#bdbdbd");
}
function stCards(c, t, S, items, d) {
  const n = items.length, w = 460 * S, h = 260 * S, gap = 30 * S, x0 = 960 * S - (n * w + (n - 1) * gap) / 2, y = 520 * S;
  items.forEach(([v, k], i) => {
    const q = stEo(stSeg(t, .4 + i * .45, .9 + i * .45)); c.globalAlpha *= 1; const x = x0 + i * (w + gap), yy = y + (1 - q) * 30 * S;
    c.save(); c.globalAlpha = c.globalAlpha * q; stCard(c, x, yy, w, h, S);
    stText(c, k, x + 36 * S, yy + 64 * S, `600 ${22 * S}px 'Instrument Sans', system-ui, sans-serif`, "#8a8a8a", "left", 2 * S);
    stText(c, v, x + 36 * S, yy + 170 * S, `400 ${78 * S}px Michroma, system-ui, sans-serif`, "#fff", "left"); c.restore();
  });
}
function stQuote(c, t, S, s, d) {
  const q = stEo(stSeg(t, .3, 1.1)); c.save(); c.globalAlpha *= q;
  c.font = `500 ${56 * S}px 'Instrument Sans', system-ui, sans-serif`; const lines = stWrap(c, s || d.name, 1300 * S).slice(0, 4);
  const lh = 74 * S, y0 = 640 * S - (lines.length - 1) * lh / 2 + 20 * S;
  c.fillStyle = d.acc; c.fillRect(960 * S - 40 * S, y0 - 120 * S, 80 * S, 6 * S);
  lines.forEach((l, i) => stText(c, l, 960 * S, y0 + i * lh, `500 ${56 * S}px 'Instrument Sans', system-ui, sans-serif`, "#f2f2f2"));
  c.restore();
}
function stList(c, t, S, pts, d) {
  const n = pts.length || 1, w = 1300 * S, h = 120 * S, gap = 22 * S, y0 = 640 * S - (n * h + (n - 1) * gap) / 2, x = 960 * S - w / 2;
  pts.forEach((p, i) => {
    const q = stEo(stSeg(t, .3 + i * .5, .8 + i * .5)); const y = y0 + i * (h + gap) + (1 - q) * 26 * S;
    c.save(); c.globalAlpha *= q; stCard(c, x, y, w, h, S);
    c.beginPath(); c.arc(x + 56 * S, y + h / 2, 18 * S, 0, 6.283); c.fillStyle = d.acc; c.fill();
    c.font = `500 ${34 * S}px 'Instrument Sans', system-ui, sans-serif`; const line = stWrap(c, p, w - 160 * S)[0] || "";
    stText(c, line, x + 100 * S, y + h / 2 + 12 * S, `500 ${34 * S}px 'Instrument Sans', system-ui, sans-serif`, "#f0f0f0", "left"); c.restore();
  });
}
function stCounter(c, t, S, n, label, d, glow) {
  const p = stEo(stSeg(t, .6, 2.6)); c.save();
  if (glow) { c.shadowColor = d.acc; c.shadowBlur = 60 * S; }
  c.font = `400 ${150 * S}px Michroma, system-ui, sans-serif`; let fs = 150 * S; const s = stFmt(n * p);
  while (c.measureText(stFmt(n)).width > 1600 * S && fs > 60 * S) { fs -= 6 * S; c.font = `400 ${fs}px Michroma, system-ui, sans-serif`; }
  stText(c, s, 960 * S, 660 * S, `400 ${fs}px Michroma, system-ui, sans-serif`, "#fff"); c.restore();
  stText(c, label, 960 * S, 760 * S, `600 ${38 * S}px 'Instrument Sans', system-ui, sans-serif`, d.acc);
}
function stPct(c, t, S, pct, d) {
  const cx = 960 * S, cy = 640 * S, r = 200 * S, p = stEo(stSeg(t, .5, 2)), frac = Math.min(1, pct / Math.max(2, Math.ceil(pct)));
  c.lineWidth = 32 * S; c.strokeStyle = "rgba(255,255,255,.07)"; c.beginPath(); c.arc(cx, cy, r, 0, 6.283); c.stroke();
  c.strokeStyle = d.acc; c.lineCap = "round"; c.beginPath(); c.arc(cx, cy, r, -1.5708, -1.5708 + 6.283 * frac * p); c.stroke(); c.lineCap = "butt";
  stText(c, (pct * p).toFixed(2) + "%", cx, cy + 30 * S, `400 ${80 * S}px Michroma, system-ui, sans-serif`, "#fff");
  stText(c, `of ${Math.max(2, Math.ceil(pct))}% scale`, cx, cy + 290 * S, `500 ${24 * S}px 'Instrument Sans', system-ui, sans-serif`, "#8a8a8a");
}
function stLogo(c, t, S, d, big) {
  const q = stEo(stSeg(t, .2, 1.2)), sz = (big ? 300 : 240) * S * (.9 + .1 * q), cx = 960 * S, cy = 610 * S;
  c.save(); c.globalAlpha *= q; c.shadowColor = d.acc; c.shadowBlur = 80 * S * q;
  stRound(c, cx - sz / 2, cy - sz / 2, sz, sz, sz * .22); c.clip(); c.drawImage(d.im, cx - sz / 2, cy - sz / 2, sz, sz); c.restore();
  c.save(); c.globalAlpha *= q;
  stText(c, d.name + (d.ticker ? "  $" + d.ticker : ""), cx, cy + sz / 2 + 80 * S, `600 ${44 * S}px 'Instrument Sans', system-ui, sans-serif`, "#fff"); c.restore();
}
function stCa(c, t, S, ca, d) {
  stLogo(c, t, S, d, 0);
  if (!ca) return;
  const q = stEo(stSeg(t, .8, 1.5)); c.save(); c.globalAlpha *= q;
  const w = 1180 * S, h = 90 * S, x = 960 * S - w / 2, y = 860 * S; stCard(c, x, y, w, h, S);
  stText(c, ca, 960 * S, y + 58 * S, `500 ${30 * S}px ui-monospace, Menlo, monospace`, "#e8e8e8"); c.restore();
}
function studioFrame(c, W, H, t, d, scenes, close) {
  const S = W / 1920;
  c.globalAlpha = 1; c.fillStyle = "#050505"; c.fillRect(0, 0, W, H);
  const blobs = [[300 + Math.sin(t * .35) * 180, 80 + Math.cos(t * .3) * 80, d.acc], [1500 + Math.cos(t * .28) * 200, 900 + Math.sin(t * .33) * 90, d.acc2], [960 + Math.sin(t * .22 + 1) * 260, 1050 + Math.cos(t * .25) * 60, d.acc]];
  const k = Math.min(1, t / 2);
  blobs.forEach(([x, y, col], i) => {
    const g = c.createRadialGradient(x * S, y * S, 0, x * S, y * S, 620 * S); g.addColorStop(0, col); g.addColorStop(1, "rgba(0,0,0,0)");
    c.globalAlpha = (.22 + .08 * Math.sin(t * .5 + i)) * k; c.fillStyle = g; c.fillRect(0, 0, W, H);
  });
  c.globalAlpha = 1;
  const v = c.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, H * .95); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,.6)"); c.fillStyle = v; c.fillRect(0, 0, W, H);
  const cur = scenes.find((s) => t >= s.a && t < s.b);
  scenes.forEach((s) => {
    const al = stAlpha(t, s.a + .2, s.b); if (al <= 0.002) return;
    c.save(); c.globalAlpha = al; c.translate(0, (1 - al) * 24 * S); s.draw(c, t, S); c.restore();
  });
  if (cur) {
    const a1 = stAlpha(t, cur.a + .05, cur.b), a2 = stAlpha(t, cur.a + .15, cur.b);
    c.save(); c.globalAlpha = a1; stText(c, cur.eb.toUpperCase(), 960 * S, 250 * S, `600 ${22 * S}px 'Instrument Sans', system-ui, sans-serif`, "#9a9a9a", "center", 8 * S); c.restore();
    c.save(); c.globalAlpha = a2; c.font = `600 ${64 * S}px 'Instrument Sans', system-ui, sans-serif`; let fs = 64 * S;
    while (c.measureText(cur.ti).width > 1700 * S && fs > 34 * S) { fs -= 4 * S; c.font = `600 ${fs}px 'Instrument Sans', system-ui, sans-serif`; }
    stText(c, cur.ti, 960 * S, 335 * S, `600 ${fs}px 'Instrument Sans', system-ui, sans-serif`, "#ffffff"); c.restore();
  }
  const e = stEo(stSeg(t, 16.75, 17.5));
  if (e > 0) {
    c.save(); c.globalAlpha = e; const sz = 150 * S; stRound(c, 960 * S - sz / 2, 330 * S, sz, sz, sz * .22); c.clip(); c.drawImage(d.im, 960 * S - sz / 2, 330 * S, sz, sz); c.restore();
    c.save(); c.globalAlpha = stEo(stSeg(t, 16.95, 17.7)); c.font = `600 ${76 * S}px 'Instrument Sans', system-ui, sans-serif`; let fs = 76 * S;
    while (c.measureText(close).width > 1700 * S && fs > 40 * S) { fs -= 4 * S; c.font = `600 ${fs}px 'Instrument Sans', system-ui, sans-serif`; }
    stText(c, close, 960 * S, 600 * S, `600 ${fs}px 'Instrument Sans', system-ui, sans-serif`, "#fff"); c.restore();
    c.save(); c.globalAlpha = stEo(stSeg(t, 17.25, 18)); stText(c, `${d.ticker ? "$" + d.ticker + " · " : ""}on pons, Robinhood Chain`, 960 * S, 680 * S, `500 ${32 * S}px 'Instrument Sans', system-ui, sans-serif`, "#a8a8a8"); c.restore();
  }
  c.save(); c.globalAlpha = .55; stText(c, "made with Orynx", W - 40 * S, H - 36 * S, `500 ${20 * S}px 'Instrument Sans', system-ui, sans-serif`, "#8a8a8a", "right"); c.restore();
  if (d.grain) { c.globalAlpha = .06; c.drawImage(d.grain, (t * 97 % 64) - 64, (t * 53 % 64) - 64, W + 128, H + 128); c.globalAlpha = 1; }
}
function musicLofi(ac, out, t0, dur) {
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const master = ac.createGain(); master.gain.setValueAtTime(0.0001, t0); master.gain.linearRampToValueAtTime(0.8, t0 + 1.2);
  master.gain.setValueAtTime(0.8, t0 + dur - 2.5); master.gain.linearRampToValueAtTime(0.0001, t0 + dur - .1);
  const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 7000;
  master.connect(lp); lp.connect(out);
  const beat = 60 / 80, bar = beat * 4;
  const prog = [[53, 57, 60, 64, 67], [52, 55, 59, 62], [50, 53, 57, 60, 64], [48, 52, 55, 59, 62]], bass = [41, 40, 38, 36];
  const ep = (f, t, len, vol) => {
    const o = ac.createOscillator(), m = ac.createOscillator(), mg = ac.createGain(), g = ac.createGain();
    o.type = "sine"; o.frequency.value = f; m.type = "sine"; m.frequency.value = f; mg.gain.setValueAtTime(f * 1.2, t); mg.gain.exponentialRampToValueAtTime(f * .05, t + 1.2);
    m.connect(mg); mg.connect(o.frequency); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); g.connect(master); o.start(t); m.start(t); o.stop(t + len + .05); m.stop(t + len + .05);
  };
  const noiseBuf = ac.createBuffer(1, ac.sampleRate * .4, ac.sampleRate); const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const hit = (t, freq, len, vol, type) => {
    const s = ac.createBufferSource(); s.buffer = noiseBuf; const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; const g = ac.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len); s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + len + .02);
  };
  const kick = (t) => { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(48, t + .12);
    g.gain.setValueAtTime(.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + .35); o.connect(g); g.connect(master); o.start(t); o.stop(t + .4); };
  for (let b = 0; b * bar < dur; b++) {
    const s = t0 + b * bar, ch = prog[b % 4];
    [0, beat * 2.5].forEach((h, k) => ch.forEach((m, j) => ep(hz(m), s + h + j * .018, k ? 1.4 : 1.9, .045)));
    [0, beat * 2].forEach((h) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = "sine"; o.frequency.value = hz(bass[b % 4]);
      g.gain.setValueAtTime(0.0001, s + h); g.gain.linearRampToValueAtTime(.22, s + h + .02); g.gain.exponentialRampToValueAtTime(0.0001, s + h + beat * 1.7);
      o.connect(g); g.connect(master); o.start(s + h); o.stop(s + h + beat * 1.8); });
    if (b === 0) continue;
    [0, beat * 1.75, beat * 2.5].forEach((h) => kick(s + h));
    [beat, beat * 3].forEach((h) => hit(s + h + .02, 1800, .22, .18, "bandpass"));
    for (let i = 0; i < 8; i++) hit(s + i * beat / 2 + (i % 2 ? .04 : 0), 8000, .05, i % 2 ? .05 : .08, "highpass");
  }
}
async function studioMake() {
  const msg = $("stMsg"), button = $("stMake");
  if (!kitActive) { msg.textContent = "Build a kit first, then make its post videos here."; return; }
  const logo = logoOptions(); if (!logo) { msg.textContent = "Wait for your logo first."; return; }
  const cv = document.createElement("canvas");
  if (!window.MediaRecorder || !cv.captureStream) { msg.textContent = "Your browser can't record video. Try Chrome or Safari."; return; }
  button.disabled = true; $("stDl").hidden = true; if (studioUrl) { URL.revokeObjectURL(studioUrl); studioUrl = ""; }
  let ac = null;
  try {
    try { await Promise.all([document.fonts.load("60px Michroma"), document.fonts.load("600 32px 'Instrument Sans'"), document.fonts.load("500 32px 'Instrument Sans'")]); } catch (_) {}
    const im = await loadDraw(logo.src);
    const sm = document.createElement("canvas"); sm.width = sm.height = 16; const sc = sm.getContext("2d"); sc.drawImage(im, 0, 0, 16, 16);
    const px = sc.getImageData(0, 0, 16, 16).data; let best = [120, 120, 255], bs = -1;
    for (let i = 0; i < px.length; i += 4) { const r = px[i], g = px[i + 1], b = px[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx - mn; if (sat > bs && mx > 60) { bs = sat; best = [r, g, b]; } }
    const acc = bs > 40 ? `rgb(${best[0]},${best[1]},${best[2]})` : "#8b9cff";
    const grain = document.createElement("canvas"); grain.width = grain.height = 256; const gc = grain.getContext("2d"); const gd = gc.createImageData(256, 256);
    for (let i = 0; i < gd.data.length; i += 4) { const v = Math.random() * 255; gd.data[i] = gd.data[i + 1] = gd.data[i + 2] = v; gd.data[i + 3] = 255; } gc.putImageData(gd, 0, 0);
    const main = kitActive.kit.options[0] || { name: "", ticker: "" };
    const d = { im, acc, acc2: "#1e3a8a", name: main.name, ticker: main.ticker, tagline: kitActive.kit.tagline, features: kitActive.kit.features || [], meme: kitActive.mode === "meme", grain: null };
    const gp = document.createElement("canvas"); const hq = gating && holder; const W = hq ? 1920 : 1280, H = hq ? 1080 : 720;
    gp.width = W + 128; gp.height = H + 128; const gpc = gp.getContext("2d"); gpc.fillStyle = gpc.createPattern(grain, "repeat"); gpc.fillRect(0, 0, gp.width, gp.height); d.grain = gp;
    const v = studioData(); const scenes = studioScenes(studioKind, v, d); const close = v.close || "Made on Orynx.";
    cv.width = W; cv.height = H; const c = cv.getContext("2d");
    studioFrame(c, W, H, 0, d, scenes, close); $("stBox").replaceChildren(cv);
    ac = new (window.AudioContext || window.webkitAudioContext)(); await ac.resume();
    const target = ac.createMediaStreamDestination();
    const stream = new MediaStream([...cv.captureStream(30).getVideoTracks(), ...target.stream.getAudioTracks()]);
    const kind = ['video/mp4;codecs="avc1.640028,mp4a.40.2"', 'video/mp4;codecs="avc1.4D401F,mp4a.40.2"', 'video/mp4;codecs="avc1.42E01E,mp4a.40.2"', "video/mp4;codecs=avc1,mp4a.40.2",
      "video/mp4;codecs=avc1,opus", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m)) || "";
    const rec = new MediaRecorder(stream, kind ? { mimeType: kind, videoBitsPerSecond: hq ? 8e6 : 5e6, audioBitsPerSecond: 128000 } : undefined);
    const chunks = []; rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const done = new Promise((ok) => { rec.onstop = ok; });
    musicLofi(ac, target, ac.currentTime + .1, STUDIO_LEN);
    rec.start(250); msg.textContent = "Keep this tab open while it records.";
    const t0 = performance.now() + 100;
    await new Promise((ok) => {
      const play = () => { const t = (performance.now() - t0) / 1000; studioFrame(c, W, H, Math.max(0, t), d, scenes, close);
        button.textContent = `Recording... ${Math.max(0, Math.ceil(STUDIO_LEN - t))}s`; if (t < STUDIO_LEN) requestAnimationFrame(play); else ok(); };
      requestAnimationFrame(play);
    });
    rec.stop(); await done;
    const mime = (rec.mimeType || kind || "video/webm").split(";")[0];
    studioUrl = URL.createObjectURL(new Blob(chunks, { type: mime }));
    const vid = document.createElement("video"); vid.src = studioUrl; vid.controls = true; vid.playsInline = true; $("stBox").replaceChildren(vid);
    const ext = mime.includes("mp4") ? "mp4" : "webm";
    $("stDl").href = studioUrl; $("stDl").download = `${(main.ticker || "orynx").toLowerCase()}_${studioKind}.${ext}`; $("stDl").hidden = false;
    msg.textContent = ext === "mp4" && !/opus/i.test(rec.mimeType || kind) ? "Ready to post on X." : "This browser can't make X-ready audio. For X, make it on your phone (Safari or Chrome) or Chrome on a computer.";
    button.textContent = "Make another";
  } catch (err) { msg.textContent = "Couldn't record the video. Try again in Chrome or Safari."; button.textContent = "Make video"; }
  finally { button.disabled = false; if (ac) { try { await ac.close(); } catch (_) {} } }
}
$("stMake").onclick = studioMake;
studioFields();
window.orynxStudio = (kind) => { const b = document.querySelector(`.st-kind[data-kind="${kind}"]`); if (b) b.click(); };

// ---------- 3D coin: follows the pointer, rests in a slow sway ----------
(() => {
  const coins = Array.from(document.querySelectorAll(".coin3d")); if (!coins.length) return;
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  coins.forEach((c) => c.classList.add("idle"));
  if (still) { coins.forEach((c) => c.classList.remove("idle")); return; }
  let timer = 0;
  window.addEventListener("pointermove", (e) => {
    coins.forEach((c) => {
      const r = c.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
      const x = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / 500)), y = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / 500));
      c.classList.remove("idle"); c.style.setProperty("--ry", (x * 38) + "deg"); c.style.setProperty("--rx", (-y * 30) + "deg");
      c.style.setProperty("--gx", (35 + x * 25) + "%"); c.style.setProperty("--gy", (30 + y * 25) + "%"); c.style.setProperty("--sh", (60 - x * 40) + "%"); const k = c.offsetWidth / 120; c.style.setProperty("--ex", (-x * 6 * k) + "px"); c.style.setProperty("--ey", (4 - y * 4) * k + "px");
    });
    clearTimeout(timer); timer = setTimeout(() => coins.forEach((c) => { c.style.removeProperty("--rx"); c.style.removeProperty("--ry"); c.classList.add("idle"); }), 2500);
  }, { passive: true });
})();

// ---------- before / after slider ----------
(() => {
  const box = $("baBox"), rg = $("baRange"); if (!box || !rg) return;
  const set = (v) => box.style.setProperty("--p", v + "%");
  rg.addEventListener("input", () => set(rg.value));
  set(rg.value);
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
  let shown = false;
  new IntersectionObserver((es, ob) => {
    if (shown || !es[0].isIntersecting) return; shown = true; ob.disconnect();
    const keys = [[0, 50], [700, 78], [1500, 28], [2300, 50]], t0 = performance.now();
    const step = (now) => {
      const t = now - t0; let i = 0; while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
      const [ta, va] = keys[i], [tb, vb] = keys[i + 1], k = Math.min(1, (t - ta) / (tb - ta)), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const v = va + (vb - va) * e; set(v); rg.value = v;
      if (t < keys[keys.length - 1][0]) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, { threshold: 0.5 }).observe(box);
})();

// ---------- How it works: the kit card fills in as you scroll (desktop) ----------
(() => {
  const card = $("storyCard"), steps = Array.from(document.querySelectorAll("#storySteps > li"));
  if (!card || !steps.length || !("IntersectionObserver" in window)) return;
  steps[0].classList.add("on");
  const ob = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    const i = steps.indexOf(e.target); steps.forEach((s, j) => s.classList.toggle("on", j === i)); card.dataset.step = String(i + 1);
  }), { rootMargin: "-45% 0px -45% 0px" });
  steps.forEach((s) => ob.observe(s));
})();

}
