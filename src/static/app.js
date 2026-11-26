{
const LINKS = {};

const $ = (id) => document.getElementById(id);
const jumlahLogo = () => (gating && holder ? 4 : 2);
let brief = "", ticker = "logo", sibuk = false, mode = "ai", modeKit = "ai";
const MODES = {
  ai: { label: "What does your AI project do?", placeholder: "An AI agent that tracks whale wallets", fitur: "Key features",
        ideas: ["An AI agent that tracks whale wallets", "An AI that explains any token contract", "An AI copilot for trading stock tokens"] },
  meme: { label: "What's your meme?", placeholder: "A frog who only trades at 3am", fitur: "Lore",
        ideas: ["A frog who only trades at 3am", "A cat CEO who never sells", "A chicken scared of liquidation"] },
};
function pilihMode(m) {
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

const pesanTunggu = [
  "Reading your idea... bold move.",
  "Checking whether this has been done a thousand times...",
  "Naming it something you won't regret...",
  "Drawing your logos...",
];

function tampilStatus(t) { $("statusText").textContent = t; $("status").classList.add("show"); }
function sembunyiStatus() { $("status").classList.remove("show"); }
function tampilError(t) { $("error").textContent = t; $("error").classList.add("show"); }
function sembunyiError() { $("error").classList.remove("show"); }

async function api(url, data) {
  const r = await fetch(url, {
    method: data ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: data ? JSON.stringify(data) : undefined,
  });
  let isi = {};
  try { isi = await r.json(); } catch (_) {}
  if (!r.ok) throw new Error(typeof isi.detail === "string" ? isi.detail : "Something went wrong. Try again in a moment.");
  return isi;
}

let gating = false, holder = false;
const pendek = (a) => a.slice(0, 6) + "…" + a.slice(-4);
const angka = (n) => Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });

async function muatJatah() {
  try {
    const s = await api("/api/sisa");
    $("quota").textContent = `Free today: ${s.kit} kit${s.kit === 1 ? "" : "s"} and ${s.logo} logo${s.logo === 1 ? "" : "s"} left`;
    gating = !!s.gating; holder = !!s.holder;
    if (s.total) { $("totalAngka").textContent = angka(s.total); $("totalKit").hidden = false; $("metaRight").hidden = true; }
    $("logoInfo").textContent = gating && holder ? "(PNG, HQ 2048 × 2048 · 4 options)" : "(PNG, 1024 × 1024 · HQ 2048 for $ORYNX holders)";
    tampilWallet(s);
    if (s.token) tampilToken(s.token);
    if (typeof s.chat === "number" && !riwayat.length) $("chatQuota").textContent = `${holder ? "Holder" : "Free"} questions left today: ${s.chat}`;
  } catch (_) {}
}

let tokenTampil = false, tokenCa = "";
function tampilToken(ca) {
  if (tokenTampil || !/^0x[0-9a-f]{40}$/.test(ca)) return;
  tokenTampil = true; tokenCa = ca;
  $("caHome").textContent = ca; $("caBuy").href = `https://ponsfamily.com/launchpad/${ca}`; $("caScan").href = `https://robin.etherscan.io/token/${ca}`;
  $("caHomeCopy").onclick = () => salin(ca, $("caHomeCopy")); $("ca").classList.add("on");
  const box = $("tokenBox");
  box.innerHTML = `<span class="live-tag"><i></i>$ORYNX is live on pons</span>
    <p>Contract address</p>
    <div class="ca"><code>${ca}</code><button type="button" id="caCopy">Copy</button></div>
    <div class="live-acts">
      <a class="pill solid" href="https://ponsfamily.com/launchpad/${ca}" target="_blank" rel="noopener">Buy on pons</a>
      <a class="pill line" href="https://robin.etherscan.io/token/${ca}" target="_blank" rel="noopener">View on explorer</a>
    </div>
    <p>Only trust this address and posts from <a href="https://x.com/orynxhq" target="_blank" rel="noopener">@orynxhq</a>.</p>`;
  $("caCopy").onclick = () => salin(ca, $("caCopy"));
}

function tampilWallet(s) {
  $("wallet").hidden = !gating;
  if (!gating) return;
  const info = $("walletInfo"), btn = $("walletBtn");
  if (s.wallet && s.holder) {
    btn.textContent = "Disconnect";
    info.innerHTML = `<b>Holder ✓</b> ${pendek(s.wallet)} · every logo style unlocked`;
  } else if (s.wallet) {
    btn.textContent = "Disconnect";
    info.textContent = `${pendek(s.wallet)} holds ${angka(s.saldo)} $ORYNX. Hold ${angka(s.min_hold)} to unlock 10 kits a day.`;
  } else {
    btn.textContent = "Connect wallet";
    info.textContent = `Hold ${angka(s.min_hold)} $ORYNX for 10 kits a day and every logo style.`;
  }
  btn.dataset.state = s.wallet ? "on" : "off";
  aturTombolGaya(!sibuk);
}

const ROBINHOOD = { chainId: "0x1237", chainName: "Robinhood Chain", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: ["https://rpc.mainnet.chain.robinhood.com"], blockExplorerUrls: ["https://robin.etherscan.io"] };
async function keRobinhood(eth) {
  try { await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: ROBINHOOD.chainId }] }); }
  catch (e) {
    const kode = e && (e.code || (e.data && e.data.originalError && e.data.originalError.code));
    if (kode === 4902 || kode === -32603) { try { await eth.request({ method: "wallet_addEthereumChain", params: [ROBINHOOD] }); } catch (_) {} }
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

async function hubungkanWallet() {
  sembunyiError();
  const btn = $("walletBtn");
  if (btn.dataset.state === "on") {
    await api("/api/wallet/keluar", {});
    if (wcProv && wcProv.session) { try { await wcProv.disconnect(); } catch (_) {} wcProv = null; }
    return muatJatah();
  }
  const pakaiWc = !window.ethereum;
  if (pakaiWc && !/^[0-9a-f]{32}$/i.test(WC_ID)) { tampilError("No wallet found. Open orynxai.xyz in your wallet app's browser (MetaMask, Rabby or Coinbase Wallet) to connect."); return; }
  const awal = btn.textContent;
  btn.disabled = true;
  try {
    let eth = window.ethereum;
    if (pakaiWc) { btn.textContent = "Opening wallets..."; eth = await providerWc(); }
    const akun = await eth.request({ method: "eth_requestAccounts" });
    const alamat = akun && akun[0];
    if (!alamat) throw new Error("No account found in your wallet.");
    await keRobinhood(eth);
    const pesan = `Sign in to Orynx\nAddress: ${alamat.toLowerCase()}\nNetwork: Robinhood Chain\nTime: ${Math.floor(Date.now() / 1000)}\n\nThis only proves you own this wallet. It is free and never moves your funds.`;
    const hex = "0x" + Array.from(new TextEncoder().encode(pesan), (b) => b.toString(16).padStart(2, "0")).join("");
    if (pakaiWc) { btn.textContent = "Approve in your wallet..."; $("walletInfo").textContent = "Open your wallet app and approve the free sign-in request."; }
    const tanda_tangan = await eth.request({ method: "personal_sign", params: [hex, alamat] });
    await api("/api/wallet", { alamat, pesan, tanda_tangan });
  } catch (err) {
    const batal = err && (err.code === 4001 || /reject|denied|closed|cancel/i.test(err.message || ""));
    if (!batal) tampilError(err.message || "Couldn't connect your wallet. Try again.");
  } finally {
    btn.disabled = false; btn.textContent = awal;
    muatJatah();
  }
}

function salin(teks, tombol) {
  navigator.clipboard.writeText(teks).then(() => {
    if (!tombol) return;
    const awal = tombol.textContent;
    tombol.textContent = "Copied"; tombol.classList.add("done");
    setTimeout(() => { tombol.textContent = awal; tombol.classList.remove("done"); }, 1400);
  }).catch(() => {});
}

function blokSalin(teks, postX) {
  const div = document.createElement("div");
  div.className = "copyblock"; div.textContent = teks;
  const b = document.createElement("button");
  b.className = "copy"; b.type = "button"; b.textContent = "Copy";
  b.onclick = () => salin(teks, b);
  div.appendChild(b);
  if (postX) {
    const a = document.createElement("a");
    a.className = "xpost"; a.target = "_blank"; a.rel = "noopener";
    a.href = "https://x.com/intent/post?text=" + encodeURIComponent(teks);
    a.textContent = "Post on X";
    div.append(document.createElement("br"), a);
  }
  return div;
}

function isi(id, ...el) { $(id).replaceChildren(...el); }

function tampilKit(kit) {
  $("roast").textContent = kit.roast || "Fine. Idea accepted. Don't get cocky.";
  isi("names", ...kit.pilihan.map((p) => {
    const b = document.createElement("button");
    b.className = "name"; b.type = "button";
    const nama = document.createElement("span"); nama.textContent = p.nama;
    const kode = document.createElement("code"); kode.textContent = "$" + p.ticker;
    b.append(nama, kode);
    b.onclick = () => { salin(`${p.nama} ($${p.ticker})`); kode.textContent = "Copied"; setTimeout(() => kode.textContent = "$" + p.ticker, 1200); };
    return b;
  }));
  $("fiturLabel").textContent = MODES[modeKit].fitur;
  isi("tagline", blokSalin(kit.tagline));
  isi("fitur", blokSalin(kit.fitur.map((f) => "• " + f).join("\n")));
  isi("deskripsi", blokSalin(kit.deskripsi));
  isi("bio", blokSalin(kit.bio_x));
  isi("tweets", ...kit.tweet.map((t) => blokSalin(t, true)));
  isi("sambutan", blokSalin(kit.sambutan_telegram));
  cekTicker(kit.pilihan);
  gambarCeklis();
  gambarThread();
  $("hasil").classList.add("show");
}

function aturTombolGaya(aktif) {
  document.querySelectorAll(".style").forEach((b) => {
    const kunci = gating && !holder && b.dataset.gaya !== "bebas";
    b.classList.toggle("locked", kunci);
    b.disabled = !aktif || kunci;
    b.title = kunci ? "For $ORYNX holders" : "";
  });
}

async function buatLogo(gaya) {
  aturTombolGaya(false);
  const wadah = $("logos"); wadah.replaceChildren();
  const slot = Array.from({ length: jumlahLogo() }, () => {
    const k = document.createElement("div"); k.className = "logo loading";
    const g = document.createElement("div"); g.className = "img";
    k.appendChild(g); wadah.appendChild(k); return k;
  });
  await Promise.all(slot.map(async (k, i) => {
    const g = k.querySelector(".img");
    try {
      const h = await api("/api/logo", { brief, gaya, varian: i + 1, mode: modeKit });
      const src = "data:image/png;base64," + h.png;
      const img = document.createElement("img"); img.src = src; img.alt = `Logo option ${i + 1}`;
      g.replaceChildren(img, tandaPakai()); g.onclick = () => pilihLogo(k);
      const a = document.createElement("a");
      a.href = src; a.download = `${ticker}_${gaya}_${i + 1}${h.hq ? "_hq" : ""}.png`; a.textContent = h.hq ? "Download HQ PNG" : "Download PNG";
      if (h.sig) a.dataset.sig = h.sig;
      k.appendChild(a);
    } catch (err) {
      g.textContent = err.message;
    } finally { k.classList.remove("loading"); }
  }));
  aturTombolGaya(true);
  if (kitAktif) kitAktif.pilih = 0;
  tandaiPilihan();
  simpanKit();
  buatBanner();
  muatJatah();
}

$("form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const ide = $("ide").value.trim();
  if (!ide) { $("ide").focus(); return; }
  if (sibuk) return;
  sibuk = true; $("kirim").disabled = true; sembunyiError();
  let n = 0; tampilStatus(pesanTunggu[0]);
  const putar = setInterval(() => tampilStatus(pesanTunggu[++n % pesanTunggu.length]), 2500);
  try {
    modeKit = mode;
    const nama = $("namaSendiri").value.trim(), tickerMau = $("tickerSendiri").value.replace(/[^a-z0-9]/gi, "").toUpperCase();
    const h = await api("/api/kit", { ide, mode: modeKit, nama, ticker: tickerMau });
    if (h.ditolak) { tampilError("Can't build this one: " + h.alasan + " Try an original idea. This didn't use your free kits."); return; }
    brief = h.kit.brief_logo || ide;
    ticker = (h.kit.pilihan[0] && h.kit.pilihan[0].ticker) || "logo";
    kitAktif = { kit: h.kit, mode: modeKit, brief, ticker, sig: h.sig || "", kid: Date.now().toString(36), cek: [], pilih: 0, link: "" };
    $("shareRow").hidden = true;
    $("shareKit").hidden = !galeriAktif || !kitAktif.sig; $("shareKit").disabled = false; $("shareKit").textContent = "Share to community";
    $("restored").hidden = true; $("redoMsg").hidden = true; $("bannerGroup").hidden = true; bannerData = "";
    resetVideo(); $("videoGroup").hidden = true;
    aturRedo();
    tampilKit(h.kit);
    simpanKit();
    catatRef();
    clearInterval(putar); sembunyiStatus();
    $("hasil").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    await buatLogo("bebas");
  } catch (err) {
    tampilError(err.message);
  } finally {
    clearInterval(putar); sembunyiStatus();
    sibuk = false; $("kirim").disabled = false;
    muatJatah();
  }
});

