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

function showKit(kit) {
  $("roast").textContent = kit.roast || "Fine. Idea accepted. Don't get cocky.";
  fill("names", ...kit.options.map((p) => {
    const b = document.createElement("button");
    b.className = "name"; b.type = "button";
    const name = document.createElement("span"); name.textContent = p.name;
    const code = document.createElement("code"); code.textContent = "$" + p.ticker;
    b.append(name, code);
    b.onclick = () => { copy(`${p.name} ($${p.ticker})`); code.textContent = "Copied"; setTimeout(() => code.textContent = "$" + p.ticker, 1200); };
    return b;
  }));
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
      const h = await api("/api/logo", { brief, style, variant: i + 1, mode: modeKit });
      const src = "data:image/png;base64," + h.png;
      const img = document.createElement("img"); img.src = src; img.alt = `Logo option ${i + 1}`;
      g.replaceChildren(img, usedMark()); g.onclick = () => pickLogo(k);
      const a = document.createElement("a");
      a.href = src; a.download = `${ticker}_${style}_${i + 1}${h.hq ? "_hq" : ""}.png`; a.textContent = h.hq ? "Download HQ PNG" : "Download PNG";
      if (h.sig) a.dataset.sig = h.sig;
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
    resetVideo(); $("videoGroup").hidden = true;
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
  $("ownToggle").textContent = openIt ? "Let Si Dev pick the name" : "Have a name in mind?";
  if (openIt) $("nameOwn").focus(); else { $("nameOwn").value = ""; $("tickerOwn").value = ""; }
};
pickMode("ai");
document.querySelectorAll(".style").forEach((b) => b.onclick = () => { if (brief) makeLogo(b.dataset.style); });

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
  return Array.from(document.querySelectorAll("#logos .logo a")).map((a) => ({ src: a.href, name: a.download, hq: a.textContent.includes("HQ"), sig: a.dataset.sig || "" }));
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
  kitActive = null; brief = ""; $("shareKit").hidden = true; $("shareRow").hidden = true; $("tkNote").hidden = true; $("pickHint").hidden = true; drawHistory(); $("bannerGroup").hidden = true; bannerData = ""; setRedo(); resetVideo(); $("videoGroup").hidden = true; $("result").classList.remove("show"); $("restored").hidden = true; $("logos").replaceChildren();
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
  $("videoGroup").hidden = !present;
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
    $("caBurn").innerHTML = `<b>${num(h.burned)} $ORYNX</b> burned so far (${h.percent.toFixed(2)}% of supply). <a href="#token">See the burn tracker</a>`;
    $("caBurn").hidden = false; burnShow = true;
  } catch (_) {}
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
async function sendChat(text) {
  text = (text || "").trim();
  if (!text || chatBusy) return;
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

const PAGE = { examples: "examples", token: "token", faq: "faq", consult: "consult" };
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
}
