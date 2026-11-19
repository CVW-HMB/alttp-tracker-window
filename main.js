const { app, BaseWindow, BrowserWindow, WebContentsView, Menu, ipcMain, shell, nativeTheme, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const Arrange = require('./ui/arrange.js');

const DEFAULT_URLS = {
  tracker: 'https://alttprtracker.mfns.dev/tracker.html?f=SNNNNNNNN0000NNNNNGC7C7RNN&d=MYNNNF00111&a=Y23074localhost&s=00000000000000000000000000&p=link&r=1793413549238#!',
  timer: 'https://thettracker.vercel.app/index.html?tracker=true&version=2&checkCount=true&bonks=false&chestTurns=true&deaths=false&rupees=false&screens=true&damage=false&magic=false&boxes=3&appearance=%7B%22v%22%3A1%2C%22timer%22%3A%7B%22color%22%3A%22%233B82F6%22%2C%22font%22%3A%22default%22%2C%22variant%22%3A%22lcd%22%7D%2C%22palettes%22%3A%7B%22checkCount%22%3A%5B%22%233A86FF%22%2C%22%238338EC%22%2C%22%23FF006E%22%2C%22%23FB5607%22%2C%22%23FFBE0B%22%5D%2C%22bonks%22%3A%5B%22%23FFBE0B%22%2C%22%23FB5607%22%2C%22%23FF006E%22%2C%22%238338EC%22%2C%22%233A86FF%22%5D%2C%22chestTurns%22%3A%5B%22%233A86FF%22%2C%22%23FB5607%22%2C%22%23FFBE0B%22%5D%2C%22deaths%22%3A%5B%22%23FFBE0B%22%2C%22%23FB5607%22%2C%22%23FF006E%22%2C%22%238338EC%22%2C%22%233A86FF%22%5D%2C%22rupees%22%3A%5B%22%233A86FF%22%2C%22%23FF006E%22%2C%22%23FFBE0B%22%5D%2C%22screens%22%3A%5B%22%233A86FF%22%2C%22%23FF006E%22%2C%22%23FFBE0B%22%5D%2C%22damage%22%3A%5B%22%233A86FF%22%2C%22%23FF006E%22%2C%22%23FFBE0B%22%5D%2C%22magic%22%3A%5B%22%233A86FF%22%2C%22%238338EC%22%2C%22%23FF006E%22%2C%22%23FB5607%22%2C%22%23FFBE0B%22%5D%7D%7D',
  race: 'https://racetime.gg/alttpr',
};

const SITES = {
  muffins: { launcher: 'https://alttprtracker.mfns.dev/', host: 'alttprtracker.mfns.dev' },
  muffins2: { launcher: 'https://volatile.alttprtracker.mfns.dev/', host: 'volatile.alttprtracker.mfns.dev' },
  timer: { launcher: 'https://thettracker.vercel.app/', host: 'thettracker.vercel.app' },
};

const DEFAULTS = {
  urls: { ...DEFAULT_URLS },
  showLauncher: true,
  bounds: { width: 1500, height: 920 },
  windowLayout: 'wide',   // 'wide' | 'vertical': items over stacked maps, everything else in a column on the right
  customLayout: false,    // launch through the layout editor and place the widgets as arranged there
  verticalBounds: { width: 750, height: 960 },
  customLayouts: {},      // custom layout: { [combination key]: { boxes } }
  z3rExtents: { wide: null, vertical: null },   // custom layout: last entrance tracker extent { w, h, maps } per window layout
  customPos: null,        // custom layout: window position { x, y }
  muffins2Sizes: {},      // custom layout: muffins 2.0 block size { w, h } seen per map mode
  verticalSplit: 0.3,     // vertical: share of the right box below the xkeys panels given to the timer
  layout: 'grid',         // muffins with maps beside items: 'grid' | 'L' | 'stack' | 'auto'
  gridItemsFrac: null,    // grid: share of width for the items box; null = same height as the maps
  gridMapFrac: null,      // grid: cap on row 1 height as a share of the window; null = fill the width
  gridRaceFrac: 0.6,      // grid: share of row 3 given to the race room
  mapFrac: null,          // L: share of height for the maps; null = auto
  itemsFrac: null,        // L: share of width for the items box; null = square
  rightSplit: 0.25,       // L/stack/column: share of the right box given to the timer
  colFrac: 0.32,          // column: share of width for the right column
  stackFrac: null,        // stack: share of width for items+maps; null = as large as fits
  showRace: true,
  muffinsSite: 'classic', // which muffins launcher "New seed settings" opens: 'classic' | 'v2'
  muffins2: null,         // muffins 2.0 keeps its settings in the page, so the app keeps a summary
  muffins2Restore: null,  // { id, mapMode }: map mode a 2.0 session had before vertical switched it to stacked
  hideChat: true,
  blurTimes: false,
  fitTimer: true,
  alwaysOnTop: false,
  zoom: { timer: 0, race: -1 },
  configVersion: 4,
};

// Muffins tracker block sizes at 100% scale, in CSS px. 2.0 has no padding left of its maps.
const ITEMS = 448;
const MAP_H = 448;
const mapPad = () => (muffinsV2() ? 0 : 8);
const mapW0 = () => (muffinsV2() ? 896 : 884);
const DIV = 5;
const BAR = 30;
const MIN_TOP = 150;
const AUTO_MAP_FRAC = 0.55;
const STACK_ASPECT = 1.35;
const GRID_MIN_ROW3 = 150;
const GRID_BAND_DEFAULT = 0.3;
const GGW_MAP = 603;
const Z3R_FLOW_W = 520;   // vertical: width the xkeys panels are laid out in before zooming to the column

const isTest = !app.isPackaged && !!process.env.SHOT_DIR;
const configPath = () => path.join(app.getPath('userData'), 'config.json');
const setupsPath = () => path.join(app.getPath('userData'), 'xkeys-setups.json');
const Z3R_DIR = path.join(__dirname, 'vendor', 'z3rTracker');
const Z3R_URL = pathToFileURL(path.join(Z3R_DIR, 'index.html')).href + '?load';

let cfg;
function loadConfig() {
  try {
    const saved = JSON.parse(fs.readFileSync(configPath(), 'utf8'));
    cfg = { ...structuredClone(DEFAULTS), ...saved, urls: { ...DEFAULT_URLS, ...saved.urls }, zoom: { ...DEFAULTS.zoom, ...saved.zoom } };
    const v = saved.configVersion || 0;
    if (v < 2 && saved.rightSplit === 0.38) cfg.rightSplit = DEFAULTS.rightSplit;
    if (v < 3) {
      cfg.layout = 'grid';
      if (saved.bounds && saved.bounds.width < 1200) cfg.bounds = { ...saved.bounds, width: DEFAULTS.bounds.width };
    }
    if (v < 4) Object.assign(cfg, { gridItemsFrac: null, gridMapFrac: null, gridRaceFrac: DEFAULTS.gridRaceFrac });
    for (const k of ['customLayouts', 'z3rExtents', 'muffins2Sizes']) {
      if (!cfg[k] || typeof cfg[k] !== 'object' || Array.isArray(cfg[k])) cfg[k] = structuredClone(DEFAULTS[k]);
    }
    delete cfg.tracker;
    delete cfg.xkeys;
    delete cfg.z3r;
    cfg.configVersion = DEFAULTS.configVersion;
  } catch {
    cfg = structuredClone(DEFAULTS);
  }
}
let saveTimer;
function writeConfig() {
  try { fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2)); } catch (e) { console.error(e); }
}
function saveConfig() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(writeConfig, 300);
}

const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const CSS = {
  muffinsL: read('inject/muffins.css'),
  muffinsFit: read('inject/muffins-fit.css'),
  muffins2L: read('inject/muffins2.css'),
  muffins2Fit: read('inject/muffins2-fit.css'),
  timer: read('inject/timer.css'),
  race: read('inject/race.css'),
  raceHideChat: read('inject/race-hide-chat.css'),
  raceBlur: read('inject/race-blur.css'),
  racePrompt: read('inject/race-prompt.css'),
  z3r: read('inject/z3r.css'),
};
const TIMER_FIT_JS = read('inject/timer-fit.js');
const MUFFINS_FIT_JS = read('inject/muffins-fit.js');
const MUFFINS2_STATE_JS = read('inject/muffins2-state.js');
const MUFFINS2_MAPMODE_JS = read('inject/muffins2-mapmode.js');
const Z3R_SETUPS_JS = read('inject/z3r-setups.js');
const RACE_PROMPT_JS = read('inject/race-prompt.js');

// ---------- xkeys setups (stored by the app, not the tracker) ----------

function readSetups() {
  try { return JSON.parse(fs.readFileSync(setupsPath(), 'utf8')).setups || []; } catch { return []; }
}
function writeSetups(list) {
  fs.writeFileSync(setupsPath(), JSON.stringify({ setups: list }, null, 1));
}
const setupSummary = (s) => ({ id: s.id, name: s.name, savedAt: s.savedAt, usedAt: s.usedAt });
function listSetups() {
  return readSetups().sort((a, b) => (b.usedAt || 0) - (a.usedAt || 0)).map(setupSummary);
}

// ---------- tracker URL helpers ----------

function hostOf(u) { try { return new URL(u).host; } catch { return ''; } }

const muffinsV2 = () => hostOf(cfg.urls.tracker) === SITES.muffins2.host;
const muffins2Id = () => { try { return new URL(cfg.urls.tracker).searchParams.get('id') || ''; } catch { return ''; } };