document.querySelectorAll(".mode").forEach((b) => b.onclick = () => pilihMode(b.dataset.mode));
$("walletBtn").onclick = hubungkanWallet;
$("ownToggle").onclick = () => {
  const buka = $("own").hidden;
  $("own").hidden = !buka; $("ownToggle").setAttribute("aria-expanded", String(buka));
  $("ownToggle").textContent = buka ? "Let Si Dev pick the name" : "Have a name in mind?";
  if (buka) $("namaSendiri").focus(); else { $("namaSendiri").value = ""; $("tickerSendiri").value = ""; }
};
pilihMode("ai");
document.querySelectorAll(".style").forEach((b) => b.onclick = () => { if (brief) buatLogo(b.dataset.gaya); });

Object.entries(LINKS).forEach(([nama, url]) => {
  if (!url.startsWith("https://")) return;
  const a = document.createElement("a");
  a.className = "pill line"; a.href = url; a.target = "_blank"; a.rel = "noopener"; a.textContent = nama;
  $("socials").appendChild(a);
});

document.querySelectorAll(".ex-cta").forEach((b) => b.onclick = () => { pilihMode(b.dataset.mode); keBuild(); });

(() => {
  const cv = $("stars"); const ctx = cv.getContext && cv.getContext("2d"); if (!ctx) return;
  const diam = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let w = 0, h = 0, pts = [], jalan = true;
  const ukur = () => {
    const r = window.devicePixelRatio || 1; w = cv.clientWidth; h = cv.clientHeight;
    cv.width = w * r; cv.height = h * r; ctx.setTransform(r, 0, 0, r, 0, 0);
    const n = Math.round(Math.min(90, w * h / 14000));
    pts = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.4 + .3, v: Math.random() * .25 + .05, f: Math.random() * Math.PI * 2 }));
  };
  const gambar = (t) => {
    ctx.clearRect(0, 0, w, h);
    for (const p of pts) {
      if (!diam) { p.y -= p.v; if (p.y < -4) { p.y = h + 4; p.x = Math.random() * w; } }
      const a = .25 + .55 * (0.5 + 0.5 * Math.sin(t / 900 + p.f));
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`; ctx.fill();
    }
  };
  const loop = (t) => { if (jalan) gambar(t); if (!diam) requestAnimationFrame(loop); };
  ukur(); new ResizeObserver(ukur).observe(cv);
  new IntersectionObserver(([e]) => { jalan = e.isIntersecting; }).observe(cv);
  requestAnimationFrame(loop);
})();

const SIMPAN = "orynx_kit_v1";
let kitAktif = null;
function teksKit(k, m) {
  const utama = k.pilihan[0] || { nama: "My token", ticker: "" };
  const bag = [
    `${utama.nama}${utama.ticker ? " ($" + utama.ticker + ")" : ""}`,
    "Launch kit made with Orynx · orynxai.xyz", "",
    "NAME OPTIONS", ...k.pilihan.map((p) => `- ${p.nama} ($${p.ticker})`), "",
    "TAGLINE", k.tagline, "",
    (m === "meme" ? "LORE" : "KEY FEATURES"), ...k.fitur.map((f) => "• " + f), "",
    "DESCRIPTION", k.deskripsi, "",
    "X BIO", k.bio_x, "",
    "FIRST POSTS ON X", ...k.tweet.map((t, i) => `${i + 1}. ${t}`), "",
    "TELEGRAM WELCOME", k.sambutan_telegram, "",
  ];
  return bag.join("\n");
}
const TABEL_CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) c = TABEL_CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (~c) >>> 0; }
function buatZip(files) {
  const enc = new TextEncoder(), isi = [], pusat = []; let off = 0;
  for (const f of files) {
    const nm = enc.encode(f.name), crc = crc32(f.data), n = f.data.length;
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(12, 0x21, true);
    lh.setUint32(14, crc, true); lh.setUint32(18, n, true); lh.setUint32(22, n, true); lh.setUint16(26, nm.length, true);
    isi.push(new Uint8Array(lh.buffer), nm, f.data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(14, 0x21, true);
    ch.setUint32(16, crc, true); ch.setUint32(20, n, true); ch.setUint32(24, n, true); ch.setUint16(28, nm.length, true); ch.setUint32(42, off, true);
    pusat.push(new Uint8Array(ch.buffer), nm);
    off += 30 + nm.length + n;
  }
  const ukuran = pusat.reduce((a, b) => a + b.length, 0);
  const akhir = new DataView(new ArrayBuffer(22));
  akhir.setUint32(0, 0x06054b50, true); akhir.setUint16(8, files.length, true); akhir.setUint16(10, files.length, true);
  akhir.setUint32(12, ukuran, true); akhir.setUint32(16, off, true);
  return new Blob([...isi, ...pusat, new Uint8Array(akhir.buffer)], { type: "application/zip" });
}
function logoSekarang() {
  return Array.from(document.querySelectorAll("#logos .logo a")).map((a) => ({ src: a.href, name: a.download, hq: a.textContent.includes("HQ"), sig: a.dataset.sig || "" }));
}
function simpanKit() {
  if (!kitAktif) return;
  if (!kitAktif.kid) kitAktif.kid = Date.now().toString(36);
  const data = { ...kitAktif, logos: logoSekarang(), t: Date.now() };
  simpanRiwayat(data);
  try { localStorage.setItem(SIMPAN, JSON.stringify(data)); }
  catch (_) { try { localStorage.setItem(SIMPAN, JSON.stringify({ ...data, logos: [] })); } catch (_) {} }
}
function pasangLogo(daftar) {
  const wadah = $("logos"); wadah.replaceChildren();
  daftar.forEach((l, i) => {
    const k = document.createElement("div"); k.className = "logo";
    const g = document.createElement("div"); g.className = "img";
    const img = document.createElement("img"); img.src = l.src; img.alt = `Logo option ${i + 1}`; g.append(img, tandaPakai()); g.onclick = () => pilihLogo(k);
    const a = document.createElement("a"); a.href = l.src; a.download = l.name; a.textContent = l.hq ? "Download HQ PNG" : "Download PNG";
    if (l.sig) a.dataset.sig = l.sig;
    k.append(g, a); wadah.append(k);
  });
}
async function unduhSemua() {
  if (!kitAktif) return;
  const tombol = $("dlAll"), awal = tombol.textContent;
  tombol.disabled = true; tombol.textContent = "Packing...";
  try {
    const enc = new TextEncoder();
    const files = [{ name: "launch-kit.txt", data: enc.encode(teksKit(kitAktif.kit, kitAktif.mode)) }];
    if (bannerData) {
      const bb = atob(bannerData.split(",")[1] || ""); const ba = new Uint8Array(bb.length);
      for (let i = 0; i < bb.length; i++) ba[i] = bb.charCodeAt(i);
      files.push({ name: `${(kitAktif.ticker || "orynx").toLowerCase()}_x_header.png`, data: ba });
    }
    for (const l of logoSekarang()) {
      const biner = atob(l.src.split(",")[1] || ""); const arr = new Uint8Array(biner.length);
      for (let i = 0; i < biner.length; i++) arr[i] = biner.charCodeAt(i);
      files.push({ name: l.name, data: arr });
    }
    const url = URL.createObjectURL(buatZip(files));
    const a = document.createElement("a"); a.href = url; a.download = `${(kitAktif.ticker || "orynx").toLowerCase()}_launch_kit.zip`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    tombol.textContent = "Downloaded";
  } catch (_) { tombol.textContent = "Try again"; }
  setTimeout(() => { tombol.textContent = awal; tombol.disabled = false; }, 1600);
}
function pulihkanKit() {
  let data = null;
  try { data = JSON.parse(localStorage.getItem(SIMPAN) || "null"); } catch (_) {}
  if (!data || !data.kit || Date.now() - (data.t || 0) > 7 * 864e5) return;
  bukaData(data);
  $("restored").hidden = false;
}
function bukaData(data) {
  kitAktif = { kit: data.kit, mode: data.mode, brief: data.brief, ticker: data.ticker, sig: data.sig || "", kid: data.kid || Date.now().toString(36), cek: data.cek || [], pilih: data.pilih || 0, link: data.link || "" };
  modeKit = data.mode || "ai"; brief = data.brief || ""; ticker = data.ticker || "logo";
  resetVideo(); $("redoMsg").hidden = true;
  tampilKit(data.kit);
  $("logos").replaceChildren();
  if (data.logos && data.logos.length) pasangLogo(data.logos);
  tandaiPilihan();
  aturTombolGaya(true);
  aturRedo();
  tampilLinkKit();
  $("shareKit").hidden = !galeriAktif || !kitAktif.sig; $("shareKit").disabled = !!kitAktif.link; $("shareKit").textContent = kitAktif.link ? "Shared to community ✓" : "Share to community";
  buatBanner();
  gambarRiwayat();
}
$("dlAll").onclick = unduhSemua;
$("copyAll").onclick = () => { if (kitAktif) salin(teksKit(kitAktif.kit, kitAktif.mode), $("copyAll")); };
$("clearKit").onclick = () => {
  try { localStorage.removeItem(SIMPAN); } catch (_) {}
  kitAktif = null; brief = ""; $("shareKit").hidden = true; $("shareRow").hidden = true; $("tkNote").hidden = true; $("pickHint").hidden = true; gambarRiwayat(); $("bannerGroup").hidden = true; bannerData = ""; aturRedo(); resetVideo(); $("videoGroup").hidden = true; $("hasil").classList.remove("show"); $("restored").hidden = true; $("logos").replaceChildren();
};

let galeriAktif = false;
const ADMIN = new URLSearchParams(location.search).has("admin");
function kartuKomunitas(it, rank) {
  const a = document.createElement("article"); a.className = "ex";
  const tipe = document.createElement("span"); tipe.className = "ex-type" + (it.mode === "meme" ? " meme" : ""); tipe.textContent = it.mode === "meme" ? "Meme coin" : "AI project";
  const top = document.createElement("div"); top.className = "ex-top";
  const img = document.createElement("img"); img.className = "ex-logo"; img.loading = "lazy"; img.alt = `${it.nama} logo`; img.src = `/api/galeri/logo/${it.id}`;
  const nm = document.createElement("div"); const b = document.createElement("b"); b.textContent = it.nama; const c = document.createElement("code"); c.textContent = it.ticker ? "$" + it.ticker : "";
  nm.append(b, c); top.append(img, nm);
  const tag = document.createElement("p"); tag.className = "ex-tag"; tag.textContent = it.tagline;
  a.append(tipe, top, tag);
  if (it.roast) { const r = document.createElement("p"); r.className = "ex-roast"; const s = document.createElement("b"); s.textContent = "Si Dev: "; r.append(s, document.createTextNode(it.roast)); a.append(r); }
  if (rank) { const rk = document.createElement("span"); rk.className = "ex-rank"; rk.textContent = "#" + rank; a.append(rk); }
  const foot = document.createElement("div"); foot.className = "ex-foot";
  const like = document.createElement("button"); like.type = "button"; like.className = "ex-like" + (sudahSuka(it.id) ? " on" : "");
  like.setAttribute("aria-label", "Like " + it.nama);
  const jml = document.createElement("span"); jml.textContent = it.suka || 0;
  like.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>';
  like.append(jml);
  like.onclick = () => sukai(it, like, jml);
  const buka = document.createElement("a"); buka.className = "ex-open"; buka.href = `/k/${it.id}`; buka.textContent = "Open kit page";
  const remix = document.createElement("button"); remix.type = "button"; remix.className = "ex-remix"; remix.textContent = "Remix";
  remix.onclick = () => remixKit(it);
  foot.append(like, remix, buka); a.append(foot);
  if (ADMIN) {
    const x = document.createElement("button"); x.className = "ex-del"; x.type = "button"; x.textContent = "×"; x.title = "Remove";
    x.onclick = async () => { const kunci = prompt("Admin key"); if (!kunci) return; try { await api("/api/galeri/hapus", { id: it.id, kunci }); a.remove(); } catch (err) { alert(err.message); } };
    a.append(x);
  }
  return a;
}
async function muatGaleri() {
  try {
    const g = await api("/api/galeri");
    galeriAktif = !!g.aktif;
    $("shareKit").hidden = !galeriAktif || !kitAktif || !kitAktif.sig;
    if (g.items && g.items.length) { $("komGrid").replaceChildren(...g.items.map((it) => kartuKomunitas(it))); $("komunitas").hidden = false;
      $("freshGrid").replaceChildren(...g.items.slice(0, 6).map((it) => kartuKomunitas(it))); $("fresh").classList.add("on"); }
    const top = g.top || [];
    $("topWrap").hidden = !top.length;
    if (top.length) $("topGrid").replaceChildren(...top.map((it, i) => kartuKomunitas(it, i + 1)));
  } catch (_) {}
}
async function bagikanKit() {
  if (!kitAktif || !kitAktif.sig) return;
  const logo = [logoPilihan(), ...logoSekarang()].find((l) => l && l.sig);
  if (!logo) { tampilError("Wait for your logos, then share."); return; }
  const btn = $("shareKit"); btn.disabled = true; btn.textContent = "Sharing...";
  const utama = kitAktif.kit.pilihan[0] || {};
  try {
    const h = await api("/api/galeri", { nama: utama.nama || "", ticker: utama.ticker || "", tagline: kitAktif.kit.tagline, roast: kitAktif.kit.roast,
      mode: kitAktif.mode, sig: kitAktif.sig, logo: logo.src.split(",")[1], logo_sig: logo.sig });
    btn.textContent = "Shared to community ✓";
    if (h && h.url) { kitAktif.link = h.url; tampilLinkKit(); centang(5, true); simpanKit(); }
    muatGaleri();
  } catch (err) { btn.disabled = false; btn.textContent = "Share to community"; tampilError(err.message); }
}
$("shareKit").onclick = bagikanKit;

const KUNCI_SUKA = "orynx_suka_v1";
function daftarSuka() { try { return JSON.parse(localStorage.getItem(KUNCI_SUKA) || "[]"); } catch (_) { return []; } }
function sudahSuka(id) { return daftarSuka().includes(id); }
async function sukai(it, tombol, jml) {
  if (tombol.classList.contains("on")) return;
  tombol.classList.add("on", "pop"); setTimeout(() => tombol.classList.remove("pop"), 180);
  jml.textContent = (Number(jml.textContent) || 0) + 1;
  try {
    const h = await api("/api/galeri/suka", { id: it.id });
    document.querySelectorAll(".ex-like").forEach((b) => { if (b.getAttribute("aria-label") === tombol.getAttribute("aria-label")) { b.classList.add("on"); b.lastChild.textContent = h.suka; } });
    try { localStorage.setItem(KUNCI_SUKA, JSON.stringify([...daftarSuka(), it.id].slice(-500))); } catch (_) {}
  } catch (err) {
    tombol.classList.remove("on"); jml.textContent = Math.max(0, (Number(jml.textContent) || 1) - 1);
  }
}

let bannerData = "";
function muatGambar(src) { return new Promise((ok, gagal) => { const im = new Image(); im.onload = () => ok(im); im.onerror = gagal; im.src = src; }); }
function bungkus(ctx, teks, maks) {
  const kata = String(teks || "").split(/\s+/); const baris = []; let kini = "";
  for (const k of kata) { const coba = kini ? kini + " " + k : k; if (ctx.measureText(coba).width > maks && kini) { baris.push(kini); kini = k; } else kini = coba; }
  if (kini) baris.push(kini); return baris;
}
async function buatBanner() {
  aturVideo();
  const logo = logoPilihan();
  if (!kitAktif || !logo) { $("bannerGroup").hidden = true; bannerData = ""; return; }
  try {
    try { await Promise.all([document.fonts.load("64px Michroma"), document.fonts.load("600 32px 'Instrument Sans'")]); } catch (_) {}
    const im = await muatGambar(logo.src);
    const W = 1500, H = 500, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const c = cv.getContext("2d");
    const s = document.createElement("canvas"); s.width = s.height = 8; const sc = s.getContext("2d"); sc.drawImage(im, 0, 0, 8, 8);
    const [r, g, b] = sc.getImageData(0, 0, 1, 1).data;
    const meme = kitAktif.mode === "meme";
    const dasar = meme ? `rgb(${r},${g},${b})` : "#050507";
    c.fillStyle = dasar; c.fillRect(0, 0, W, H);
    const terang = meme && (0.299 * r + 0.587 * g + 0.114 * b) > 150;
    const gl = c.createRadialGradient(1190, 250, 0, 1190, 250, 520);
    gl.addColorStop(0, terang ? "rgba(255,255,255,.35)" : "rgba(255,255,255,.14)"); gl.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = gl; c.fillRect(0, 0, W, H);
    c.strokeStyle = terang ? "rgba(0,0,0,.10)" : "rgba(255,255,255,.08)"; c.lineWidth = 2;
    for (const rr of [230, 300, 370]) { c.beginPath(); c.arc(1190, 250, rr, 0, Math.PI * 2); c.stroke(); }
    c.save(); c.shadowColor = "rgba(0,0,0,.45)"; c.shadowBlur = 50; c.shadowOffsetY = 18;
    const L = 300, lx = 1040, ly = 100, rad = 64;
    c.beginPath(); c.moveTo(lx + rad, ly); c.arcTo(lx + L, ly, lx + L, ly + L, rad); c.arcTo(lx + L, ly + L, lx, ly + L, rad); c.arcTo(lx, ly + L, lx, ly, rad); c.arcTo(lx, ly, lx + L, ly, rad); c.closePath();
    c.fillStyle = "#000"; c.fill(); c.restore();
    c.save(); c.clip(); c.drawImage(im, lx, ly, L, L); c.restore();
    const warna = terang ? "#111111" : "#ffffff", redup = terang ? "rgba(17,17,17,.7)" : "rgba(255,255,255,.62)";
    const utama = kitAktif.kit.pilihan[0] || { nama: "", ticker: "" };
    let ukuran = 72; c.font = `${ukuran}px Michroma, Arial Black, sans-serif`;
    while (c.measureText(utama.nama).width > 780 && ukuran > 36) { ukuran -= 4; c.font = `${ukuran}px Michroma, Arial Black, sans-serif`; }
    c.fillStyle = warna; c.textBaseline = "alphabetic"; c.fillText(utama.nama, 150, 205);
    c.font = "600 34px 'Instrument Sans', Arial, sans-serif"; c.fillStyle = redup; c.fillText(utama.ticker ? "$" + utama.ticker : "", 150, 262);
    c.font = "500 36px 'Instrument Sans', Arial, sans-serif"; c.fillStyle = warna;
    bungkus(c, kitAktif.kit.tagline, 800).slice(0, 2).forEach((bar, i) => c.fillText(bar, 150, 342 + i * 48));
    bannerData = cv.toDataURL("image/png");
    $("bannerImg").src = bannerData; $("bannerDl").href = bannerData;
    $("bannerDl").download = `${(utama.ticker || "orynx").toLowerCase()}_x_header.png`;
    $("bannerGroup").hidden = false;
  } catch (_) { $("bannerGroup").hidden = true; bannerData = ""; }
}

const DURASI_VIDEO = 14;
let videoUrl = "";
function aturVideo() {
  const ada = !!(kitAktif && logoPilihan());
  $("videoGroup").hidden = !ada;
  const hq = gating && holder;
  $("vidInfo").textContent = hq ? "(14 sec, HQ 1080p, no watermark)" : "(14 sec, 720p · HQ 1080p with no watermark for $ORYNX holders)";
}
function resetVideo() {
  if (videoUrl) { URL.revokeObjectURL(videoUrl); videoUrl = ""; }
  $("vidBox").replaceChildren($("vidEmpty") || Object.assign(document.createElement("div"), { id: "vidEmpty", className: "vid-empty" }));
  $("vidEmpty").textContent = "Your logo, name and story, animated with original music. Ready to post on X.";
  $("vidDl").hidden = true; $("vidMsg").textContent = ""; $("vidMake").textContent = "Make intro video"; $("vidMake").disabled = false;
}
function musikIntro(ac, keluar, meme, mulai) {
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const master = ac.createGain(); master.gain.value = 0.85;
  const komp = ac.createDynamicsCompressor(); master.connect(komp); komp.connect(keluar);
  master.gain.setValueAtTime(0.85, mulai + DURASI_VIDEO - 0.9); master.gain.linearRampToValueAtTime(0.0001, mulai + DURASI_VIDEO - 0.05);
  const bpm = meme ? 118 : 96, beat = 60 / bpm, bar = beat * 4;
  const prog = meme ? [[60, 64, 67], [65, 69, 72], [67, 71, 74], [60, 64, 67]] : [[57, 60, 64], [53, 57, 60], [48, 55, 60], [55, 59, 62]];
  const derau = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate); const dd = derau.getChannelData(0); for (let i = 0; i < dd.length; i++) dd[i] = Math.random() * 2 - 1;
  const nada = (f, t, dur, tipe, vol, attack = 0.005) => {
    const o = ac.createOscillator(), g = ac.createGain(); o.type = tipe; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  };
  for (let k = 0, t = 0; t < DURASI_VIDEO - 0.6; t += bar, k++) {
    const ch = prog[k % 4], lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = meme ? 1800 : 900; lp.connect(master);
    for (const m of ch) for (const det of [-6, 6]) {
      const o = ac.createOscillator(), g = ac.createGain(); o.type = meme ? "triangle" : "sawtooth"; o.frequency.value = hz(m); o.detune.value = det;
      const t0 = mulai + t, t1 = Math.min(mulai + t + bar + 0.2, mulai + DURASI_VIDEO);
      g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(meme ? 0.035 : 0.025, t0 + 0.4); g.gain.linearRampToValueAtTime(0.0001, t1);
      o.connect(g); g.connect(lp); o.start(t0); o.stop(t1 + 0.05);
    }
  }
  for (let t = 2.2; t < 11; t += beat) {
    const o = ac.createOscillator(), g = ac.createGain(), t0 = mulai + t;
    o.frequency.setValueAtTime(130, t0); o.frequency.exponentialRampToValueAtTime(45, t0 + 0.14);
    g.gain.setValueAtTime(0.55, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + 0.4);
    const s = ac.createBufferSource(), hp = ac.createBiquadFilter(), hg = ac.createGain(); s.buffer = derau; hp.type = "highpass"; hp.frequency.value = 7000;
    const th = t0 + beat / 2; hg.gain.setValueAtTime(0.09, th); hg.gain.exponentialRampToValueAtTime(0.0001, th + 0.05);
    s.connect(hp); hp.connect(hg); hg.connect(master); s.start(th); s.stop(th + 0.06);
  }
  let i = 0;
  for (let t = 4.5; t < 11; t += beat / 2, i++) {
    const ch = prog[Math.floor(t / bar) % 4]; const m = ch[[0, 2, 1, 2][i % 4]] + 12;
    nada(hz(m), mulai + t, 0.28, meme ? "square" : "triangle", meme ? 0.035 : 0.05);
  }
  for (const [t, m] of [[0.25, 79], [2.2, 84], [3.4, 88], [4.6, 83], [7.7, 86], [8.5, 88], [9.3, 91]]) nada(hz(m), mulai + t, 0.35, "sine", 0.12);
  const o = ac.createOscillator(), g = ac.createGain(), t0 = mulai + 11;
  o.frequency.setValueAtTime(90, t0); o.frequency.exponentialRampToValueAtTime(38, t0 + 0.6);
  g.gain.setValueAtTime(0.7, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.6); o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + 1.7);
  for (const m of prog[0].concat([prog[0][0] + 12])) nada(hz(m), t0, DURASI_VIDEO - 11, "sine", 0.06, 0.3);
}
function gambarIntro(c, W, H, t, d) {
  const S = W / 1280, eo = (x) => 1 - Math.pow(1 - x, 3), p = (a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
  c.globalAlpha = 1; c.fillStyle = d.dasar; c.fillRect(0, 0, W, H);
  const gl = c.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.45, W * 0.55);
  gl.addColorStop(0, d.terang ? "rgba(255,255,255,.35)" : "rgba(255,255,255,.12)"); gl.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = gl; c.fillRect(0, 0, W, H);
  c.strokeStyle = d.terang ? "rgba(0,0,0,.08)" : "rgba(255,255,255,.07)"; c.lineWidth = 2 * S;
  for (const r of [260, 340, 420]) { c.beginPath(); c.arc(W / 2, H * 0.45, r * S * (1 + 0.02 * Math.sin(t * 0.8 + r)), 0, Math.PI * 2); c.stroke(); }
  for (const b of d.bintang) { const y = ((b.y - b.v * t) % 1 + 1) % 1; c.globalAlpha = 0.25 + 0.5 * (0.5 + 0.5 * Math.sin(t * 1.3 + b.f)); c.fillStyle = d.warna; c.beginPath(); c.arc(b.x * W, y * H, b.r * S, 0, Math.PI * 2); c.fill(); }
  c.globalAlpha = 1;
  const logo = (cx, cy, L, a, sk) => {
    if (a <= 0) return; c.save(); c.globalAlpha = a; c.translate(cx, cy); c.scale(sk, sk);
    const r = L * 0.22; c.shadowColor = "rgba(0,0,0,.45)"; c.shadowBlur = 40 * S; c.shadowOffsetY = 14 * S;
    c.beginPath(); c.moveTo(-L / 2 + r, -L / 2); c.arcTo(L / 2, -L / 2, L / 2, L / 2, r); c.arcTo(L / 2, L / 2, -L / 2, L / 2, r); c.arcTo(-L / 2, L / 2, -L / 2, -L / 2, r); c.arcTo(-L / 2, -L / 2, L / 2, -L / 2, r); c.closePath();
    c.fillStyle = "#000"; c.fill(); c.shadowColor = "transparent"; c.clip(); c.drawImage(d.im, -L / 2, -L / 2, L, L); c.restore();
  };
  const teks = (s, x, y, font, warna, a, dy = 0) => { if (a <= 0) return; c.save(); c.globalAlpha = a; c.font = font; c.fillStyle = warna; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(s, x, y + dy); c.restore(); };
  const muat = (font, s, maks, awal, min) => { let u = awal; c.font = font.replace("@", u * S); while (c.measureText(s).width > maks && u > min) { u -= 2; c.font = font.replace("@", u * S); } return font.replace("@", u * S); };
  if (t < 4.7) {
    const keluar = 1 - p(4.3, 4.7), a1 = p(0.2, 0.9);
    const sk = 0.6 + 0.4 * eo(a1) + 0.06 * Math.sin(Math.PI * p(0.7, 1.1));
    logo(W / 2, H * 0.38, 250 * S, eo(a1) * keluar, sk);
    const n = Math.round(d.nama.length * p(2.2, 3.3)); const f = muat("@px Michroma, Arial Black, sans-serif", d.nama, W * 0.8, 60, 28);
    teks(d.nama.slice(0, n), W / 2, H * 0.72, f, d.warna, keluar);
    teks(d.ticker ? "$" + d.ticker : "", W / 2, H * 0.81, `600 ${26 * S}px 'Instrument Sans', Arial, sans-serif`, d.redup, eo(p(3.4, 3.8)) * keluar, (1 - eo(p(3.4, 3.8))) * 12 * S);
  } else if (t < 7.6) {
    const keluar = 1 - p(7.3, 7.6);
    c.font = `600 ${50 * S}px 'Instrument Sans', Arial, sans-serif`;
    const baris = bungkus(c, d.tagline, W * 0.78).slice(0, 3); const tinggi = 66 * S, y0 = H / 2 - (baris.length - 1) * tinggi / 2;
    baris.forEach((b, i) => { const a = eo(p(4.6 + i * 0.35, 5.2 + i * 0.35)); teks(b, W / 2, y0 + i * tinggi, `600 ${50 * S}px 'Instrument Sans', Arial, sans-serif`, d.warna, a * keluar, (1 - a) * 16 * S); });
  } else if (t < 11.1) {
    const keluar = 1 - p(10.8, 11.1);
    teks(d.judul, W / 2, H * 0.17, `600 ${24 * S}px 'Instrument Sans', Arial, sans-serif`, d.redup, eo(p(7.6, 8.0)) * keluar);
    d.fitur.slice(0, 3).forEach((f, i) => {
      const a = eo(p(7.7 + i * 0.8, 8.2 + i * 0.8)) * keluar; if (a <= 0) return;
      const w = W * 0.72, h = H * 0.15, x = (W - w) / 2, y = H * (0.27 + i * 0.2) + (1 - a) * 20 * S;
      c.save(); c.globalAlpha = a; c.fillStyle = d.terang ? "rgba(255,255,255,.55)" : "rgba(255,255,255,.06)"; c.strokeStyle = d.terang ? "rgba(0,0,0,.14)" : "rgba(255,255,255,.16)"; c.lineWidth = 2 * S;
      const r = 22 * S; c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); c.fill(); c.stroke();
      c.font = `500 ${27 * S}px 'Instrument Sans', Arial, sans-serif`; const bs = bungkus(c, f, w - 80 * S).slice(0, 2);
      c.fillStyle = d.warna; c.textAlign = "left"; c.textBaseline = "middle"; bs.forEach((b, j) => c.fillText(b, x + 40 * S, y + h / 2 + (j - (bs.length - 1) / 2) * 34 * S)); c.restore();
    });
  } else {
    const a = eo(p(11.1, 11.7));
    logo(W / 2, H * 0.34, 190 * S, a, 0.85 + 0.15 * a);
    teks(d.nama, W / 2, H * 0.6, muat("@px Michroma, Arial Black, sans-serif", d.nama, W * 0.8, 52, 26), d.warna, eo(p(11.4, 12.0)));
    teks("Launching on pons · Robinhood Chain", W / 2, H * 0.7, `500 ${26 * S}px 'Instrument Sans', Arial, sans-serif`, d.redup, eo(p(11.8, 12.4)));
    if (!d.hq) teks("Made with Orynx · orynxai.xyz", W / 2, H * 0.92, `600 ${18 * S}px 'Instrument Sans', Arial, sans-serif`, d.redup, eo(p(12.2, 12.8)));
  }
}
async function buatVideo() {
  if (!kitAktif) return;
  const logo = logoPilihan();
  if (!logo) { $("vidMsg").textContent = "Wait for your logos first."; return; }
  const cv0 = document.createElement("canvas");
  if (!window.MediaRecorder || !cv0.captureStream) { $("vidMsg").textContent = "Your browser can't record video. Try Chrome or Safari."; return; }
  const tombol = $("vidMake"); tombol.disabled = true; $("vidDl").hidden = true;
  if (videoUrl) { URL.revokeObjectURL(videoUrl); videoUrl = ""; }
  let ac = null;
  try {
    try { await Promise.all([document.fonts.load("60px Michroma"), document.fonts.load("600 32px 'Instrument Sans'")]); } catch (_) {}
    const im = await muatGambar(logo.src);
    const hq = gating && holder, W = hq ? 1920 : 1280, H = hq ? 1080 : 720;
    const s = document.createElement("canvas"); s.width = s.height = 8; const sc = s.getContext("2d"); sc.drawImage(im, 0, 0, 8, 8);
    const [r, g, b] = sc.getImageData(0, 0, 1, 1).data;
    const meme = kitAktif.mode === "meme", terang = meme && (0.299 * r + 0.587 * g + 0.114 * b) > 150;
    const utama = kitAktif.kit.pilihan[0] || { nama: "", ticker: "" };
    const d = { im, hq, terang, dasar: meme ? `rgb(${r},${g},${b})` : "#050507", warna: terang ? "#111111" : "#ffffff", redup: terang ? "rgba(17,17,17,.7)" : "rgba(255,255,255,.62)",
      nama: utama.nama, ticker: utama.ticker, tagline: kitAktif.kit.tagline, fitur: kitAktif.kit.fitur || [], judul: meme ? "The lore" : "What it does",
      bintang: Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.6 + 0.4, v: Math.random() * 0.012 + 0.004, f: Math.random() * 6.28 })) };
    const cv = cv0; cv.width = W; cv.height = H; const c = cv.getContext("2d");
    gambarIntro(c, W, H, 0, d);
    $("vidBox").replaceChildren(cv);
    ac = new (window.AudioContext || window.webkitAudioContext)(); await ac.resume();
    const tujuan = ac.createMediaStreamDestination();
    const aliran = new MediaStream([...cv.captureStream(30).getVideoTracks(), ...tujuan.stream.getAudioTracks()]);
    const jenis = ['video/mp4;codecs="avc1.640028,mp4a.40.2"', 'video/mp4;codecs="avc1.4D401F,mp4a.40.2"', 'video/mp4;codecs="avc1.42E01E,mp4a.40.2"', "video/mp4;codecs=avc1,mp4a.40.2",
      "video/mp4;codecs=avc1,opus", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m)) || "";
    const rek = new MediaRecorder(aliran, jenis ? { mimeType: jenis, videoBitsPerSecond: hq ? 8e6 : 5e6, audioBitsPerSecond: 128000 } : undefined);
    const potongan = []; rek.ondataavailable = (e) => { if (e.data && e.data.size) potongan.push(e.data); };
    const selesai = new Promise((ok) => { rek.onstop = ok; });
    const mulai = ac.currentTime + 0.1; musikIntro(ac, tujuan, meme, mulai);
    rek.start(250);
    const t0 = performance.now() + 100;
    await new Promise((ok) => {
      const putar = () => {
        const t = (performance.now() - t0) / 1000;
        gambarIntro(c, W, H, Math.max(0, t), d);
        tombol.textContent = `Recording... ${Math.max(0, Math.ceil(DURASI_VIDEO - t))}s`;
        if (t < DURASI_VIDEO) requestAnimationFrame(putar); else ok();
      };
      requestAnimationFrame(putar);
    });
    $("vidMsg").textContent = "Keep this tab open while it records.";
    rek.stop(); await selesai;
    const tipe = (rek.mimeType || jenis || "video/webm").split(";")[0];
    const blob = new Blob(potongan, { type: tipe });
    videoUrl = URL.createObjectURL(blob);
    const v = document.createElement("video"); v.src = videoUrl; v.controls = true; v.playsInline = true; v.id = "vidOut";
    $("vidBox").replaceChildren(v);
    const ext = tipe.includes("mp4") ? "mp4" : "webm";
    $("vidDl").href = videoUrl; $("vidDl").download = `${(utama.ticker || "orynx").toLowerCase()}_intro.${ext}`; $("vidDl").hidden = false;
    const siapX = ext === "mp4" && !/opus/i.test(rek.mimeType || jenis);
    $("vidMsg").textContent = siapX ? "Ready to post on X." : "This browser can't make X-ready audio. For posting on X, make it on your phone (Safari or Chrome) or Chrome on Windows or Mac.";
    tombol.textContent = "Make another";
  } catch (err) {
    $("vidMsg").textContent = "Couldn't record the video. Try again in Chrome or Safari.";
    tombol.textContent = "Make intro video";
  } finally {
    tombol.disabled = false;
    if (ac) { try { await ac.close(); } catch (_) {} }
  }
}
$("vidMake").onclick = buatVideo;

function tandaPakai() { const s = document.createElement("span"); s.className = "use"; s.textContent = "In use"; return s; }
function logoPilihan() {
  const semua = logoSekarang(); if (!semua.length) return null;
  const i = kitAktif && kitAktif.pilih < semua.length ? kitAktif.pilih : 0; return semua[i];
}
function tandaiPilihan() {
  const kartu = Array.from(document.querySelectorAll("#logos .logo"));
  const i = kitAktif && kitAktif.pilih < kartu.length ? kitAktif.pilih : 0;
  kartu.forEach((k, j) => k.classList.toggle("pick", j === i && kartu.length > 1));
  $("pickHint").hidden = kartu.length < 2;
}
function pilihLogo(k) {
  if (!kitAktif) return;
  const kartu = Array.from(document.querySelectorAll("#logos .logo")); const i = kartu.indexOf(k);
  if (i < 0 || !k.querySelector("a") || i === kitAktif.pilih) return;
  kitAktif.pilih = i; tandaiPilihan(); resetVideo(); buatBanner(); simpanKit();
}
function tampilLinkKit() {
  const ada = !!(kitAktif && kitAktif.link); $("shareRow").hidden = !ada; if (!ada) return;
  const utama = kitAktif.kit.pilihan[0] || {};
  $("shareUrl").textContent = kitAktif.link.replace(/^https?:\/\//, "");
  $("shareCopy").onclick = () => salin(kitAktif.link, $("shareCopy"));
  $("shareX").href = "https://x.com/intent/post?text=" + encodeURIComponent(`${utama.nama || ""}${utama.ticker ? " $" + utama.ticker : ""}\n${kitAktif.kit.tagline}\n\nmade with Orynx\n${kitAktif.link}`);
}
async function cekTicker(pilihan) {
  const note = $("tkNote"); note.hidden = true;
  const daftar = (pilihan || []).map((p) => p.ticker).filter(Boolean);
  if (!daftar.length) return;
  let hasil = {};
  try { hasil = (await api("/api/ticker?t=" + encodeURIComponent(daftar.join(",")))).hasil || {}; } catch (_) {}
  let dipakai = 0;
  document.querySelectorAll("#names .name").forEach((b, i) => {
    const p = pilihan[i]; if (!p) return; const lama = b.querySelector(".tk-tag"); if (lama) lama.remove();
    if (hasil[p.ticker]) { const t = document.createElement("span"); t.className = "tk-tag"; t.textContent = "Used on Orynx"; b.firstChild.append(t); dipakai++; }
  });
  note.innerHTML = dipakai ? `Tickers marked "Used on Orynx" already appear in our community gallery. Also search <a href="https://ponsfamily.com/launchpad" target="_blank" rel="noopener">pons</a> before you launch.`
    : `None of these tickers are in the Orynx gallery yet. Also search <a href="https://ponsfamily.com/launchpad" target="_blank" rel="noopener">pons</a> before you launch.`;
  note.hidden = false;
}
const CEKLIS = [
  "Download your logo and X header",
  "Set up your X profile: name, bio and header",
  "Post your first post on X",
  "Open a Telegram group and pin the welcome message",
  'Create your token on <a href="https://www.ponsfamily.com/launchpad/create" target="_blank" rel="noopener">pons</a>',
  "Share your kit with the community",
];
function gambarCeklis() {
  if (!kitAktif) return;
  const cek = kitAktif.cek || (kitAktif.cek = []);
  $("checkList").replaceChildren(...CEKLIS.map((t, i) => {
    const li = document.createElement("li"); const l = document.createElement("label");
    const c = document.createElement("input"); c.type = "checkbox"; c.checked = !!cek[i];
    c.onchange = () => centang(i, c.checked);
    const s = document.createElement("span"); s.innerHTML = t; l.append(c, s); li.append(l); return li;
  }));
  hitungCeklis();
}
function centang(i, nilai) {
  if (!kitAktif) return; kitAktif.cek[i] = nilai;
  const c = $("checkList").querySelectorAll("input")[i]; if (c) c.checked = nilai;
  hitungCeklis(); simpanKit();
}
function hitungCeklis() {
  const n = (kitAktif && kitAktif.cek || []).filter(Boolean).length;
  $("checkCount").textContent = n === CEKLIS.length ? "All done. Good luck on launch day!" : `${n} of ${CEKLIS.length} done`;
  $("checkBar").style.width = (n / CEKLIS.length * 100) + "%";
}
let dbJanji = null;
function bukaDb() {
  if (!window.indexedDB) return Promise.resolve(null);
  if (!dbJanji) dbJanji = new Promise((ok) => {
    try {
      const r = indexedDB.open("orynx", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("kits", { keyPath: "kid" });
      r.onsuccess = () => ok(r.result); r.onerror = () => ok(null);
    } catch (_) { ok(null); }
  });
  return dbJanji;
}
async function semuaRiwayat() {
  const db = await bukaDb(); if (!db) return [];
  return new Promise((ok) => {
    try { const q = db.transaction("kits").objectStore("kits").getAll(); q.onsuccess = () => ok((q.result || []).sort((a, b) => b.t - a.t)); q.onerror = () => ok([]); }
    catch (_) { ok([]); }
  });
}
let tundaRiwayat = null;
function simpanRiwayat(data) {
  clearTimeout(tundaRiwayat);
  tundaRiwayat = setTimeout(async () => {
    const db = await bukaDb(); if (!db || !data.kit) return;
    try {
      const tx = db.transaction("kits", "readwrite"); tx.objectStore("kits").put(data);
      tx.oncomplete = async () => {
        const semua = await semuaRiwayat();
        if (semua.length > 24) { const t2 = db.transaction("kits", "readwrite"); semua.slice(24).forEach((x) => t2.objectStore("kits").delete(x.kid)); }
        gambarRiwayat();
      };
    } catch (_) {}
  }, 300);
}
async function hapusRiwayat(kid) {
  const db = await bukaDb(); if (!db) return;
  try { const tx = db.transaction("kits", "readwrite"); tx.objectStore("kits").delete(kid); tx.oncomplete = gambarRiwayat; } catch (_) {}
}
async function gambarRiwayat() {
  const semua = await semuaRiwayat();
  $("mykits").hidden = !semua.length;
  $("mkRow").replaceChildren(...semua.map((d) => {
    const b = document.createElement("div"); b.className = "mk" + (kitAktif && kitAktif.kid === d.kid ? " on" : ""); b.setAttribute("role", "button"); b.tabIndex = 0;
    const u = (d.kit.pilihan || [])[0] || {}; const l = (d.logos || [])[d.pilih || 0] || (d.logos || [])[0];
    const g = l ? Object.assign(document.createElement("img"), { src: l.src, alt: "" }) : Object.assign(document.createElement("span"), { className: "ph" });
    const t = document.createElement("div"); const nb = document.createElement("b"); nb.textContent = u.nama || "Untitled";
    const sm = document.createElement("small"); const n = (d.cek || []).filter(Boolean).length;
    sm.textContent = `${u.ticker ? "$" + u.ticker + " · " : ""}${n}/${CEKLIS.length} done`;
    t.append(nb, document.createElement("br"), sm);
    const x = document.createElement("button"); x.className = "x"; x.type = "button"; x.textContent = "×"; x.setAttribute("aria-label", "Remove " + (u.nama || "kit"));
    x.onclick = (e) => { e.stopPropagation(); if (confirm("Remove this kit from this device?")) hapusRiwayat(d.kid); };
    const buka = () => { if (sibuk) return; bukaData(d); try { localStorage.setItem(SIMPAN, JSON.stringify({ ...d, t: Date.now() })); } catch (_) {} $("restored").hidden = true; $("hasil").scrollIntoView({ behavior: halus(), block: "start" }); };
    b.onclick = buka; b.onkeydown = (e) => { if (e.key === "Enter") buka(); };
    b.append(g, t, x); return b;
  }));
}

function remixKit(it) {
  if (!it) return;
  pilihMode(it.mode === "meme" ? "meme" : "ai");
  $("ide").value = `Remix of ${it.nama}: ${it.tagline || ""}`.slice(0, 200);
  keBuild();
}
function gambarThread() {
  const th = kitAktif && kitAktif.kit && kitAktif.kit.thread;
  $("threadMsg").textContent = "";
  $("threadBtn").textContent = th && th.length ? "New thread" : "Write my launch thread";
  $("threadBtn").hidden = !(kitAktif && kitAktif.sig);
  if (!th || !th.length) {
    $("threadBox").replaceChildren(Object.assign(document.createElement("p"), { className: "th-empty", textContent: "A ready-to-post thread for the moment you go live on pons: the hook, the story, how to buy, your CA and the community call." }));
    return;
  }
  const n = th.length;
  const blok = th.map((t, i) => blokSalin(`${t}\n\n${i + 1}/${n}`, i === 0));
  const cat = document.createElement("p"); cat.className = "th-note"; cat.textContent = "Replace [CA] with your contract address after you create the token on pons.";
  $("threadBox").replaceChildren(...blok, cat);
}
async function buatThread() {
  if (!kitAktif || !kitAktif.sig) return;
  const btn = $("threadBtn"), k = kitAktif.kit, utama = k.pilihan[0] || { nama: "", ticker: "" };
  btn.disabled = true; btn.textContent = "Writing..."; $("threadMsg").textContent = "";
  try {
    const h = await api("/api/thread", { mode: kitAktif.mode, sig: kitAktif.sig, nama: utama.nama, ticker: utama.ticker, tagline: k.tagline,
      roast: k.roast, deskripsi: k.deskripsi, fitur: k.fitur });
    k.thread = h.thread; gambarThread(); simpanKit();
    $("threadMsg").textContent = `${h.sisa} rewrite${h.sisa === 1 ? "" : "s"} left today.`;
  } catch (err) { $("threadMsg").textContent = err.message; btn.textContent = k.thread ? "New thread" : "Write my launch thread"; }
  finally { btn.disabled = false; }
}
$("threadBtn").onclick = buatThread;

const KUNCI_REF = "orynx_ref_from", KUNCI_REF_SAYA = "orynx_myref";
const rapiRef = (t) => String(t || "").toLowerCase().replace(/^@/, "").replace(/[^a-z0-9_]/g, "").slice(0, 20);
function catatRef() {
  let d = null; try { d = JSON.parse(localStorage.getItem(KUNCI_REF) || "null"); } catch (_) {}
  if (!d || d.pakai || Date.now() - d.t > 30 * 864e5) return;
  let saya = ""; try { saya = localStorage.getItem(KUNCI_REF_SAYA) || ""; } catch (_) {}
  if (d.ref === saya) return;
  api("/api/ref/hit", { ref: d.ref }).then(() => { try { localStorage.setItem(KUNCI_REF, JSON.stringify({ ...d, pakai: true })); } catch (_) {} muatRef(); }).catch(() => {});
}
function linkRef(r) { return `${location.origin}/?ref=${r}`; }
async function muatRef() {
  let saya = ""; try { saya = localStorage.getItem(KUNCI_REF_SAYA) || ""; } catch (_) {}
  try {
    const h = await api("/api/ref/top" + (saya ? "?saya=" + encodeURIComponent(saya) : ""));
    if (!h.aktif) { $("refBox").hidden = true; return; }
    const ol = $("refTop");
    if (h.top && h.top.length) ol.replaceChildren(...h.top.map((x) => { const li = document.createElement("li"); const b = document.createElement("b"); b.textContent = "@" + x.ref; const s = document.createElement("span"); s.textContent = `${x.jumlah} builder${x.jumlah === 1 ? "" : "s"}`; li.append(b, s); return li; }));
    if (saya) tampilRefSaya(saya, h.saya);
  } catch (_) {}
}
function tampilRefSaya(r, stat) {
  const url = linkRef(r);
  $("refMine").hidden = false; $("refLink").textContent = url.replace(/^https?:\/\//, ""); $("refInput").value = r;
  $("refCopy").onclick = () => salin(url, $("refCopy"));
  $("refX").href = "https://x.com/intent/post?text=" + encodeURIComponent(`build your token's launch kit in one sentence: name, logo, posts and more.\n\nmade for pons on Robinhood Chain\n${url}`);
  if (stat) $("refStat").textContent = `This week: ${stat.minggu} · All time: ${stat.total}`;
}
$("refForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const r = rapiRef($("refInput").value);
  if (r.length < 3) { $("refInput").focus(); return; }
  try { localStorage.setItem(KUNCI_REF_SAYA, r); } catch (_) {}
  tampilRefSaya(r); muatRef();
});

