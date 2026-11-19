// Box arrangements for the custom layout, shared by the main process and the layout editor page.
// Boxes are { x, y, w, h } in natural px (window at 100%), keyed by element id.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Arrange = factory();
})(typeof self !== 'undefined' ? self : this, () => {
  const GAP = 4;
  const BAR = 30;
  const GGW_MAP = 603;
  const Z3R_FLOW_W = 520;
  const ITEMS = { w: 448, h: 448 };
  const MAPS = { classic: { w: 884, h: 448 }, v2: { w: 896, h: 448 }, ggw1: { w: 448, h: 448 }, ggw2: { w: 896, h: 448 } };
  const MIN = { stonks: { w: 240, h: 230 }, race: { w: 340, h: 440 } };
  const Z3R_DEFAULT = { wide: { w: 1370, h: 106 }, vertical: { w: 520, h: 326 } };
  const STD = { row3H: 340, raceFrac: 0.6, colW: 420, stonksFrac: 0.25, vStonksFrac: 0.3 };

  // True when two boxes overlap or sit closer than the gap.
  const collides = (a, b, gap = GAP) =>
    a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;

  function conflicts(boxes) {
    const ids = Object.keys(boxes), out = [];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) if (collides(boxes[ids[i]], boxes[ids[j]])) out.push([ids[i], ids[j]]);
    }
    return out;
  }

  function bbox(boxes) {
    const b = Object.values(boxes);
    if (!b.length) return { x: 0, y: 0, w: 0, h: 0 };
    const x = Math.min(...b.map((r) => r.x)), y = Math.min(...b.map((r) => r.y));
    return { x, y, w: Math.max(...b.map((r) => r.x + r.w)) - x, h: Math.max(...b.map((r) => r.y + r.h)) - y };
  }

  function normalise(boxes) {
    const { x, y } = bbox(boxes);
    return Object.fromEntries(Object.entries(boxes).map(([id, r]) => [id, { x: r.x - x, y: r.y - y, w: r.w, h: r.h }]));
  }

  const frame = (boxes) => { const { w, h } = bbox(boxes); return { w, h }; };

  function drop(boxes) {
    const out = normalise(boxes);
    return { boxes: out, frame: frame(out) };
  }

  const others = (boxes, id) => Object.keys(boxes).filter((k) => k !== id).map((k) => boxes[k]);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const round2 = (v) => Math.round(v * 100) / 100;
  const isInt = (v) => typeof v === 'number' && Number.isInteger(v);
  const vertical = (ctx) => ctx.windowLayout === 'vertical';

  // 'none' | 'muffins' | 'ggw': what fills the Maps box.
  function mapsSource(ctx) {
    if (vertical(ctx)) return 'none';
    if (ctx.entrance && ctx.ggwMaps > 0) return 'ggw';
    return ctx.muffins === 'split' ? 'muffins' : 'none';
  }

  const muffinsMode = (ctx) => (vertical(ctx) ? 'block' : ctx.muffins);
  const pos = (v) => (typeof v === 'number' && Number.isFinite(v) && Math.round(v) > 0 ? Math.round(v) : 0);
  const muffinsSize = (ctx) => {
    const w = pos(ctx.muffinsSize?.w), h = pos(ctx.muffinsSize?.h);
    return w && h ? { w, h } : { w: ITEMS.w, h: ITEMS.h };
  };

  function entranceSize(ctx) {
    const d = Z3R_DEFAULT[vertical(ctx) ? 'vertical' : 'wide'];
    const e = ctx.z3rExtent || d;
    const h = pos(e.h) || d.h;
    return vertical(ctx) ? { w: Z3R_FLOW_W, h } : { w: pos(e.w) || d.w, h };
  }

  function mapsSize(ctx) {
    const src = mapsSource(ctx);
    if (src === 'ggw') return ctx.ggwMaps === 1 ? MAPS.ggw1 : MAPS.ggw2;
    return ctx.v2 ? MAPS.v2 : MAPS.classic;
  }

  function comboKey(ctx) {
    const mode = muffinsMode(ctx), src = mapsSource(ctx);
    const m = mode === 'block' ? 'block' + muffinsSize(ctx).w + 'x' + muffinsSize(ctx).h : mode;
    const maps = src === 'ggw' ? 'ggw' + ctx.ggwMaps : src;
    return `${vertical(ctx) ? 'vertical' : 'wide'}|${m}|${maps}|${ctx.entrance ? 'e1' : 'e0'}`;
  }

  function elements(ctx) {
    const out = [], mode = muffinsMode(ctx), src = mapsSource(ctx);
    const fixed = (id, label, sub, w, h) => out.push({ id, label, sub, w, h, fixed: true, minW: w, minH: h });
    if (mode === 'block') {
      const z = muffinsSize(ctx);
      fixed('muffins', 'Muffins (' + ['items', ...(ctx.muffinsParts || [])].join(', ') + ')', '', z.w, z.h);
    } else fixed('items', 'Item tracker', '', ITEMS.w, ITEMS.h);
    if (src !== 'none') {
      const z = mapsSize(ctx);
      const sub = src === 'muffins' ? 'Muffins maps, side by side' : ctx.ggwMaps === 1 ? 'GGW single map with its light/dark toggle' : 'GGW maps, side by side';
      fixed('maps', 'Maps (light + dark)', sub, z.w, z.h);
    }
    if (ctx.entrance) {
      const z = entranceSize(ctx);
      fixed('entrance', 'Entrance tracker (GGW)', 'Scaled to fit this box', z.w, z.h);
    }
    const rs = (id, label, sub, m) => out.push({ id, label, sub, w: m.w, h: m.h, fixed: false, minW: m.w, minH: m.h });
    rs('stonks', 'Stonks', '', MIN.stonks);
    rs('race', 'Racetime', ctx.showRace === false ? 'Control bar only (race room hidden)' : 'Control bar and race room', MIN.race);
    return out;
  }

  function standard(ctx) {
    const el = Object.fromEntries(elements(ctx).map((e) => [e.id, e]));
    const ext = el.entrance, mode = muffinsMode(ctx), maps = el.maps;
    const b = {};
    const put = (id, x, y, w, h) => { b[id] = { x, y, w, h }; };
    const minRow = MIN.stonks.h + GAP + MIN.race.h;
    if (vertical(ctx)) {
      const mu = el.muffins, colX = mu.w + GAP, colW = ext ? Math.max(ext.w, STD.colW) : STD.colW;
      put('muffins', 0, 0, mu.w, mu.h);
      let y = 0;
      if (ext) { put('entrance', colX, 0, ext.w, ext.h); y = ext.h + GAP; }
      const rem = Math.max(mu.h - y, minRow);
      const sh = clamp(Math.round((rem - GAP) * STD.vStonksFrac), MIN.stonks.h, rem - GAP - MIN.race.h);
      put('stonks', colX, y, colW, sh);
      put('race', colX, y + sh + GAP, colW, rem - GAP - sh);
    } else if (mode === 'block') {
      const mu = el.muffins, colX = mu.w + GAP, colH = Math.max(mu.h, minRow);
      put('muffins', 0, 0, mu.w, mu.h);
      const sh = clamp(Math.round((colH - GAP) * STD.stonksFrac), MIN.stonks.h, colH - GAP - MIN.race.h);
      put('stonks', colX, 0, STD.colW, sh);
      put('race', colX, sh + GAP, STD.colW, colH - GAP - sh);
      let y = colH + GAP;
      if (maps) { put('maps', 0, y, maps.w, maps.h); y += maps.h + GAP; }
      if (ext) put('entrance', 0, y, ext.w, ext.h);
    } else {
      const it = el.items;
      put('items', 0, 0, it.w, it.h);
      let W = it.w;
      if (maps) { put('maps', it.w + GAP, 0, maps.w, maps.h); W = it.w + GAP + maps.w; }
      W = Math.max(W, ext ? ext.w : 0, MIN.stonks.w + GAP + MIN.race.w);
      let y = it.h + GAP;
      if (ext) { put('entrance', 0, y, ext.w, ext.h); y += ext.h + GAP; }
      let rw = Math.max(MIN.race.w, Math.round(W * STD.raceFrac)), sw = W - rw - GAP;
      if (sw < MIN.stonks.w) { sw = MIN.stonks.w; rw = W - sw - GAP; }
      const rh = Math.max(STD.row3H, MIN.stonks.h, MIN.race.h);
      put('stonks', 0, y, sw, rh);
      put('race', sw + GAP, y, rw, rh);
    }
    return normalise(b);
  }

  function valid(boxes, elements) {
    if (!boxes || typeof boxes !== 'object') return false;
    const ids = Object.keys(boxes);
    if (ids.length !== elements.length) return false;
    for (const e of elements) {
      const r = boxes[e.id];
      if (!r || !isInt(r.x) || !isInt(r.y) || !isInt(r.w) || !isInt(r.h) || r.w <= 0 || r.h <= 0) return false;
      if (e.fixed ? r.w !== e.w || r.h !== e.h : r.w < e.minW || r.h < e.minH) return false;
    }
    const bb = bbox(boxes);
    return bb.x === 0 && bb.y === 0 && !conflicts(boxes).length;
  }

  // Push colliding boxes right or down, whichever clears with the smaller move.
  function settle(boxes) {
    const b = Object.fromEntries(Object.entries(boxes).map(([id, r]) => [id, { ...r }]));
    const order = Object.keys(b).sort((p, q) => b[p].y - b[q].y || b[p].x - b[q].x);
    const placed = [];
    for (const id of order) {
      const r = b[id];
      for (let n = 0; ; n++) {
        if (n > 1000) return null;
        const o = placed.find((k) => collides(r, b[k]));
        if (!o) break;
        const q = b[o], dx = q.x + q.w + GAP - r.x, dy = q.y + q.h + GAP - r.y;
        if (dx <= dy) r.x += dx; else r.y += dy;
      }
      placed.push(id);
    }
    return normalise(b);
  }

  function reconcile(saved, elements) {
    try {
      if (saved && typeof saved === 'object' && saved.boxes && typeof saved.boxes === 'object') saved = saved.boxes;
      if (!saved || typeof saved !== 'object') return null;
      const num = (v) => typeof v === 'number' && Number.isFinite(v);
      let b = {};
      for (const e of elements) {
        const s = saved[e.id];
        if (!s || typeof s !== 'object' || !num(s.x) || !num(s.y) || s.x < 0 || s.y < 0) return null;
        let w = e.w, h = e.h;
        if (!e.fixed) {
          if (!num(s.w) || !num(s.h) || s.w <= 0 || s.h <= 0) return null;
          w = Math.max(e.minW, Math.round(s.w));
          h = Math.max(e.minH, Math.round(s.h));
        }
        b[e.id] = { x: Math.round(s.x), y: Math.round(s.y), w, h };
      }
      if (conflicts(b).length) b = settle(b);
      else b = normalise(b);
      return b && valid(b, elements) ? b : null;
    } catch (e) {
      return null;
    }
  }

  function resolve(ctx, saved) {
    const els = elements(ctx), std = standard(ctx), b = reconcile(saved, els);
    return { key: comboKey(ctx), elements: els, boxes: b || std, standard: std, saved: !!b };
  }

  // Nearest candidate { pos, guide } to p within the threshold, else null.
  function nearest(p, cands, snap) {
    let best = null, bd = Infinity;
    for (const c of cands) {
      const d = Math.abs(c.pos - p);
      if (d <= snap && d < bd) { best = c; bd = d; }
    }
    return best;
  }

  function move(boxes, id, x, y, opts = {}) {
    const cur = boxes[id], snap = opts.snap ?? 12, fr = opts.frame || frame(boxes), os = others(boxes, id);
    const px = Math.round(x), py = Math.round(y);
    const cx = [], cy = [];
    for (const o of os) {
      cx.push({ pos: o.x + o.w + GAP, guide: o.x + o.w }, { pos: o.x - GAP - cur.w, guide: o.x },
        { pos: o.x, guide: o.x }, { pos: o.x + o.w - cur.w, guide: o.x + o.w });
      cy.push({ pos: o.y + o.h + GAP, guide: o.y + o.h }, { pos: o.y - GAP - cur.h, guide: o.y },
        { pos: o.y, guide: o.y }, { pos: o.y + o.h - cur.h, guide: o.y + o.h });
    }
    cx.push({ pos: 0, guide: 0 }, { pos: fr.w - cur.w, guide: fr.w });
    cy.push({ pos: 0, guide: 0 }, { pos: fr.h - cur.h, guide: fr.h });
    const sx = nearest(px, cx, snap), sy = nearest(py, cy, snap);
    const hits = (X, Y) => os.filter((o) => collides({ x: X, y: Y, w: cur.w, h: cur.h }, o));
    const tries = [[sx, sy], [sx, null], [null, sy], [null, null]];
    for (const [a, b] of tries) {
      const X = a ? a.pos : px, Y = b ? b.pos : py;
      if (!hits(X, Y).length) return { x: X, y: Y, snapX: a ? a.guide : null, snapY: b ? b.guide : null };
    }
    // docked beside the boxes hit, else slid along one axis from the current position, else stay
    const cands = [];
    for (const o of hits(px, py)) {
      cands.push([o.x + o.w + GAP, py], [o.x - GAP - cur.w, py], [px, o.y + o.h + GAP], [px, o.y - GAP - cur.h]);
    }
    cands.push([px, cur.y], [cur.x, py], [cur.x, cur.y]);
    let best = null, bd = Infinity;
    for (const [X, Y] of cands) {
      const d = (X - px) ** 2 + (Y - py) ** 2;
      if (d < bd && !hits(X, Y).length) { best = [X, Y]; bd = d; }
    }
    return { x: best[0], y: best[1], snapX: null, snapY: null };
  }

  function resize(boxes, id, edge, x, y, opts = {}) {
    const cur = boxes[id], os = others(boxes, id), fr = opts.frame || frame(boxes);
    const minW = opts.minW || 1, minH = opts.minH || 1, snap = opts.snap ?? 12;
    const hasE = edge.includes('e'), hasS = edge.includes('s');
    const hit = (w, h) => os.some((o) => collides({ x: cur.x, y: cur.y, w, h }, o));
    const edgeSnap = (p, axis) => {
      const c = [{ pos: axis === 'x' ? fr.w : fr.h, guide: axis === 'x' ? fr.w : fr.h }];
      for (const o of os) {
        if (axis === 'x') c.push({ pos: o.x - GAP, guide: o.x }, { pos: o.x + o.w, guide: o.x + o.w });
        else c.push({ pos: o.y - GAP, guide: o.y }, { pos: o.y + o.h, guide: o.y + o.h });
      }
      return nearest(p, c, snap);
    };
    let w = cur.w, h = cur.h, gx = null, gy = null;
    let wantW = cur.w, wantH = cur.h;
    if (hasE) { gx = edgeSnap(Math.round(x), 'x'); wantW = Math.max(minW, (gx ? gx.pos : Math.round(x)) - cur.x); }
    if (hasS) { gy = edgeSnap(Math.round(y), 'y'); wantH = Math.max(minH, (gy ? gy.pos : Math.round(y)) - cur.y); }
    // growth stops GAP short of the first box in the way
    const limY = (ww) => {
      let m = Infinity;
      for (const o of os) {
        if (o.x < cur.x + ww + GAP && cur.x < o.x + o.w + GAP && o.y >= cur.y + cur.h) m = Math.min(m, o.y - GAP - cur.y);
      }
      return m;
    };
    const limX = (hh) => {
      let m = Infinity;
      for (const o of os) {
        if (o.y < cur.y + hh + GAP && cur.y < o.y + o.h + GAP && o.x >= cur.x + cur.w) m = Math.min(m, o.x - GAP - cur.x);
      }
      return m;
    };
    if (hasS) h = Math.max(minH, Math.min(wantH, Math.max(limY(cur.w), cur.h)));
    if (hasE) w = Math.max(minW, Math.min(wantW, Math.max(limX(h), cur.w)));
    if (hasS && hasE) h = Math.max(minH, Math.min(wantH, Math.max(limY(w), cur.h)));
    if (hit(w, h)) {
      if (!hit(w, cur.h)) h = cur.h;
      else if (!hit(cur.w, h)) w = cur.w;
      else { w = cur.w; h = cur.h; }
    }
    return { w, h, snapX: gx && cur.x + w === gx.pos ? gx.guide : null, snapY: gy && cur.y + h === gy.pos ? gy.guide : null };
  }

  const fitScale = (fr, area) => Math.min(1, area.width / fr.w, area.height / fr.h);

  function windowScale(fr, W, H) {
    const s = Math.min(W / fr.w, H / fr.h);
    return { s, ox: Math.max(0, Math.floor((W - Math.round(fr.w * s)) / 2)), oy: Math.max(0, Math.floor((H - Math.round(fr.h * s)) / 2)) };
  }

  function toView(box, t) {
    const x0 = Math.round(box.x * t.s), y0 = Math.round(box.y * t.s);
    return { x: t.ox + x0, y: t.oy + y0, width: Math.round((box.x + box.w) * t.s) - x0, height: Math.round((box.y + box.h) * t.s) - y0 };
  }

  function raceViews(box, t) {
    const R = toView(box, t), ch = Math.min(R.height, Math.round(BAR * t.s));
    return { controls: { x: R.x, y: R.y, width: R.width, height: ch }, race: { x: R.x, y: R.y + ch, width: R.width, height: R.height - ch } };
  }

  function trackerPlan(ctx, boxes, t, win) {
    const mode = muffinsMode(ctx), src = mapsSource(ctx);
    if (mode !== 'split') {
      const box = boxes.muffins || boxes.items, size = mode === 'block' ? muffinsSize(ctx) : ITEMS;
      const bounds = toView(box, t);
      return { bounds, css: 'fit', fit: Math.min(bounds.width / size.w, bounds.height / size.h), vars: {} };
    }
    const s = t.s, I = toView(boxes.items, t);
    if (src === 'ggw') {
      return { bounds: I, css: 'split', fit: s, vars: { '--it-scale': s, '--it-left': '0px', '--it-top': '0px', '--map-scale': s, '--map-left': (I.width + 64) + 'px', '--map-top': '0px' } };
    }
    const M = toView(boxes.maps, t), pad = ctx.v2 ? 0 : 8;
    return {
      bounds: { x: 0, y: 0, width: win.W, height: win.H }, css: 'split', fit: s,
      vars: { '--it-scale': s, '--it-left': I.x + 'px', '--it-top': I.y + 'px', '--map-scale': s, '--map-left': (M.x - pad * s) + 'px', '--map-top': M.y + 'px' },
    };
  }

  function z3rPlan(ctx, boxes, t, win, ext) {
    if (!ctx.entrance || !boxes.entrance) return null;
    const E = toView(boxes.entrance, t);
    if (!ext || !(ext.w > 0 && ext.h > 0) || !Number.isFinite(ext.w + ext.h)) ext = { w: boxes.entrance.w, h: boxes.entrance.h };
    if (vertical(ctx)) {
      const f = round2(clamp(Math.min(t.s, E.height / ext.h), 0.1, 3));
      return { bounds: E, zoom: f, back: false, vertical: true, ggw: 0, vars: { '--flow-w': Z3R_FLOW_W + 'px' } };
    }
    const f = round2(clamp(Math.min(E.width / ext.w, E.height / ext.h), 0.1, 3));
    if (mapsSource(ctx) !== 'ggw') return { bounds: E, zoom: f, back: false, vertical: false, ggw: 0, vars: {} };
    const n = ctx.ggwMaps, M = toView(boxes.maps, t);
    const side = Math.min(M.height, M.width / n), z = side / f / GGW_MAP;
    const px = (v) => v.toFixed(2) + 'px';
    return {
      bounds: { x: 0, y: 0, width: win.W, height: win.H }, zoom: f, back: true, vertical: false, ggw: n,
      vars: {
        '--band-left': px(E.x / f), '--band-top': px(E.y / f),
        '--band-right': px((win.W - E.x - E.width) / f), '--band-bottom': px((win.H - E.y - E.height) / f),
        '--gm-left-1': px(M.x / f / z), '--gm-left-2': px((M.x + side) / f / z), '--gm-top': px(M.y / f / z),
        '--gm-z': z.toFixed(4),
      },
    };
  }

  // The entrance tracker's settings screen and dialogs do not fit its box: shown from the box's corner, as large as the window allows.
  function z3rOverlay(E, ext, win) {
    const zoom = Math.floor(clamp(Math.min(1, win.W / ext.w, win.H / ext.h), 0.1, 1) * 100) / 100;
    const width = Math.min(win.W, Math.round(ext.w * zoom)), height = Math.min(win.H, Math.round(ext.h * zoom));
    return { bounds: { x: clamp(E.x, 0, win.W - width), y: clamp(E.y, 0, win.H - height), width, height }, zoom };
  }

  return {
    GAP, BAR, GGW_MAP, Z3R_FLOW_W, ITEMS, MAPS, MIN, Z3R_DEFAULT, STD,
    collides, conflicts, bbox, normalise, frame, drop, mapsSource, elements, comboKey, standard, valid, settle, reconcile, resolve,
    move, resize, fitScale, windowScale, toView, raceViews, trackerPlan, z3rPlan, z3rOverlay,
  };
});