function summarizeMuffins2(s) {
  if (!s || typeof s !== 'object') return {};
  const str = (v) => (typeof v === 'string' ? v.slice(0, 40) : undefined);
  return {
    mapMode: str(s.mapMode),
    world: str(s.worldState),
    entrance: !!str(s.entranceMode) && s.entranceMode !== 'none',
    doors: !!str(s.doors) && s.doors !== 'vanilla',
    overworld: (!!str(s.owLayout) && s.owLayout !== 'vanilla') || (!!str(s.owCrossed) && s.owCrossed !== 'none') || s.owMixed === true,
    flags: muffins2Flags(s),
  };
}

// Seed settings that differ from the defaults, for the launcher. World state is always listed.
const cap = (v) => v.charAt(0).toUpperCase() + v.slice(1).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase();

function wildItems(maps, compasses, small, big) {
  if (maps && compasses && small && big) return 'Keysanity';
  const parts = [maps && 'maps', compasses && 'compasses', small && 'small keys', big && 'big keys'].filter(Boolean);
  return parts.length ? 'Wild ' + parts.join(', ') : '';
}

function enemyLine(enemizer, boss) {
  const b = boss ? 'boss shuffle' + (boss === true ? '' : ` (${boss})`) : '';
  if (enemizer) return b ? 'Enemizer + ' + b : 'Enemizer';
  return b ? cap(b) : '';
}

const crystals = (gt, ganon) => (gt === '7' && ganon === '7' ? '' : `Crystals ${gt}/${ganon}`);

function muffins2Flags(s) {
  const v = (k) => (typeof s[k] === 'string' ? s[k].slice(0, 30) : '');
  const set = (k, off) => !!v(k) && v(k) !== off;
  const ad = v('ganonVulnerable') === 'ad';
  const goal = ad ? 'All dungeons' : set('goal', 'ganon') ? cap(v('goal')) : '';
  const other = Object.entries({ shopsanity: 'Shopsanity', activatedFlute: 'Flute active', bonkShuffle: 'Bonk shuffle', ambrosia: 'Ambrosia', followerShuffle: 'Follower shuffle', tavernShuffle: 'Tavern shuffle' })
    .filter(([k]) => s[k] === true).map(([, label]) => label);
  return [
    v('worldState') && cap(v('worldState')),
    set('entranceMode', 'none') && 'Entrance',
    [v('wildSmallKeys') === 'universal' && 'Universal keys', wildItems(s.wildMaps === true, s.wildCompasses === true, v('wildSmallKeys') === 'wild', s.wildBigKeys === true)].filter(Boolean).join(', '),
    enemyLine(set('enemyShuffle', 'none'), set('bossShuffle', 'none') && v('bossShuffle')),
    goal,
    crystals(v('gtOpen') || '7', ad ? '7' : v('ganonVulnerable') || '7'),
    other.join(' · '),
  ].filter(Boolean);
}

const F_WORLD = { O: 'Open', S: 'Standard', I: 'Inverted', R: 'Retro' };
const F_GOAL = { F: 'Fast Ganon', A: 'All dungeons', P: 'Pedestal', T: 'Triforce hunt', H: 'Ganonhunt', O: 'Other goal' };
const F_OTHER = { 7: ['M', 'Mystery'], 13: ['Y', 'Shopsanity'], 14: ['Y', 'Ambrosia'], 15: ['Y', 'Non-progressive bows'], 16: ['Y', 'Flute active'], 17: ['Y', 'Bonk shuffle'] };

function classicFlags(f) {
  const n = (letter, digit) => (letter === 'R' ? 'random' : digit || '7');
  const other = Object.entries(F_OTHER).filter(([i, [on]]) => f[i] === on).map(([, [, label]]) => label);
  return [
    F_WORLD[f[0]],
    f[1] && f[1] !== 'N' && 'Entrance',
    wildItems(f[9] === '1', f[10] === '1', f[11] === '1', f[12] === '1'),
    enemyLine(!!f[5] && f[5] !== 'N', !!f[4] && f[4] !== 'N'),
    F_GOAL[f[18]],
    crystals(n(f[19], f[20]), n(f[21], f[22])),
    other.join(' · '),
  ].filter(Boolean);
}

function seedFlags() {
  if (muffinsV2()) return cfg.muffins2?.flags || [];
  try { return classicFlags(new URL(cfg.urls.tracker).searchParams.get('f') || ''); } catch { return []; }
}

// Classic tracker size at 100% scale for its map mode, as its launcher sizes the window.
function classicSize(d) {
  const sphere = d[3] === 'Y';
  if (d[0] === 'V') return { w: sphere ? 892 : 448, h: 1330 };
  if (d[0] === 'C') return { w: 448, h: sphere ? 988 : 692 };
  return { w: d[0] === 'M' ? 1340 : 448, h: sphere ? 744 : 448 };
}

const vertical = () => cfg.windowLayout === 'vertical';

function muffinsDisplay() {
  try { return new URL(cfg.urls.tracker).searchParams.get('d') || ''; } catch { return ''; }
}

// The app does its own scaling, so the tracker always loads at its 100% scale.
function muffinsLoadUrl() {
  if (muffinsV2()) return cfg.urls.tracker;
  try {
    const u = new URL(cfg.urls.tracker);
    const d = u.searchParams.get('d');
    if (d && d.length >= 6) u.searchParams.set('d', (vertical() ? 'V' : d[0]) + d.slice(1, 5) + 'F' + d.slice(6));
    return u.toString();
  } catch { return cfg.urls.tracker; }
}

// GGW's panels show only for entrance-shuffle seeds, read from the muffins tracker's own flags.
function muffinsEntrance() {
  if (muffinsV2()) return !!cfg.muffins2?.entrance;
  try { const f = new URL(cfg.urls.tracker).searchParams.get('f') || ''; return !!f[1] && f[1] !== 'N'; } catch { return false; }
}
const xkeysOn = () => muffinsEntrance();

// 2.0's "normal" map mode is the one with both maps beside the items (3 wide, 1 tall).
let muffins2Size = null;
function muffinsSplit() {
  if (muffinsV2()) return muffins2Size ? muffins2Size.w > 2 * muffins2Size.h : (cfg.muffins2?.mapMode || 'normal') === 'normal';
  const d = muffinsDisplay();
  return d[0] === 'M' && d[3] !== 'Y';
}

function layoutMode() {
  if (vertical()) return 'vertical';
  return muffinsSplit() ? 'split' : 'column';
}

// ---------- main window ----------

let win = null, views = {}, geo = null, focused = 'timer', mode = 'split', z3rLoaded = false, z3rExtent = null, z3rMaps = 0;
let custom = null;   // custom layout session: { ext, liveMaps, panels, screen, order, key, ctx, elements, boxes, saved, frame }

const validExt = (e) => !!e && Number.isFinite(e.w) && Number.isFinite(e.h) && e.w > 0 && e.h > 0;

// Plain description of the window's widgets for Arrange; session is null for the editor.
function customCtx(session) {
  const L = session ? (mode === 'vertical' ? 'vertical' : 'wide') : (vertical() ? 'vertical' : 'wide');
  const v = L === 'vertical', v2 = muffinsV2();
  const ctx = { windowLayout: L, v2, muffins: 'block', muffinsSize: { w: 448, h: 448 }, muffinsParts: [], entrance: xkeysOn(), ggwMaps: 0, z3rExtent: null, showRace: cfg.showRace };
  if (!v2) {
    const d = muffinsDisplay(), sphere = d[3] === 'Y';
    if (v) {
      ctx.muffinsSize = classicSize('V' + d.slice(1));
      ctx.muffinsParts = ['stacked maps', sphere && 'sphere tracker'].filter(Boolean);
    } else if (muffinsSplit()) {
      ctx.muffins = 'split';
    } else {
      const z = classicSize(d);
      ctx.muffinsSize = z;
      if (z.w === 448 && z.h === 448) ctx.muffins = 'items';
      else ctx.muffinsParts = [d[0] === 'M' ? 'maps' : d[0] === 'C' ? 'compact maps' : d[0] === 'V' ? 'stacked maps' : null, sphere && 'sphere tracker'].filter(Boolean);
    }
  } else {
    const mm = v ? 'vertical' : ((cfg.muffins2Restore?.id === muffins2Id() ? cfg.muffins2Restore.mapMode : cfg.muffins2?.mapMode) || 'normal');
    if (!v && muffinsSplit()) ctx.muffins = 'split';
    else {
      ctx.muffinsSize = muffins2Size || cfg.muffins2Sizes[mm] || (mm === 'vertical' ? { w: 448, h: 1344 } : { w: 448, h: 448 });
      ctx.muffinsParts = mm === 'vertical' ? ['stacked maps'] : (!mm || mm === 'none') ? [] : [mm + ' maps'];
    }
  }
  const cached = cfg.z3rExtents[L];
  ctx.z3rExtent = session ? session.ext : (validExt(cached) ? { w: cached.w, h: cached.h } : null);
  ctx.ggwMaps = session && session.liveMaps != null ? session.liveMaps : (cached?.maps === 1 || cached?.maps === 2 ? cached.maps : 0);
  return ctx;
}

// Re-resolves the session's arrangement; true when its combination changed.
function customResolve() {
  const ctx = customCtx(custom);
  const r = Arrange.resolve(ctx, cfg.customLayouts[Arrange.comboKey(ctx)]);
  const changed = r.key !== custom.key;
  Object.assign(custom, { ctx, key: r.key, elements: r.elements, boxes: r.boxes, saved: r.saved, frame: Arrange.frame(r.boxes) });
  return changed;
}