let burnTampil = false;
async function muatBurn() {
  try {
    const h = await api("/api/burn");
    if (!h.aktif || !h.burned) return;
    $("burn").dataset.ada = "1"; if (halamanAktif === "token") $("burn").hidden = false;
    $("burnNum").textContent = angka(h.burned);
    $("burnPct").textContent = `${h.persen.toFixed(2)}% of the ${angka(h.supply)} total supply, gone for good.`;
    $("burnBar").style.width = Math.max(0.4, Math.min(100, h.persen)) + "%";
    $("burnDead").href = `https://robin.etherscan.io/token/${h.token}?a=${h.dead}`;
    $("burnList").replaceChildren(...(h.riwayat || []).map((b) => {
      const li = document.createElement("li"); const kiri = document.createElement("div");
      const j = document.createElement("b"); j.textContent = angka(b.jumlah) + " $ORYNX";
      const t = document.createElement("span"); t.textContent = b.waktu ? " · " + new Date(b.waktu * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
      kiri.append(j, t);
      const a = document.createElement("a"); a.href = `https://robin.etherscan.io/tx/${b.tx}`; a.target = "_blank"; a.rel = "noopener"; a.textContent = b.tx.slice(0, 8) + "…" + b.tx.slice(-4);
      li.append(kiri, a); return li;
    }));
    $("caBurn").innerHTML = `<b>${angka(h.burned)} $ORYNX</b> burned so far (${h.persen.toFixed(2)}% of supply). <a href="#token">See the burn tracker</a>`;
    $("caBurn").hidden = false; burnTampil = true;
  } catch (_) {}
}
function pasangBondCss() {
  const st = document.createElement("style"); st.textContent = ".ca-warn{margin:14px 0 0}.ca-burn{margin:18px 0 0;padding-top:16px;border-top:1px solid var(--rule-d);line-height:1.55}.ca-card > .ca-box > p{max-width:none}"; document.head.appendChild(st);
}
function pasangBond() {
  if ($("bond")) return;
  const st = document.createElement("style"); st.textContent = ".bond{margin:0 0 22px;padding:16px 18px 14px;border:1px solid #2c2c2c;border-radius:16px;background:#0b0b0b} .bond-top{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:12px} .bond-top span{font-size:13px;font-weight:600;color:#dcdcdc;display:inline-flex;align-items:center;gap:8px} .bond-top span::before{content:'';width:8px;height:8px;border-radius:50%;background:#fff;box-shadow:0 0 10px rgba(255,255,255,.8);animation:pulse 2s ease-in-out infinite} .bond-top b{font:400 26px var(--display);color:#fff;font-variant-numeric:tabular-nums} .bond-bar{position:relative;height:12px;border-radius:999px;background:#1a1a1a;overflow:hidden;box-shadow:inset 0 0 0 1px #262626} .bond-bar i{overflow:hidden;position:absolute;inset:0 auto 0 0;width:0;border-radius:inherit;background:linear-gradient(90deg,#8a8a8a,#fff);box-shadow:0 0 16px rgba(255,255,255,.45);transition:width 1.4s cubic-bezier(.2,.8,.2,1)} .bond-bar i::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.55),transparent);transform:translateX(-100%);animation:bondShine 2.4s ease-in-out infinite} @keyframes bondShine{to{transform:translateX(100%)}} .bond-note{margin:10px 0 0;font-size:13px;color:var(--graphite);line-height:1.5} .bond.done .bond-top span::before{background:#22c55e;box-shadow:0 0 10px #22c55e} @media (prefers-reduced-motion:reduce){.bond-bar i{transition:none}.bond-bar i::after,.bond-top span::before{animation:none}} .ca-card > .ca-box > p{max-width:none} .ca-warn{margin:14px 0 0} .ca-burn{margin:18px 0 0;padding-top:16px;border-top:1px solid var(--rule-d);line-height:1.55}"; document.head.appendChild(st);
  const box = document.querySelector("#ca .ca-box"); if (!box) return;
  box.insertAdjacentHTML("afterbegin", '<div class="bond" id="bond" hidden><div class="bond-top"><span id="bondLbl">Bonding progress</span><b id="bondPct">0%</b></div><div class="bond-bar" role="progressbar" aria-label="Bonding progress" aria-valuemin="0" aria-valuemax="100" id="bondBar"><i id="bondFill"></i></div><p class="bond-note" id="bondNote"></p></div>');
}
let bondNow = 0;
function angkaEth(x) { return x >= 1 ? x.toFixed(2) : x.toFixed(3); }
async function muatBonding() {
  try {
    const h = await api("/api/bonding");
    if (!h.ada) return;
    pasangBond(); if (!$("bond")) return;
    const el = $("bond"); el.hidden = false; el.classList.toggle("done", !!h.lulus);
    const target = Math.max(0, Math.min(100, h.persen));
    $("bondLbl").textContent = h.lulus ? "Graduated" : "Bonding progress";
    $("bondNote").textContent = h.lulus
      ? "$ORYNX finished its bonding curve and now trades in a locked Uniswap v4 pool."
      : `${angkaEth(h.saat_ini)} of ${angkaEth(h.ambang)} ETH raised on the pons curve. At 100% it graduates to a locked Uniswap v4 pool.`;
    $("bondBar").setAttribute("aria-valuenow", target.toFixed(0));
    requestAnimationFrame(() => { $("bondFill").style.width = Math.max(1.5, target) + "%"; });
    const dari = bondNow, mulai = performance.now(), lama = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1400;
    const langkah = (n) => {
      const k = lama ? Math.min(1, (n - mulai) / lama) : 1, e = 1 - Math.pow(1 - k, 3);
      bondNow = dari + (target - dari) * e;
      $("bondPct").textContent = bondNow.toFixed(target >= 100 ? 0 : 1) + "%";
      if (k < 1) requestAnimationFrame(langkah);
    };
    requestAnimationFrame(langkah);
  } catch (_) {}
}
function bacaParam() {
  const q = new URLSearchParams(location.search);
  const r = rapiRef(q.get("ref"));
  if (r.length >= 3) { try { const lama = JSON.parse(localStorage.getItem(KUNCI_REF) || "null"); if (!lama || lama.pakai || Date.now() - lama.t > 30 * 864e5) localStorage.setItem(KUNCI_REF, JSON.stringify({ ref: r, t: Date.now() })); } catch (_) {} }
  const remix = q.get("remix");
  if (remix && /^[0-9a-f]{12}$/.test(remix)) api("/api/item/" + remix).then(remixKit).catch(() => {});
  if (q.has("ref") || q.has("remix")) { q.delete("ref"); q.delete("remix"); const s = q.toString(); history.replaceState(null, "", location.pathname + (s ? "?" + s : "") + location.hash); }
}

function aturRedo() {
  document.querySelectorAll(".redo").forEach((b) => { b.hidden = !(kitAktif && kitAktif.sig); });
}
async function ulangBagian(btn) {
  if (!kitAktif || !kitAktif.sig || btn.disabled) return;
  const bagian = btn.dataset.bagian, awal = btn.textContent, k = kitAktif.kit, utama = k.pilihan[0] || { nama: "", ticker: "" };
  document.querySelectorAll(".redo").forEach((b) => b.disabled = true); btn.textContent = "Rewriting...";
  $("redoMsg").hidden = true;
  try {
    const h = await api("/api/ulang", { bagian, mode: kitAktif.mode, sig: kitAktif.sig, nama: utama.nama, ticker: utama.ticker,
      tagline: k.tagline, roast: k.roast, deskripsi: k.deskripsi, pilihan: k.pilihan, tweet: k.tweet });
    if (bagian === "nama") { k.pilihan = h.nilai; kitAktif.ticker = ticker = (h.nilai[0] && h.nilai[0].ticker) || ticker; }
    else if (bagian === "tagline") k.tagline = h.nilai;
    else k.tweet = h.nilai;
    kitAktif.sig = h.sig;
    tampilKit(k); simpanKit();
    $("shareKit").hidden = !galeriAktif; $("shareKit").disabled = false; $("shareKit").textContent = "Share to community";
    if (bagian !== "tweet") buatBanner();
    $("redoMsg").textContent = `Done. ${h.sisa} rewrite${h.sisa === 1 ? "" : "s"} left today.`; $("redoMsg").hidden = false;
  } catch (err) {
    $("redoMsg").textContent = err.message; $("redoMsg").hidden = false;
  } finally {
    btn.textContent = awal; document.querySelectorAll(".redo").forEach((b) => b.disabled = false);
  }
}
document.querySelectorAll(".redo").forEach((b) => b.onclick = () => ulangBagian(b));

const riwayat = [];
let chatSibuk = false;
function tambahPesan(role, teks) {
  const d = document.createElement("div");
  d.className = "msg " + (role === "user" ? "me" : "bot");
  if (role !== "user") { const s = document.createElement("small"); s.textContent = "Si Dev"; d.append(s); }
  const p = document.createElement("p"); p.textContent = teks; d.append(p);
  $("log").append(d); $("log").scrollTop = $("log").scrollHeight;
  return d;
}
async function kirimChat(teks) {
  teks = (teks || "").trim();
  if (!teks || chatSibuk) return;
  chatSibuk = true; $("chatSend").disabled = true; $("starters").hidden = true;
  tambahPesan("user", teks); riwayat.push({ role: "user", content: teks });
  $("chatText").value = ""; $("chatText").style.height = "";
  const t = tambahPesan("bot", ""); t.classList.add("typing");
  t.querySelector("p").replaceChildren(...[0, 1, 2].map(() => document.createElement("i")));
  try {
    const h = await api("/api/konsul", { pesan: riwayat.slice(-12) });
    const bersih = h.balas.replace(/\*\*(.+?)\*\*/g, "$1").replace(/^#{1,6}\s*/gm, "");
    t.classList.remove("typing"); t.querySelector("p").textContent = bersih;
    riwayat.push({ role: "assistant", content: h.balas });
    $("chatQuota").textContent = `Questions left today: ${h.sisa}`;
    $("chatToKit").hidden = false;
    $("log").scrollTop = $("log").scrollHeight;
  } catch (err) {
    t.remove(); riwayat.pop();
    tambahPesan("bot", err.message).classList.add("err");
  } finally {
    chatSibuk = false; $("chatSend").disabled = false;
  }
}
$("chatForm").addEventListener("submit", (e) => { e.preventDefault(); kirimChat($("chatText").value); });
$("chatText").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); kirimChat($("chatText").value); } });
$("chatText").addEventListener("input", () => { const a = $("chatText"); a.style.height = "auto"; a.style.height = Math.min(a.scrollHeight, 160) + "px"; });
document.querySelectorAll("#starters button").forEach((b) => b.onclick = () => kirimChat(b.textContent));
$("chatToKit").onclick = () => {
  const pertama = riwayat.find((m) => m.role === "user");
  if (pertama) $("ide").value = pertama.content.slice(0, 200);
  keBuild();
};

