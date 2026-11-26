// One-time upgrade of data saved in this browser by older versions of Orynx.
// Field names changed in Nov 2026; the old -> new name table lives on the server
// (/api/storage-map), so saved kits, likes and referrals keep working.
(() => {
  const FLAG = "orynx_storage_v2";
  let ls = null;
  try { ls = window.localStorage; if (ls.getItem(FLAG)) return; } catch (_) { return; }
  const keys = [];
  for (let i = 0; i < ls.length; i++) { const k = ls.key(i); if (k && k.startsWith("orynx_")) keys.push(k); }
  const done = () => { try { ls.setItem(FLAG, "1"); } catch (_) {} };

  const rename = (v, map) => {
    if (Array.isArray(v)) return v.map((x) => rename(x, map));
    if (!v || typeof v !== "object") return v;
    const out = {};
    for (const [k, x] of Object.entries(v)) out[Object.prototype.hasOwnProperty.call(map, k) ? map[k] : k] = rename(x, map);
    return out;
  };

  const upgradeDb = (map) => new Promise((ok) => {
    if (!window.indexedDB) return ok(false);
    try {
      const r = indexedDB.open("orynx", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("kits", { keyPath: "kid" });
      r.onerror = () => ok(false);
      r.onsuccess = () => {
        const db = r.result;
        try {
          const tx = db.transaction("kits", "readwrite"); const st = tx.objectStore("kits");
          const q = st.getAll(); let changed = false;
          q.onsuccess = () => (q.result || []).forEach((d) => {
            const n = rename(d, map);
            if (JSON.stringify(n) !== JSON.stringify(d)) { st.put(n); changed = true; }
          });
          tx.oncomplete = () => { db.close(); ok(changed); };
          tx.onerror = () => { db.close(); ok(false); };
        } catch (_) { db.close(); ok(false); }
      };
    } catch (_) { ok(false); }
  });

  const old = keys.filter((k) => k !== FLAG);
  if (!old.length && !window.indexedDB) return done();
  fetch("/api/storage-map").then((r) => r.json()).then(async (res) => {
    const map = (res && res.map) || {};
    if (!Object.keys(map).length) return;
    let changed = false;
    for (const k of old) {
      const raw = ls.getItem(k); if (raw === null) continue;
      const nk = Object.prototype.hasOwnProperty.call(map, k) ? map[k] : k;
      let nv = raw;
      try { nv = JSON.stringify(rename(JSON.parse(raw), map)); } catch (_) {}
      if (nk !== k || nv !== raw) {
        try { ls.setItem(nk, nv); if (nk !== k) ls.removeItem(k); changed = true; } catch (_) {}
      }
    }
    if (await upgradeDb(map)) changed = true;
    done();
    if (changed) location.reload();
  }).catch(() => {});
})();