function customArea() {
  if (isTest && process.env.SHOT_AREA) {
    const [width, height] = process.env.SHOT_AREA.split('x').map(Number);
    return { x: 0, y: 0, width, height };
  }
  const { screen } = require('electron');
  const pos = cfg.customPos && Number.isFinite(cfg.customPos.x) && Number.isFinite(cfg.customPos.y) ? cfg.customPos : null;
  return (pos ? screen.getDisplayNearestPoint(pos) : screen.getPrimaryDisplay()).workArea;
}

// Opens at the arrangement's natural size, scaled down only to fit the monitor; later calls only shrink.
function sizeCustomWindow(initial) {
  const b = win.getBounds(), c = win.getContentBounds();
  const area = customArea(), F = custom.frame;
  const fit = Arrange.fitScale(F, { width: area.width - (b.width - c.width), height: area.height - (b.height - c.height) });
  const s = initial ? fit : Math.min(geo?.kind === 'custom' ? geo.s : fit, fit);
  const sim = isTest && process.env.SHOT_SIZE;
  const [cw, ch] = initial && sim ? [cfg.bounds.width, cfg.bounds.height] : [Math.round(F.w * s), Math.round(F.h * s)];
  win.setAspectRatio(0);
  win.setContentSize(cw, ch);
  if (!sim) win.setAspectRatio(F.w / F.h);
  const nb = win.getBounds();
  const cx = (x) => Math.max(area.x, Math.min(x, area.x + area.width - nb.width));
  const cy = (y) => Math.max(area.y, Math.min(y, area.y + area.height - nb.height));
  if (!initial) win.setPosition(cx(nb.x), cy(nb.y));
  else if (cfg.customPos && Number.isFinite(cfg.customPos.x) && Number.isFinite(cfg.customPos.y)) win.setPosition(cx(cfg.customPos.x), cy(cfg.customPos.y));
  else win.setPosition(cx(area.x + Math.round((area.width - nb.width) / 2)), cy(area.y + Math.round((area.height - nb.height) / 2)));
}

const customScale = () => (custom && geo?.kind === 'custom' ? geo.s : 1);

function makeView(name, opts = {}) {
  const v = new WebContentsView({
    webPreferences: { backgroundThrottling: false, preload: opts.preload, partition: opts.partition, contextIsolation: true, sandbox: true },
  });
  v.setBackgroundColor(opts.bg || '#000000');
  win.contentView.addChildView(v);
  views[name] = v;
  return v;
}

function guardLinks(name) {
  const wc = views[name].webContents;
  const home = () => hostOf(wc.getURL());
  wc.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url) && hostOf(url) === home()) {
      return { action: 'allow', overrideBrowserWindowOptions: { width: 900, height: 700, backgroundColor: '#111', webPreferences: { backgroundThrottling: false } } };
    }
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  wc.on('will-navigate', (e, url) => {
    if (/^https?:/.test(url) && hostOf(url) !== home()) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });
  wc.on('focus', () => { focused = name; });
}

const cssKeys = {};
async function setCss(name, key, css, on) {
  const wc = views[name]?.webContents;
  if (!wc || wc.isDestroyed()) return;
  const k = `${name}:${key}`;
  if (cssKeys[k]) { try { await wc.removeInsertedCSS(cssKeys[k]); } catch {} delete cssKeys[k]; }
  if (on) cssKeys[k] = await wc.insertCSS(css);
}

function applyRaceCss() {
  setCss('race', 'hideChat', CSS.raceHideChat, cfg.hideChat);
  setCss('race', 'blur', CSS.raceBlur, cfg.blurTimes);
}

function applyTimerFit() {
  setCss('timer', 'fit', CSS.timer, cfg.fitTimer);
  views.timer.webContents.executeJavaScript(`window.__trackerFit && window.__trackerFit(${cfg.fitTimer})`).catch(() => {});
}

function setVars(name, vars) {
  const wc = views[name]?.webContents;
  if (!wc || wc.isDestroyed()) return;
  const body = Object.entries(vars).map(([k, v]) => `s.setProperty('${k}', '${v}');`).join('');
  wc.executeJavaScript(`(() => { const s = document.documentElement.style; ${body} })()`).catch(() => {});
}

function pushTrackerLayout() {
  if (!geo) return;
  if (mode === 'split' && geo.kind === 'custom') {
    setVars('tracker', geo.tracker.vars);
  } else if (mode === 'split') {
    setVars('tracker', {
      '--it-scale': geo.itemsScale,
      '--map-scale': geo.mapScale,
      '--map-top': geo.mapTop + 'px',
      '--map-left': (geo.mapX || 0) - mapPad() * geo.mapScale + 'px',
    });
  } else if (muffinsV2()) {
    const b = views.tracker.getBounds();
    if (geo.kind === 'custom') setVars('tracker', { '--fit': Math.max(0.1, geo.tracker.fit) });
    else if (muffins2Size) setVars('tracker', { '--fit': Math.max(0.1, Math.min(b.width / muffins2Size.w, b.height / muffins2Size.h)) });
  } else {
    views.tracker.webContents.executeJavaScript('window.__muffinsFit && window.__muffinsFit()').catch(() => {});
  }
}

// Muffins 2.0 can change its map mode from inside the tracker, so its shape is polled.
// Vertical needs a 2.0 session's maps stacked; the wide layout gets the session's own map mode back.
function syncMuffins2MapMode(wc, id, current) {
  if (!current) return;
  const restore = cfg.muffins2Restore?.id === id ? cfg.muffins2Restore.mapMode : null;
  const want = vertical() ? 'vertical' : restore;
  if (!vertical() && restore) { cfg.muffins2Restore = null; saveConfig(); }
  if (!want || want === current) return;
  if (vertical() && !restore) { cfg.muffins2Restore = { id, mapMode: current }; saveConfig(); }
  wc.executeJavaScript(`(${MUFFINS2_MAPMODE_JS})(${JSON.stringify(id)}, ${JSON.stringify(want)})`).catch(() => {});
}

let muffins2Timer = null;
async function pollMuffins2() {
  const wc = views.tracker?.webContents;
  if (!wc || wc.isDestroyed() || !muffinsV2()) return;
  const st = await wc.executeJavaScript(`(${MUFFINS2_STATE_JS})(${JSON.stringify(muffins2Id())})`).catch(() => null);
  if (!st || typeof st !== 'object') return;
  syncMuffins2MapMode(wc, muffins2Id(), typeof st.s?.mapMode === 'string' ? st.s.mapMode : null);
  const w = +st.w, h = +st.h;
  const sizeChanged = w > 0 && h > 0 && (w !== muffins2Size?.w || h !== muffins2Size?.h);
  if (sizeChanged) {
    muffins2Size = { w, h };
    cfg.muffins2Sizes[mode === 'vertical' ? 'vertical' : (st.s?.mapMode || 'normal')] = { w, h };
    saveConfig();
  }
  const next = { ...cfg.muffins2, ...summarizeMuffins2(st.s) };
  const settingsChanged = JSON.stringify(next) !== JSON.stringify(cfg.muffins2);
  if (settingsChanged) { cfg.muffins2 = next; saveConfig(); sendLauncherState(); }
  if (layoutMode() !== mode) createMain();
  else if (sizeChanged || settingsChanged) layout();
}

// Row 1: items, light world, dark world. Row 2: xkeys panels. Row 3: stats and race room.
function computeGrid(W, H) {
  const ggw = xkeysOn() ? z3rMaps : 0;          // GGW maps replacing the muffins maps: 0, 1 or 2
  const k = ggw ? ggw : mapW0() / MAP_H;      // map row width per unit of height
  let bandH = 0;
  if (xkeysOn()) {
    const aspect = z3rExtent ? z3rExtent.h / z3rExtent.w : GRID_BAND_DEFAULT * H / W;
    bandH = Math.round(Math.max(50, Math.min(W * aspect, 0.4 * H)));
  }
  const cap = Math.min(cfg.gridMapFrac != null ? cfg.gridMapFrac * H : H, H - (bandH ? bandH + DIV : 0) - GRID_MIN_ROW3 - DIV);
  let itemsW = cfg.gridItemsFrac != null ? Math.round(cfg.gridItemsFrac * W) : Math.round(Math.min((W - DIV) / (1 + k), cap));
  itemsW = Math.max(100, Math.min(itemsW, W - 300));
  const mapX = itemsW + DIV;
  let mapScale, mapW, mapH;
  if (ggw) {
    mapH = Math.max(40, Math.floor(Math.min((W - mapX) / ggw, cap)));
    mapW = mapH * ggw;
    mapScale = 1;
  } else {
    mapScale = Math.max(0.1, Math.min((W - mapX) / mapW0(), cap / MAP_H));
    mapW = Math.ceil(mapW0() * mapScale);
    mapH = Math.round(MAP_H * mapScale);
  }
  const itemsSide = Math.min(itemsW, Math.max(mapH, Math.min(itemsW, cap)));
  const row1H = Math.max(mapH, itemsSide);
  const bandY = row1H + DIV;
  const row3Y = bandY + (bandH ? bandH + DIV : 0);
  const row3H = Math.max(0, H - row3Y);
  const raceW = cfg.showRace ? Math.max(220, Math.min(Math.round(W * cfg.gridRaceFrac), W - 200)) : 0;
  const statsW = cfg.showRace ? W - raceW - DIV : W;
  return { kind: 'grid', W, H, ggw, itemsW, itemsScale: itemsSide / ITEMS, mapScale, mapW, mapH, mapX, mapTop: 0, row1H, bandY, bandH, row3Y, row3H, statsW, raceW };
}