const HALAMAN = { examples: "examples", token: "token", faq: "faq", consult: "consult" };
const halus = () => matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
let halamanAktif = null;
function bukaHalaman() {
  const h = decodeURIComponent(location.hash.slice(1));
  const hal = HALAMAN[h] || "home";
  const ganti = hal !== halamanAktif;
  document.querySelectorAll("main > section[data-page]").forEach((sec) => {
    sec.hidden = sec.dataset.page !== hal;
    sec.classList.remove("page-in");
    if (ganti && halamanAktif && !sec.hidden) { void sec.offsetWidth; sec.classList.add("page-in"); }
  });
  document.querySelectorAll(".tabbar a, .nav nav a").forEach((a) => {
    const t = a.getAttribute("href").slice(1);
    a.setAttribute("aria-current", String((HALAMAN[t] || "home") === hal && (hal !== "home" || t === "home")));
  });
  halamanAktif = hal;
  $("burn").hidden = !(hal === "token" && $("burn").dataset.ada);
  const el = hal === "home" && h && h !== "home" ? $(h) : null;
  if (el) requestAnimationFrame(() => el.scrollIntoView({ behavior: ganti ? "auto" : halus(), block: h === "build" ? "center" : "start" }));
  else window.scrollTo(0, 0);
}
function keBuild() {
  if (location.hash === "#build") bukaHalaman(); else location.hash = "build";
  setTimeout(() => $("ide").focus({ preventScroll: true }), 450);
}
addEventListener("hashchange", bukaHalaman);
document.querySelectorAll('a[href="#build"]').forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); keBuild(); }));
bacaParam();
bukaHalaman();
pulihkanKit();
muatGaleri();
gambarRiwayat();
muatRef();
pasangBondCss(); muatBurn(); muatBonding(); setInterval(() => { if (!document.hidden) muatBonding(); }, 60000);

muatJatah();
}
