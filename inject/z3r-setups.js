(async () => {
  if (window.__appSetupsInstalled) return;
  window.__appSetupsInstalled = true;
  const api = window.appSetups;
  if (!api) return;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const until = async (fn, tries = 200) => { for (let i = 0; i < tries; i++) { const v = fn(); if (v) return v; await sleep(50); } return null; };
  const config = await until(() => window.trackerConfig);
  if (!config) return;
  await until(() => config.lastOpened());

  const onSettingsScreen = () => getComputedStyle(document.getElementById('options')).display !== 'none';

  // Drop-downs, multi, single and connectors side by side in one compact band.
  const buildDefault = (base) => {
    const doc = JSON.parse(JSON.stringify(base));
    doc.settings = {
      ...doc.settings,
      useMaps: 0, oneMap: 0, dropDown: 1, multi: 1, single: 1, connectors: 1,
      visible: 0, overworld: 0, checks: 0, autoTracking: 1, autoTrackingPort: '23074', visitMarks: 0,
    };
    doc.mover = {
      'drop-down': { top: 2, left: 2 },
      'multi-chest': { top: 2, left: 170 },
      'single-chest': { top: 2, left: 418 },
      connectors: { top: 2, left: 906 },
    };
    doc.resizer = {
      'drop-down': { width: 164, height: 98 },
      'multi-chest': { width: 244, height: 98 },
      'single-chest': { width: 484, height: 98 },
      connectors: { width: 392, height: 98 },
    };
    doc.zoomer = {};
    return doc;
  };

  const apply = (doc) => {
    config.open(doc);
    if (window.Persist) Persist.saveDefaults(doc);
  };

  let setups = await api.list();
  let current = setups[0] || null;
  if (!current) {
    const doc = buildDefault(config.exportDocument());
    current = await api.save({ name: 'xkeys default', doc });
    if (onSettingsScreen()) apply(doc);
    setups = await api.list();
  } else if (onSettingsScreen()) {
    const doc = await api.get(current.id);
    if (doc) apply(doc);
  }

  // Setup picker in place of the file import row.
  const row = document.getElementById('config-summary')?.parentElement;
  const box = document.createElement('div');
  box.className = 'app-setups';
  box.innerHTML = `
    <select id="app-setup-select"></select>
    <button id="app-setup-load">Load</button>
    <button id="app-setup-new">Save as new</button>
    <button id="app-setup-delete">Delete</button>
    <span id="app-setup-name-row" hidden><input id="app-setup-name" placeholder="Name" maxlength="60"> <button id="app-setup-name-ok">Save</button></span>`;
  row?.appendChild(box);
  const label = row?.parentElement?.querySelector('.settings-label');
  if (label) label.textContent = 'Setup';
  const $ = (id) => document.getElementById(id);
  const fmt = (t) => (t ? new Date(t).toLocaleDateString() : '');

  const render = () => {
    const sel = $('app-setup-select');
    sel.replaceChildren(...setups.map((s) => {
      const o = document.createElement('option');
      o.value = s.id;
      o.textContent = `${s.name} · ${fmt(s.usedAt || s.savedAt)}`;
      o.selected = current && s.id === current.id;
      return o;
    }));
    $('app-setup-delete').disabled = setups.length === 0;
  };
  render();

  $('app-setup-load').onclick = async () => {
    const id = $('app-setup-select').value;
    const doc = await api.use(id);
    if (!doc) return;
    apply(doc);
    setups = await api.list();
    current = setups.find((s) => s.id === id) || current;
    render();
  };
  $('app-setup-new').onclick = () => {
    $('app-setup-name-row').hidden = false;
    $('app-setup-name').value = '';
    $('app-setup-name').focus();
  };
  const saveNew = async () => {
    const name = $('app-setup-name').value.trim();
    if (!name) return;
    const doc = config.exportDocument();
    current = await api.save({ name, doc });
    if (window.Persist) Persist.saveDefaults(doc);
    setups = await api.list();
    $('app-setup-name-row').hidden = true;
    render();
  };
  $('app-setup-name-ok').onclick = saveNew;
  $('app-setup-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') saveNew(); if (e.key === 'Escape') $('app-setup-name-row').hidden = true; });
  let armed = false;
  $('app-setup-delete').onclick = async () => {
    if (!armed) {
      armed = true;
      $('app-setup-delete').textContent = 'Confirm delete';
      $('app-setup-delete').classList.add('danger');
      setTimeout(() => { armed = false; $('app-setup-delete').textContent = 'Delete'; $('app-setup-delete').classList.remove('danger'); }, 3000);
      return;
    }
    armed = false;
    $('app-setup-delete').textContent = 'Delete';
    $('app-setup-delete').classList.remove('danger');
    setups = await api.remove($('app-setup-select').value);
    current = setups[0] || null;
    if (current) apply(await api.use(current.id));
    render();
  };

  // Starting a race or pressing Update defaults saves into the current setup.
  const saveCurrent = async () => {
    const doc = config.exportDocument();
    if (current) current = await api.save({ id: current.id, doc });
    else current = await api.save({ name: 'Setup 1', doc });
    setups = await api.list();
    render();
  };
  document.getElementById('load-button')?.addEventListener('click', () => setTimeout(() => { saveCurrent(); report(); }, 0));
  const upd = document.getElementById('update-defaults');
  if (upd) {
    upd.textContent = 'Save setup';
    upd.setAttribute('data-tip-title', 'Save setup');
    upd.setAttribute('data-tip', 'Saves the current layout and settings into the selected setup. It opens this way next time.');
    upd.addEventListener('click', () => saveCurrent());
  }

  // Report how much room the content needs so the app can zoom it to fit the pane.
  const extent = () => {
    const dialogOpen = [...document.querySelectorAll('[id$="-overlay"]')].some((el) => !el.classList.contains('coop-hidden') && el.offsetParent !== null);
    if (dialogOpen) return { w: 720, h: 440 };
    if (onSettingsScreen()) {
      const o = document.getElementById('options');
      return { w: o.offsetWidth + 24, h: o.scrollHeight + 24 };
    }
    let r = 0, b = 0;
    for (const el of document.querySelectorAll('.location-container')) {
      if (el.offsetParent === null) continue;
      const rc = el.getBoundingClientRect();
      if (!rc.width || !rc.height) continue;
      r = Math.max(r, el.offsetLeft + el.offsetWidth);
      b = Math.max(b, el.offsetTop - (parseFloat(getComputedStyle(el).marginTop) || 0) + el.offsetHeight);
    }
    return r && b ? { w: r + 72, h: b + 6 } : null;
  };
  const mapCount = () => {
    const maps = document.getElementById('enable-maps');
    if (!maps || !maps.checked) return 0;
    return document.getElementById('enable-one-map')?.checked ? 1 : 2;
  };
  let last = '';
  const report = () => {
    const e = extent();
    if (!e) return;
    e.maps = mapCount();
    const key = Math.round(e.w) + 'x' + Math.round(e.h) + ':' + e.maps;
    if (key === last) return;
    last = key;
    api.extent(e);
  };
  document.addEventListener('mouseup', () => setTimeout(report, 0));
  document.addEventListener('click', () => setTimeout(report, 50));
  document.addEventListener('change', () => setTimeout(report, 0));
  setInterval(report, 1000);
  report();
})();