function computeL(W, H) {
  const avail = H - DIV;
  let mapScale = Math.min(W / mapW0(), ((cfg.mapFrac ?? AUTO_MAP_FRAC) * avail) / MAP_H);
  if (avail - MAP_H * mapScale < MIN_TOP) mapScale = Math.max(0, avail - MIN_TOP) / MAP_H;
  const mapW = Math.ceil(mapW0() * mapScale);
  const topH = Math.round(avail - MAP_H * mapScale);
  let itemsW;
  if (cfg.itemsFrac != null) itemsW = Math.round(cfg.itemsFrac * W);
  else itemsW = Math.min(topH, W - Math.max(240, Math.round(0.4 * W)));
  itemsW = Math.max(80, Math.min(itemsW, W - 160 - DIV));
  return { kind: 'L', W, H, topH, itemsW, itemsScale: Math.min(itemsW, topH) / ITEMS, mapScale, mapW, mapX: 0, mapTop: topH + DIV };
}

// Items above maps at the same width, timer and race in a full-height column on the right.
function computeStack(W, H) {
  const k = MAP_H / mapW0();
  const fit = Math.floor((H - DIV) / (1 + k));
  let w = cfg.stackFrac != null ? Math.round(cfg.stackFrac * W) : fit;
  w = Math.max(120, Math.min(w, fit, W - 220 - DIV));
  return { kind: 'stack', W, H, topH: w, itemsW: w, leftW: w, itemsScale: w / ITEMS, mapScale: w / mapW0(), mapW: w, mapX: 0, mapTop: w + DIV, rightW: W - w - DIV };
}

function computeColumn(W, H) {
  const rightW = Math.max(220, Math.min(Math.round(cfg.colFrac * W), W - 200));
  return { kind: 'column', W, H, rightW, trackerW: W - rightW - DIV };
}

// Tracker on the left at its own aspect so it fills the height; xkeys panels, timer and race on the right.
function computeVertical(W, H) {
  const nat = muffinsV2() ? muffins2Size || { w: 448, h: 1344 } : classicSize('V' + muffinsDisplay().slice(1));
  const leftW = Math.max(150, Math.min(Math.round((H * nat.w) / nat.h), W - 260 - DIV));
  const rightX = leftW + DIV, rightW = W - rightX;
  let bandH = 0, z3rZoom = 1;
  if (xkeysOn()) {
    z3rZoom = Math.round(Math.max(0.5, Math.min(1.2, rightW / Z3R_FLOW_W)) * 100) / 100;
    bandH = Math.round(Math.min(z3rExtent ? z3rExtent.h * z3rZoom : 0.28 * H, 0.55 * H));
  }
  return { kind: 'vertical', W, H, leftW, rightX, rightW, bandH, z3rZoom };
}

function pickGeometry(W, H) {
  if (mode === 'vertical') return computeVertical(W, H);
  if (mode !== 'split') return computeColumn(W, H);
  let want = cfg.layout;
  if (want === 'auto') want = W / H > STACK_ASPECT ? 'stack' : 'L';
  if (want === 'stack') return computeStack(W, H);
  if (want === 'L') return computeL(W, H);
  return computeGrid(W, H);
}

// Lays out timer, controls and race inside a box on the right.
function layoutRightBox(x, y, w, h, split = cfg.rightSplit) {
  views.rightDivider.setVisible(cfg.showRace);
  views.race.setVisible(cfg.showRace);
  if (cfg.showRace) {
    const timerH = Math.max(40, Math.round((h - DIV - BAR) * split));
    views.timer.setBounds({ x, y, width: w, height: timerH });
    views.rightDivider.setBounds({ x, y: y + timerH, width: w, height: DIV });
    views.controls.setBounds({ x, y: y + timerH + DIV, width: w, height: BAR });
    views.race.setBounds({ x, y: y + timerH + DIV + BAR, width: w, height: Math.max(0, h - timerH - DIV - BAR) });
  } else {
    views.timer.setBounds({ x, y, width: w, height: Math.max(0, h - BAR) });
    views.controls.setBounds({ x, y: y + Math.max(0, h - BAR), width: w, height: BAR });
  }
}

// Zooms the xkeys pane so its panels fit the band, and places GGW maps in row 1 when they are on.
function fitZ3r() {
  const v = views.z3r;
  if (!v || !v.getVisible() || !geo) return;
  const wc0 = v.webContents;
  if (geo.kind === 'custom') {
    const p = geo.z3r;
    if (!p) return;
    wc0.setZoomFactor(p.zoom);
    const body = Object.entries(p.vars).map(([k, val]) => `s.setProperty('${k}', '${val}');`).join('');
    const ov = !!p.overlay;
    wc0.executeJavaScript(`(() => { const r = document.documentElement, s = r.style; ${body} r.classList.toggle('app-vertical', ${!ov && p.vertical}); r.classList.toggle('app-ggw-maps', ${!ov && p.ggw > 0}); dispatchEvent(new Event('resize')); })()`).catch(() => {});
    return;
  }
  if (geo.kind === 'vertical') {
    wc0.setZoomFactor(geo.z3rZoom);
    const flow = (geo.rightW / geo.z3rZoom).toFixed(2) + 'px';
    wc0.executeJavaScript(`(() => { const r = document.documentElement; r.style.setProperty('--flow-w', '${flow}'); r.classList.remove('app-ggw-maps'); r.classList.add('app-vertical'); dispatchEvent(new Event('resize')); })()`).catch(() => {});
    return;
  }
  wc0.executeJavaScript(`document.documentElement.classList.remove('app-vertical')`).catch(() => {});
  if (!z3rExtent || geo.kind !== 'grid') return;
  const W = geo.W, bandH = geo.bandH;
  if (!W || !bandH) return;
  const f = Math.round(Math.max(0.3, Math.min(1.6, W / z3rExtent.w, bandH / z3rExtent.h)) * 100) / 100;
  v.webContents.setZoomFactor(f);
  const wc = v.webContents;
  if (geo.ggw) {
    const z = geo.mapH / f / GGW_MAP;
    const vars = {
      '--band-top': (geo.bandY / f).toFixed(2) + 'px',
      '--gm-z': z.toFixed(4),
      '--gm-left-1': (geo.mapX / f / z).toFixed(2) + 'px',
      '--gm-left-2': ((geo.mapX + geo.mapH) / f / z).toFixed(2) + 'px',
    };
    const body = Object.entries(vars).map(([k2, val]) => `s.setProperty('${k2}', '${val}');`).join('');
    wc.executeJavaScript(`(() => { const s = document.documentElement.style; ${body} document.documentElement.classList.add('app-ggw-maps'); dispatchEvent(new Event('resize')); })()`).catch(() => {});
  } else {
    wc.executeJavaScript(`document.documentElement.classList.remove('app-ggw-maps')`).catch(() => {});
  }
}

function ensureZ3r() {
  if (z3rLoaded || !views.z3r) return;
  z3rLoaded = true;
  views.z3r.webContents.loadURL(Z3R_URL);
}

function layout() {
  if (!win || win.isDestroyed()) return;
  const { width: W, height: H } = win.getContentBounds();
  if (custom) return layoutCustom(W, H);
  const show = (name, on) => views[name].setVisible(on);
  geo = pickGeometry(W, H);
  const grid = geo.kind === 'grid';
  const panels = (grid || geo.kind === 'vertical') && xkeysOn();
  show('z3r', panels);
  show('raceDivider', grid && cfg.showRace);
  if (panels) ensureZ3r();

  if (grid) {
    const { itemsW, row1H, bandY, bandH, row3Y, row3H, statsW, raceW, ggw } = geo;
    views.tracker.setBounds({ x: 0, y: 0, width: ggw ? itemsW : W, height: row1H });
    show('mapDivider', true); show('itemsDivider', true); show('colDivider', false); show('rightDivider', false);
    views.itemsDivider.setBounds({ x: itemsW, y: 0, width: DIV, height: row1H });
    views.mapDivider.setBounds({ x: 0, y: row1H, width: W, height: DIV });
    if (xkeysOn()) views.z3r.setBounds(ggw ? { x: 0, y: 0, width: W, height: bandY + bandH } : { x: 0, y: bandY, width: W, height: bandH });
    show('race', cfg.showRace);
    if (cfg.showRace) {
      views.timer.setBounds({ x: 0, y: row3Y, width: statsW, height: row3H });
      views.raceDivider.setBounds({ x: statsW, y: row3Y, width: DIV, height: row3H });
      const rx = statsW + DIV;
      views.controls.setBounds({ x: rx, y: row3Y, width: raceW, height: BAR });
      views.race.setBounds({ x: rx, y: row3Y + BAR, width: raceW, height: Math.max(0, row3H - BAR) });
    } else {
      views.controls.setBounds({ x: 0, y: row3Y, width: W, height: BAR });
      views.timer.setBounds({ x: 0, y: row3Y + BAR, width: W, height: Math.max(0, row3H - BAR) });
    }
  } else if (geo.kind === 'vertical') {
    const { leftW, rightX, rightW, bandH } = geo;
    views.tracker.setBounds({ x: 0, y: 0, width: leftW, height: H });
    show('itemsDivider', false); show('colDivider', true); show('mapDivider', bandH > 0);
    views.colDivider.setBounds({ x: leftW, y: 0, width: DIV, height: H });
    let y = 0;
    if (bandH) {
      views.z3r.setBounds({ x: rightX, y: 0, width: rightW, height: bandH });
      views.mapDivider.setBounds({ x: rightX, y: bandH, width: rightW, height: DIV });
      y = bandH + DIV;
    }
    layoutRightBox(rightX, y, rightW, H - y, cfg.verticalSplit);
  } else if (geo.kind === 'L') {
    const { topH, itemsW } = geo;
    views.tracker.setBounds({ x: 0, y: 0, width: W, height: H });
    show('mapDivider', true); show('itemsDivider', true); show('colDivider', false);
    views.mapDivider.setBounds({ x: 0, y: topH, width: W, height: DIV });
    views.itemsDivider.setBounds({ x: itemsW, y: 0, width: DIV, height: topH });
    layoutRightBox(itemsW + DIV, 0, W - itemsW - DIV, topH);
  } else if (geo.kind === 'stack') {
    const { leftW, rightW } = geo;
    views.tracker.setBounds({ x: 0, y: 0, width: leftW, height: H });
    show('mapDivider', false); show('itemsDivider', false); show('colDivider', true);
    views.colDivider.setBounds({ x: leftW, y: 0, width: DIV, height: H });
    layoutRightBox(leftW + DIV, 0, rightW, H);
  } else {
    const { rightW, trackerW } = geo;
    show('mapDivider', false); show('itemsDivider', false); show('colDivider', true);
    views.tracker.setBounds({ x: 0, y: 0, width: trackerW, height: H });
    views.colDivider.setBounds({ x: trackerW, y: 0, width: DIV, height: H });
    layoutRightBox(trackerW + DIV, 0, rightW, H);
  }
  pushTrackerLayout();
  fitZ3r();
}

