// Muffins 2.0: natural size of the tracker block plus the session's settings.
// Only opens databases that already exist; opening a missing one would create it empty.
(async (id) => {
  const el = document.querySelector('#root > div > div.flex-col');
  const w = el ? parseFloat(el.style.width) || 0 : 0;
  const h = el ? parseFloat(el.style.height) || 0 : 0;
  const names = new Set((await indexedDB.databases().catch(() => [])).map((d) => d.name));
  const get = (db, store, key) => new Promise((resolve) => {
    if (!names.has(db)) return resolve(undefined);
    const req = indexedDB.open(db);
    req.onerror = () => resolve(undefined);
    req.onsuccess = () => {
      const conn = req.result;
      try {
        const q = conn.transaction(store).objectStore(store).get(key);
        q.onsuccess = () => { conn.close(); resolve(q.result); };
        q.onerror = () => { conn.close(); resolve(undefined); };
      } catch { conn.close(); resolve(undefined); }
    };
  });
  let s;
  if (id) {
    s = await get('muffins_tracker_store', 'redux', `alttptracker_session_${id}_settings`);
    for (let i = 0; i < 2 && typeof s === 'string'; i++) { try { s = JSON.parse(s); } catch { s = undefined; } }
    if (!s || typeof s !== 'object') s = (await get('muffins_tracker_db', 'sessions', id))?.settings;
  }
  return { w, h, s: s && typeof s === 'object' ? s : null };
})