function layoutCustom(W, H) {
  if (customResolve()) {
    sizeCustomWindow(false);
    ({ width: W, height: H } = win.getContentBounds());
  }
  const { ctx, boxes, frame, key } = custom;
  const t = Arrange.windowScale(frame, W, H), w = { W, H };
  const tp = Arrange.trackerPlan(ctx, boxes, t, w);
  const zp = Arrange.z3rPlan(ctx, boxes, t, w, custom.panels);
  const overlay = !!(zp && z3rExtent && custom.screen && custom.screen !== 'panels');
  const zv = overlay ? { ...zp, ...Arrange.z3rOverlay(Arrange.toView(boxes.entrance, t), z3rExtent, w), overlay: true } : zp;
  geo = { kind: 'custom', key, s: t.s, ox: t.ox, oy: t.oy, frame, boxes, tracker: tp, z3r: zv, W, H };
  for (const d of ['mapDivider', 'itemsDivider', 'colDivider', 'rightDivider', 'raceDivider']) views[d].setVisible(false);
  views.tracker.setVisible(true); views.timer.setVisible(true); views.controls.setVisible(true);
  views.race.setVisible(cfg.showRace);
  views.z3r.setVisible(!!zp);
  if (zp) ensureZ3r();
  views.tracker.setBounds(tp.bounds);
  if (zv) views.z3r.setBounds(zv.bounds);
  views.timer.setBounds(Arrange.toView(boxes.stonks, t));
  const rv = Arrange.raceViews(boxes.race, t);
  views.controls.setBounds(rv.controls);
  views.race.setBounds(rv.race);
  const order = [...(zp && zp.back ? ['z3r', 'tracker'] : ['tracker', 'z3r']), 'timer', 'race', 'controls'];
  if (overlay) order.push(order.splice(order.indexOf('z3r'), 1)[0]);
  if (order.join() !== custom.order) {
    for (const n of order) win.contentView.addChildView(views[n]);
    custom.order = order.join();
  }
  customZoom();
  pushTrackerLayout();
  fitZ3r();
}

function customZoom() {
  const s = customScale();
  const set = (n, z) => { const wc = views[n]?.webContents; if (wc && !wc.isDestroyed()) wc.setZoomFactor(z); };
  set('race', 1.2 ** cfg.zoom.race * s);
  set('timer', 1.2 ** cfg.zoom.timer * s);
  set('controls', s);
}

function sendState() {
  const s = { hideChat: cfg.hideChat, blurTimes: cfg.blurTimes, showRace: cfg.showRace, fitTimer: cfg.fitTimer, alwaysOnTop: cfg.alwaysOnTop, raceUrl: views.race?.webContents.getURL() || cfg.urls.race };
  if (views.controls && !views.controls.webContents.isDestroyed()) views.controls.webContents.send('state', s);
  buildMenu();
}

function setOption(key, value) {
  cfg[key] = value;
  saveConfig();
  if (key === 'hideChat' || key === 'blurTimes') applyRaceCss();
  if (key === 'fitTimer') applyTimerFit();
  if (key === 'showRace') layout();
  if (key === 'alwaysOnTop' && win) win.setAlwaysOnTop(value, 'floating');
  sendState();
  sendLauncherState();
}

function normalizeRaceUrl(input) {
  let s = String(input || '').trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) {
    s = s.replace(/^\/+/, '');
    s = s.startsWith('racetime.gg') ? 'https://' + s : 'https://racetime.gg/' + s;
  }
  try { const u = new URL(s); return u.protocol.startsWith('http') ? u.toString() : null; } catch { return null; }
}

function loadRace(input) {
  const u = normalizeRaceUrl(input);
  if (!u) return;
  cfg.urls.race = u;
  saveConfig();
  views.race?.webContents.loadURL(u);
  sendLauncherState();
}

function zoomFocused(delta) {
  const name = focused === 'race' ? 'race' : 'timer';
  cfg.zoom[name] = delta === 0 ? DEFAULTS.zoom[name] : Math.max(-5, Math.min(5, cfg.zoom[name] + delta));
  if (custom) layout(); else views[name].webContents.setZoomLevel(cfg.zoom[name]);
  saveConfig();
}

function setLayout(v) { cfg.layout = v; saveConfig(); layout(); buildMenu(); sendLauncherState(); }

function resetLayout() {
  Object.assign(cfg, {
    gridItemsFrac: null, gridMapFrac: null, gridRaceFrac: DEFAULTS.gridRaceFrac,
    mapFrac: null, itemsFrac: null, stackFrac: null, rightSplit: DEFAULTS.rightSplit, colFrac: DEFAULTS.colFrac,
  });
  saveConfig(); layout(); buildMenu();
}

function buildMenu() {
  const t = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : [{ label: 'File', submenu: [{ role: 'quit' }] }]),
    { role: 'editMenu' },
    {
      label: 'Tracker',
      submenu: [
        { label: 'New Seed: Update Muffins Settings…', accelerator: 'CmdOrCtrl+U', click: () => openSiteLauncher('muffins') },
        { label: 'Change Stats Tracker…', click: () => openSiteLauncher('timer') },
        { type: 'separator' },
        { label: 'Launcher…', accelerator: 'CmdOrCtrl+,', click: openLauncher },
      ],
    },
    {
      label: 'Race',
      submenu: [
        { label: 'Hide Race Chat (spoilers)', type: 'checkbox', checked: cfg.hideChat, accelerator: 'CmdOrCtrl+Shift+H', click: (i) => setOption('hideChat', i.checked) },
        { label: 'Blur Finish Times', type: 'checkbox', checked: cfg.blurTimes, accelerator: 'CmdOrCtrl+Shift+B', click: (i) => setOption('blurTimes', i.checked) },
        { type: 'separator' },
        { label: 'Open Race Room…', accelerator: 'CmdOrCtrl+L', enabled: !!win, click: () => views.controls.webContents.send('focus-url') },
        { label: 'ALttPR Race List', enabled: !!win, click: () => loadRace('https://racetime.gg/alttpr') },
        { label: 'Open Race Room in Browser', enabled: !!win, click: () => shell.openExternal(views.race.webContents.getURL()) },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Layout',
          submenu: [
            { label: 'Grid', type: 'radio', enabled: !custom, checked: cfg.layout === 'grid', click: () => setLayout('grid') },
            { label: 'L Shape', type: 'radio', enabled: !custom, checked: cfg.layout === 'L', click: () => setLayout('L') },
            { label: 'Stacked Column', type: 'radio', enabled: !custom, checked: cfg.layout === 'stack', click: () => setLayout('stack') },
            { label: 'Auto (L or Stacked)', type: 'radio', enabled: !custom, checked: cfg.layout === 'auto', click: () => setLayout('auto') },
          ],
        },
        { label: 'Show Race Room', type: 'checkbox', checked: cfg.showRace, accelerator: 'CmdOrCtrl+Shift+R', click: (i) => setOption('showRace', i.checked) },
        { label: 'Auto-fit Timer', type: 'checkbox', checked: cfg.fitTimer, click: (i) => setOption('fitTimer', i.checked) },
        { label: 'Reset Layout', enabled: !!win && !custom, click: resetLayout },
        { label: 'Snap Window to Square', enabled: !!win && !custom, click: () => { const b = win.getContentBounds(); const s = Math.max(b.width, b.height); win.setContentSize(s, s); } },
        { type: 'separator' },
        { label: 'Zoom In (timer/race pane)', accelerator: 'CmdOrCtrl+=', enabled: !!win, click: () => zoomFocused(0.5) },
        { label: 'Zoom Out (timer/race pane)', accelerator: 'CmdOrCtrl+-', enabled: !!win, click: () => zoomFocused(-0.5) },
        { label: 'Reset Zoom (timer/race pane)', accelerator: 'CmdOrCtrl+0', enabled: !!win, click: () => zoomFocused(0) },
        { type: 'separator' },
        { label: 'Reload Item Tracker', enabled: !!win, click: () => views.tracker.webContents.reload() },
        { label: 'Reload xkeys Panels', enabled: !!win && z3rLoaded, click: () => views.z3r.webContents.reload() },
        { label: 'Reload Timer', enabled: !!win, click: () => views.timer.webContents.reload() },
        { label: 'Reload Race Room', enabled: !!win, click: () => views.race.webContents.reload() },
        { type: 'separator' },
        { label: 'Always on Top', type: 'checkbox', checked: cfg.alwaysOnTop, click: (i) => setOption('alwaysOnTop', i.checked) },
        { label: 'Developer Tools (focused pane)', accelerator: 'Alt+CmdOrCtrl+I', enabled: !!win, click: () => views[focused]?.webContents.openDevTools({ mode: 'detach' }) },
      ],
    },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(t));
}

function closeMain() {
  if (!win || win.isDestroyed()) return;
  const w = win;
  win = null;
  w.removeAllListeners('closed');
  w.destroy();
  views = {};
}

function createMain() {
  closeMain();
  nativeTheme.themeSource = 'dark';
  mode = layoutMode();
  z3rLoaded = false;
  z3rExtent = null;
  z3rMaps = 0;
  custom = null;
  if (cfg.customLayout) {
    const c = cfg.z3rExtents[mode === 'vertical' ? 'vertical' : 'wide'];
    custom = { ext: validExt(c) ? { w: c.w, h: c.h } : null, liveMaps: null, panels: null, screen: null, order: '', key: null };
    customResolve();
  }
  win = new BaseWindow({
    ...(custom ? { useContentSize: true, width: custom.frame.w, height: custom.frame.h, minWidth: 240, minHeight: 180 }
      : { ...(mode === 'vertical' ? cfg.verticalBounds : cfg.bounds), minWidth: 600, minHeight: 420 }),
    title: 'ALttP Tracker',
    backgroundColor: '#000000',
    show: custom ? false : !isTest,
  });
  if (isTest && process.env.SHOT_HIDDEN) { win.setOpacity(0); win.setIgnoreMouseEvents(true); }
  if (custom) sizeCustomWindow(true);
  if (isTest) win.showInactive();
  else if (custom) win.show();
  win.setAlwaysOnTop(cfg.alwaysOnTop, 'floating');

  const uiPreload = path.join(__dirname, 'ui/preload.js');
  makeView('z3r', { bg: '#111111', preload: path.join(__dirname, 'ui/z3r-preload.js'), partition: 'persist:xkeys' });
  makeView('tracker');
  makeView('timer', { bg: '#1f1f1f' });
  makeView('race', { bg: '#1b1d22' });
  for (const d of ['mapDivider', 'itemsDivider', 'colDivider', 'rightDivider', 'raceDivider']) makeView(d, { preload: uiPreload });
  makeView('controls', { preload: uiPreload, bg: '#1b1d22' });

  for (const n of ['tracker', 'timer', 'race', 'z3r']) guardLinks(n);

  const tw = views.tracker.webContents;
  tw.on('dom-ready', async () => {
    if (muffinsV2()) {
      await setCss('tracker', 'layout', mode === 'split' ? CSS.muffins2L : CSS.muffins2Fit, true);
      pollMuffins2();
    } else {
      await setCss('tracker', 'layout', mode === 'split' ? CSS.muffinsL : CSS.muffinsFit, true);
      if (mode !== 'split') await tw.executeJavaScript(MUFFINS_FIT_JS).catch(() => {});
    }
    pushTrackerLayout();
  });
  clearInterval(muffins2Timer);
  muffins2Timer = setInterval(pollMuffins2, 1500);

  const tm = views.timer.webContents;
  tm.on('dom-ready', async () => {
    if (custom) tm.setZoomFactor(1.2 ** cfg.zoom.timer * customScale()); else tm.setZoomLevel(cfg.zoom.timer);
    await tm.executeJavaScript(TIMER_FIT_JS).catch(() => {});
    applyTimerFit();
  });

  const zw = views.z3r.webContents;
  zw.on('dom-ready', async () => {
    await setCss('z3r', 'app', CSS.z3r, true);
    zw.executeJavaScript(Z3R_SETUPS_JS).catch(() => {});
  });

  const rc = views.race.webContents;
  rc.on('dom-ready', async () => {
    if (custom) rc.setZoomFactor(1.2 ** cfg.zoom.race * customScale()); else rc.setZoomLevel(cfg.zoom.race);
    // Only race rooms get the compact layout; it collapses login and other pages.
    const room = await rc.executeJavaScript("!!document.querySelector('.race-status')").catch(() => false);
    await setCss('race', 'base', CSS.race, room);
    applyRaceCss();
    // racetime's Add comment button needs window.prompt(), which Electron lacks.
    await setCss('race', 'prompt', CSS.racePrompt, true);
    rc.executeJavaScript(RACE_PROMPT_JS).catch(() => {});
  });
  rc.on('did-navigate', sendState);
  rc.on('did-navigate-in-page', sendState);

  const divider = (name, id, o) => views[name].webContents.loadFile(path.join(__dirname, 'ui/divider.html'), { query: { id, o } });
  divider('mapDivider', 'map', 'h');
  divider('itemsDivider', 'items', 'v');
  divider('colDivider', 'col', 'v');
  divider('rightDivider', 'right', 'h');
  divider('raceDivider', 'race', 'v');
  views.controls.webContents.loadFile(path.join(__dirname, 'ui/controls.html'));
  views.controls.webContents.on('did-finish-load', () => {
    if (custom) views.controls.webContents.setZoomFactor(customScale());
    sendState();
  });

  tw.loadURL(muffinsLoadUrl());
  tm.loadURL(cfg.urls.timer);
  rc.loadURL(cfg.urls.race);

  layout();
  win.on('resize', layout);
  const isCustom = !!custom;
  const saveBounds = () => {
    if (!win || win.isMinimized() || win.isFullScreen()) return;
    if (isCustom) { const b = win.getBounds(); cfg.customPos = { x: b.x, y: b.y }; }
    else if (mode === 'vertical') cfg.verticalBounds = win.getBounds(); else cfg.bounds = win.getBounds();
    saveConfig();
  };
  if (!isCustom) win.on('resized', saveBounds);
  win.on('moved', saveBounds);
  win.on('close', () => { saveBounds(); writeConfig(); });
  win.on('closed', () => {
    clearInterval(muffins2Timer);
    win = null; views = {}; custom = null;
    if (!launcher) app.quit();
  });

  buildMenu();
  if (isTest) debugShots(process.env.SHOT_DIR);
}

// Applies a changed URL to the running window without a full relaunch where possible.
function applyLive(kind) {
  if (!win) return;
  if (kind === 'tracker') {
    muffins2Size = null;
    if (layoutMode() !== mode) createMain();
    else { views.tracker.webContents.loadURL(muffinsLoadUrl()); layout(); }
  }
  if (kind === 'timer') views.timer.webContents.loadURL(cfg.urls.timer);
  if (kind === 'race') views.race.webContents.loadURL(cfg.urls.race);
}

// ---------- launcher ----------

let launcher = null;
const siteWins = {};

function openLauncher() {
  if (launcher && !launcher.isDestroyed()) { launcher.focus(); return; }
  const testPage = isTest && process.env.SHOT_PAGE;
  launcher = new BrowserWindow({
    width: 620, height: 720, minWidth: 520, minHeight: 480,
    ...(testPage && process.env.SHOT_SIZE ? cfg.bounds : {}),
    title: 'ALttP Tracker Launcher', backgroundColor: '#15171b',
    show: !isTest,
    webPreferences: { preload: path.join(__dirname, 'ui/preload.js'), contextIsolation: true, sandbox: true },
  });
  if (isTest) {
    if (process.env.SHOT_HIDDEN) { launcher.setOpacity(0); launcher.setIgnoreMouseEvents(true); }
    launcher.showInactive();
  }
  launcher.loadFile(path.join(__dirname, testPage || 'ui/launcher.html'), testPage ? { search: process.env.SHOT_PAGE_SEARCH || '' } : undefined);
  launcher.on('closed', () => {
    launcher = null;
    launcherBounds = null;
    if (!win) app.quit();
  });
  buildMenu();
}

function launcherState() {
  return {
    urls: cfg.urls,
    defaults: DEFAULT_URLS,
    showLauncher: cfg.showLauncher,
    showRace: cfg.showRace,
    running: !!win,
    muffinsSite: cfg.muffinsSite,
    windowLayout: cfg.windowLayout,
    customLayout: cfg.customLayout,
    flags: seedFlags(),
  };
}

function sendLauncherState(extra = {}) {
  if (launcher && !launcher.isDestroyed()) launcher.webContents.send('launcher-state', { ...launcherState(), ...extra });
}

// Opens a site's own launcher page and captures the tracker URL it tries to open.
function openSiteLauncher(kind) {
  const site = kind === 'muffins' && cfg.muffinsSite === 'v2' ? SITES.muffins2 : SITES[kind];
  if (!site) return;
  const open = siteWins[kind];
  if (open && !open.isDestroyed()) {
    if (open.site === site) { open.focus(); return; }
    open.close();
  }
  const w = new BrowserWindow({
    width: kind === 'muffins' ? 1100 : 1000, height: 900, title: kind === 'muffins' ? 'Muffins tracker launcher' : 'Stonks tracker launcher',
    backgroundColor: '#111', parent: launcher || undefined,
    show: !isTest,
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  if (isTest) {
    if (process.env.SHOT_HIDDEN) { w.setOpacity(0); w.setIgnoreMouseEvents(true); }
    w.showInactive();
  }
  w.site = site;
  siteWins[kind] = w;
  const v2 = site === SITES.muffins2;
  const isTrackerUrl = (url) => {
    try {
      const u = new URL(url, site.launcher);
      if (u.host !== site.host) return false;
      if (v2) return u.pathname === '/tracker' && !!u.searchParams.get('id');
      return kind === 'muffins' ? u.pathname.endsWith('/tracker.html') : u.searchParams.get('tracker') === 'true';
    } catch { return false; }
  };
  const capture = async (url) => {
    const full = new URL(url, w.webContents.getURL() || site.launcher).toString();
    if (v2) {
      // 2.0 saves the new session in the page's storage; read its settings before the window goes.
      const id = new URL(full).searchParams.get('id');
      let st = null;
      for (let i = 0; i < 10 && !st?.s && !w.isDestroyed(); i++) {
        st = await w.webContents.executeJavaScript(`(${MUFFINS2_STATE_JS})(${JSON.stringify(id)})`).catch(() => null);
        if (!st?.s) await new Promise((r) => setTimeout(r, 200));
      }
      cfg.muffins2 = summarizeMuffins2(st?.s);
    }
    if (kind === 'muffins') cfg.urls.tracker = full; else cfg.urls.timer = full;
    saveConfig();
    applyLive(kind === 'muffins' ? 'tracker' : 'timer');
    sendLauncherState({ flash: kind });
    setImmediate(() => { if (!w.isDestroyed()) w.close(); });
  };
  w.webContents.setWindowOpenHandler(({ url }) => {
    if (isTrackerUrl(url)) { capture(url); return { action: 'deny' }; }
    if (hostOf(url) === site.host) return { action: 'allow' };
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  w.webContents.on('will-navigate', (e, url) => {
    if (isTrackerUrl(url)) { e.preventDefault(); capture(url); return; }
    if (/^https?:/.test(url) && hostOf(url) !== site.host) { e.preventDefault(); shell.openExternal(url); }
  });
  w.loadURL(site.launcher);
}

// ---------- IPC ----------

// Only the app's own pages (launcher, bars, dividers, bundled z3rTracker) may talk to the main process.
const APP_URL = pathToFileURL(__dirname).href;
const fromApp = (e) => (e.senderFrame?.url || '').startsWith(APP_URL);
const on = (ch, fn) => ipcMain.on(ch, (e, ...a) => { if (fromApp(e)) fn(e, ...a); });
const handle = (ch, fn) => ipcMain.handle(ch, (e, ...a) => (fromApp(e) ? fn(e, ...a) : null));

let drag = null;
on('drag-start', (_e, id) => {
  if (!geo || geo.kind === 'custom') return;
  drag = {
    id,
    geo: { ...geo },
    mapFrac: geo.H ? (geo.H - DIV - (geo.topH || 0)) / (geo.H - DIV) : 0.5,
    rightSplit: geo.kind === 'vertical' ? cfg.verticalSplit : cfg.rightSplit,
  };
});
on('drag-move', (_e, id, dx, dy) => {
  if (!drag || drag.id !== id || !geo) return;
  const g = drag.geo, { W, H } = g;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  if (g.kind === 'grid') {
    if (id === 'items') cfg.gridItemsFrac = clamp((g.itemsW + dx) / W, 0.08, 0.6);
    if (id === 'map') cfg.gridMapFrac = clamp((g.row1H + dy) / H, 0.15, 0.9);
    if (id === 'race') cfg.gridRaceFrac = clamp((g.raceW - dx) / W, 0.15, 0.85);
  } else if (g.kind === 'L') {
    if (id === 'map') cfg.mapFrac = clamp(drag.mapFrac - dy / (H - DIV), 0.1, 0.85);
    if (id === 'items') cfg.itemsFrac = clamp((g.itemsW + dx) / W, 0.1, 0.9);
  } else if (g.kind === 'stack') {
    if (id === 'col') cfg.stackFrac = clamp((g.leftW + dx) / W, 0.1, 0.9);
  } else if (g.kind === 'vertical') {
    if (id === 'right') cfg.verticalSplit = clamp(drag.rightSplit + dy / Math.max(1, H - (g.bandH ? g.bandH + DIV : 0) - DIV - BAR), 0.05, 0.9);
    layout();
    return;
  } else if (id === 'col') {
    cfg.colFrac = clamp((g.rightW - dx) / W, 0.15, 0.8);
  }
  if (id === 'right') {
    const boxH = g.kind === 'L' ? g.topH : H;
    cfg.rightSplit = clamp(drag.rightSplit + dy / Math.max(1, boxH - DIV - BAR), 0.05, 0.9);
  }
  layout();
});
on('drag-end', () => { drag = null; saveConfig(); });
on('drag-reset', (_e, id) => {
  const kind = geo?.kind;
  if (kind === 'vertical') {
    if (id === 'right') { cfg.verticalSplit = DEFAULTS.verticalSplit; saveConfig(); layout(); }
    return;
  }
  if (kind === 'grid') {
    if (id === 'items') cfg.gridItemsFrac = null;
    if (id === 'map') cfg.gridMapFrac = null;
    if (id === 'race') cfg.gridRaceFrac = DEFAULTS.gridRaceFrac;
  } else {
    if (id === 'map') cfg.mapFrac = null;
    if (id === 'items') cfg.itemsFrac = null;
    if (id === 'col') { if (kind === 'stack') cfg.stackFrac = null; else cfg.colFrac = DEFAULTS.colFrac; }
  }
  if (id === 'right') cfg.rightSplit = DEFAULTS.rightSplit;
  saveConfig(); layout();
});

on('set-option', (_e, key, value) => {
  if (key === 'windowLayout') { cfg.windowLayout = value === 'vertical' ? 'vertical' : 'wide'; saveConfig(); sendLauncherState(); return; }
  if (key === 'muffinsSite') { cfg.muffinsSite = value === 'v2' ? 'v2' : 'classic'; saveConfig(); sendLauncherState(); return; }
  if (['hideChat', 'blurTimes', 'showRace', 'fitTimer', 'alwaysOnTop', 'showLauncher', 'customLayout'].includes(key)) setOption(key, !!value);
});
on('load-race', (_e, u) => loadRace(u));
on('race-nav', (_e, what) => {
  const wc = views.race?.webContents;
  if (!wc) return;
  if (what === 'back' && wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack();
  if (what === 'reload') wc.reload();
  if (what === 'list') loadRace('https://racetime.gg/alttpr');
});
on('open-launcher', openLauncher);
on('update-muffins', () => openSiteLauncher('muffins'));

handle('launcher-state', () => launcherState());
on('open-site-launcher', (_e, kind) => openSiteLauncher(kind));
on('set-url', (_e, kind, value) => {
  if (!['tracker', 'timer', 'race'].includes(kind)) return;
  const v = String(value || '').trim() || DEFAULT_URLS[kind];
  cfg.urls[kind] = kind === 'race' ? normalizeRaceUrl(v) || cfg.urls.race : v;
  saveConfig();
  applyLive(kind);
  sendLauncherState();
});
function launchMain() {
  writeConfig();
  const l = launcher;
  launcherBounds = null;
  createMain();
  if (l && !l.isDestroyed()) { launcher = null; l.close(); }
}
on('launch', launchMain);

// Layout editor: shown in the launcher's window, enlarged while it is open.
let launcherBounds = null;
on('open-layout-editor', () => {
  if (!launcher || launcher.isDestroyed()) return;
  const { screen } = require('electron');
  launcherBounds = launcherBounds || launcher.getBounds();
  launcher.loadFile(path.join(__dirname, 'ui/layout-editor.html'));
  const b = launcherBounds, area = screen.getDisplayMatching(b).workArea;
  launcher.setContentSize(Math.min(1180, area.width - 40), Math.min(820, area.height - 80));
  const nb = launcher.getBounds();
  const x = Math.max(area.x, Math.min(Math.round(b.x + b.width / 2 - nb.width / 2), area.x + area.width - nb.width));
  const y = Math.max(area.y, Math.min(Math.round(b.y + b.height / 2 - nb.height / 2), area.y + area.height - nb.height));
  launcher.setPosition(x, y);
});
handle('layout-editor-state', () => {
  const ctx = customCtx(null);
  const cached = validExt(cfg.z3rExtents[ctx.windowLayout]);
  const note = !ctx.entrance ? ''
    : cached ? 'Entrance tracker size and the GGW map setting are taken from your last session.'
      : 'No entrance tracker session has run yet: its box uses a default size and the muffins maps are shown. Both follow your GGW settings from the next launch on.';
  return { ...Arrange.resolve(ctx, cfg.customLayouts[Arrange.comboKey(ctx)]), windowLayout: ctx.windowLayout, gap: Arrange.GAP, note };
});
on('layout-editor-confirm', (_e, p) => {
  const ctx = customCtx(null), key = Arrange.comboKey(ctx), els = Arrange.elements(ctx);
  if (!p || typeof p !== 'object' || p.key !== key || !p.boxes || typeof p.boxes !== 'object') return;
  const boxes = {};
  for (const e of els) {
    const r = p.boxes[e.id];
    if (!r || typeof r !== 'object') return;
    boxes[e.id] = { x: r.x, y: r.y, w: r.w, h: r.h };
  }
  if (!Arrange.valid(boxes, els)) return;
  cfg.customLayouts[key] = { boxes };
  launchMain();
});
on('layout-editor-cancel', () => {
  if (!launcher || launcher.isDestroyed()) return;
  launcher.loadFile(path.join(__dirname, 'ui/launcher.html'));
  if (launcherBounds) launcher.setBounds(launcherBounds);
  launcherBounds = null;
});

// xkeys setups, called from the z3rTracker pane.
on('z3r-extent', (_e, ext) => {
  if (!(ext && ext.w > 0 && ext.h > 0)) return;
  z3rExtent = { w: ext.w, h: ext.h };
  z3rMaps = [0, 1, 2].includes(ext.maps) ? ext.maps : 0;
  const scr = ext.screen === 'settings' || ext.screen === 'dialog' ? ext.screen : 'panels';
  if (scr === 'panels') {
    // cached for the next launch's custom arrangement
    const key = mode === 'vertical' ? 'vertical' : 'wide';
    if (key === 'wide' || custom || (geo?.kind === 'vertical' && Math.abs(geo.rightW / geo.z3rZoom - Z3R_FLOW_W) < 1)) {
      const v = { w: Math.round(ext.w), h: Math.round(ext.h), maps: z3rMaps }, c = cfg.z3rExtents[key];
      if (!c || c.w !== v.w || c.h !== v.h || c.maps !== v.maps) { cfg.z3rExtents[key] = v; saveConfig(); }
    }
  }
  if (custom) {
    custom.screen = scr;
    if (scr === 'panels') { custom.panels = { w: ext.w, h: ext.h }; custom.liveMaps = z3rMaps; }
  }
  layout();
});
handle('setups-list', () => listSetups());
handle('setups-get', (_e, id) => readSetups().find((s) => s.id === id)?.doc || null);
handle('setups-save', (_e, { id, name, doc, use = true }) => {
  if (!doc || typeof doc !== 'object') return null;
  const list = readSetups();
  const now = Date.now();
  let s = id ? list.find((x) => x.id === id) : null;
  if (s) {
    s.doc = doc;
    s.savedAt = now;
    if (name) s.name = String(name).slice(0, 60);
  } else {
    s = { id: 's' + now.toString(36), name: String(name || `Setup ${list.length + 1}`).slice(0, 60), savedAt: now, doc };
    list.push(s);
  }
  if (use) s.usedAt = now;
  writeSetups(list);
  sendLauncherState();
  return setupSummary(s);
});
handle('setups-use', (_e, id) => {
  const list = readSetups();
  const s = list.find((x) => x.id === id);
  if (!s) return null;
  s.usedAt = Date.now();
  writeSetups(list);
  sendLauncherState();
  return s.doc;
});
handle('setups-remove', (_e, id) => {
  writeSetups(readSetups().filter((x) => x.id !== id));
  sendLauncherState();
  return listSetups();
});

// ---------- test hooks ----------

async function debugShots(dir) {
  fs.mkdirSync(dir, { recursive: true });
  await new Promise((r) => setTimeout(r, +(process.env.SHOT_DELAY || 9000)));
  if (process.env.SHOT_JS) {
    for (const [n, js] of Object.entries(JSON.parse(process.env.SHOT_JS))) {
      fs.writeFileSync(path.join(dir, n + '.json'), JSON.stringify(await views[n].webContents.executeJavaScript(js, true).catch((e) => String(e)), null, 1));
    }
    await new Promise((r) => setTimeout(r, +(process.env.SHOT_AFTER_JS || 0)));
  }
  for (const n of ['tracker', 'timer', 'race', 'controls', 'z3r']) {
    if (!views[n].getVisible()) continue;
    const img = await Promise.race([views[n].webContents.capturePage().catch(() => null), new Promise((r) => setTimeout(() => r(null), 3000))]);
    if (img) fs.writeFileSync(path.join(dir, n + '.png'), img.toPNG());
  }
  const bounds = Object.fromEntries(Object.entries(views).filter(([, v]) => v.getVisible()).map(([k, v]) => [k, v.getBounds()]));
  const { width: W, height: H } = win.getContentBounds();
  const zoom = Object.fromEntries(['tracker', 'timer', 'race', 'controls', 'z3r'].filter((n) => views[n].getVisible()).map((n) => [n, views[n].webContents.getZoomFactor()]));
  const order = win.contentView.children.map((c) => Object.keys(views).find((k) => views[k] === c));
  const cs = custom && { key: custom.key, saved: custom.saved, screen: custom.screen, liveMaps: custom.liveMaps, panels: custom.panels, ext: custom.ext };
  fs.writeFileSync(path.join(dir, 'geo.json'), JSON.stringify({ geo: { ...geo, W, H }, mode, bounds, zoom, order, custom: cs, content: { W, H }, window: win.getBounds() }, null, 1));
  if (process.env.SHOT_QUIT) app.quit();
}

async function launcherShot(dir) {
  fs.mkdirSync(dir, { recursive: true });
  await new Promise((r) => setTimeout(r, 1500));
  if (process.env.SHOT_LAUNCHER_JS) {
    const out = await launcher.webContents.executeJavaScript(process.env.SHOT_LAUNCHER_JS, true).catch((e) => String(e));
    fs.writeFileSync(path.join(dir, 'launcher.json'), JSON.stringify(out ?? null, null, 1));
  }
  if (process.env.SHOT_LAUNCHER_STEPS) {
    const res = [];
    for (const js of JSON.parse(process.env.SHOT_LAUNCHER_STEPS)) {
      await new Promise((r) => setTimeout(r, +(process.env.SHOT_AFTER_JS || 1500)));
      if (!launcher || launcher.isDestroyed()) break;
      res.push(await launcher.webContents.executeJavaScript(js, true).then((v) => v ?? null, (e) => String(e)));
      fs.writeFileSync(path.join(dir, 'launcher-steps.json'), JSON.stringify(res, null, 1));
    }
  }
  if (!launcher || launcher.isDestroyed()) return;
  if (process.env.SHOT_SITE) {
    const before = { ...cfg.urls };
    for (const kind of process.env.SHOT_SITE.split(',')) {
      openSiteLauncher(kind);
      await new Promise((r) => setTimeout(r, 6000));
      const js = process.env.SHOT_SITE_JS || (kind === 'muffins' ? 'launch_tracker()' : "document.querySelector('button[type=submit]').click()");
      await siteWins[kind].webContents.executeJavaScript(js, true).catch((e) => console.log('site js error', e));
      await new Promise((r) => setTimeout(r, 1500));
    }
    fs.writeFileSync(path.join(dir, 'capture.json'), JSON.stringify({ before, after: cfg.urls }, null, 1));
  }
  await new Promise((r) => setTimeout(r, +(process.env.SHOT_DELAY || 1500)));
  const img = await launcher.webContents.capturePage().catch(() => null);
  if (img) fs.writeFileSync(path.join(dir, 'launcher.png'), img.toPNG());
  if (process.env.SHOT_QUIT) app.quit();
}

// ---------- startup ----------

app.setName('ALttP Tracker');
if (isTest) app.setPath('userData', path.join(process.env.SHOT_DIR, '..', process.env.SHOT_PROFILE || 'profile-' + path.basename(process.env.SHOT_DIR)));

// No camera, mic, location, notifications etc. for any page; no <webview>; no non-web navigation.
// Trackers may reach localhost/LAN for SNI, QUsb2Snes and emulator bridges; the race room may not.
const ALLOWED_PERMISSIONS = new Set(['clipboard-sanitized-write', 'fullscreen']);
const LOCAL_NETWORK = new Set(['local-network-access', 'local-network', 'loopback-network']);
const permitted = (permission, origin) =>
  ALLOWED_PERMISSIONS.has(permission) || (LOCAL_NETWORK.has(permission) && hostOf(origin) !== 'racetime.gg');
function lockDownSession(ses) {
  ses.setPermissionRequestHandler((_wc, permission, cb, details) => cb(permitted(permission, details?.requestingUrl)));
  ses.setPermissionCheckHandler((_wc, permission, origin) => permitted(permission, origin));
}
app.on('session-created', lockDownSession);
app.on('web-contents-created', (_e, wc) => {
  wc.on('will-attach-webview', (e) => e.preventDefault());
  wc.on('will-navigate', (e, url) => {
    if (!/^(https?|file):/.test(url)) e.preventDefault();
    // App pages never navigate away from the app.
    if (wc.getURL().startsWith(APP_URL) && !url.startsWith(APP_URL)) e.preventDefault();
  });
});

app.whenReady().then(() => {
  lockDownSession(session.defaultSession);
  loadConfig();
  if (process.env.SHOT_CFG) Object.assign(cfg, JSON.parse(process.env.SHOT_CFG));
  if (process.env.SHOT_SIZE) { const [w, h] = process.env.SHOT_SIZE.split('x').map(Number); cfg.bounds = cfg.verticalBounds = { width: w, height: h }; }
  if (process.env.SHOT_LAUNCHER) { openLauncher(); launcherShot(process.env.SHOT_DIR); return; }
  if (isTest || !cfg.showLauncher) createMain();
  else openLauncher();
  buildMenu();
});
app.on('before-quit', () => { clearTimeout(saveTimer); if (cfg) writeConfig(); });
app.on('window-all-closed', () => app.quit());
