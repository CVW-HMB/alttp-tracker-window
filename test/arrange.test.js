const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../ui/arrange.js');

const base = { windowLayout: 'wide', v2: false, muffins: 'split', muffinsSize: { w: 0, h: 0 }, muffinsParts: [], entrance: false, ggwMaps: 0, z3rExtent: null, showRace: true };
const C = (o) => ({ ...base, ...o });
const R = (x, y, w, h) => ({ x, y, w, h });
const clone = (o) => JSON.parse(JSON.stringify(o));

const ref = {
  split: [C({}), { items: R(0, 0, 448, 448), maps: R(452, 0, 884, 448), stonks: R(0, 452, 530, 440), race: R(534, 452, 802, 440) }, { w: 1336, h: 892 }],
  entrance: [C({ entrance: true }), { items: R(0, 0, 448, 448), maps: R(452, 0, 884, 448), entrance: R(0, 452, 1370, 106), stonks: R(0, 562, 544, 440), race: R(548, 562, 822, 440) }, { w: 1370, h: 1002 }],
  ggw1: [C({ entrance: true, ggwMaps: 1 }), { items: R(0, 0, 448, 448), maps: R(452, 0, 448, 448), entrance: R(0, 452, 1370, 106), stonks: R(0, 562, 544, 440), race: R(548, 562, 822, 440) }, { w: 1370, h: 1002 }],
  block: [C({ muffins: 'block', muffinsSize: { w: 1340, h: 744 } }), { muffins: R(0, 0, 1340, 744), stonks: R(1344, 0, 420, 230), race: R(1344, 234, 420, 510) }, { w: 1764, h: 744 }],
  vertical: [C({ windowLayout: 'vertical', muffins: 'block', muffinsSize: { w: 448, h: 1330 }, entrance: true }), { muffins: R(0, 0, 448, 1330), entrance: R(452, 0, 520, 326), stonks: R(452, 330, 520, 299), race: R(452, 633, 520, 697) }, { w: 972, h: 1330 }],
};

test('reference arrangements', () => {
  for (const [name, [ctx, boxes, fr]] of Object.entries(ref)) {
    assert.deepEqual(A.standard(ctx), boxes, name);
    assert.deepEqual(A.frame(A.standard(ctx)), fr, name);
  }
});

test('standard valid across the ctx matrix', () => {
  const blocks = [[448, 692], [448, 744], [1340, 744], [448, 1330], [892, 1330]];
  const exts = [null, { w: 1370, h: 106 }, { w: 900, h: 240 }, { w: 520, h: 310 }];
  let n = 0;
  for (const windowLayout of ['wide', 'vertical']) for (const muffins of ['split', 'items', 'block']) for (const entrance of [false, true])
    for (const ggwMaps of [0, 1, 2]) for (const v2 of [false, true]) for (const [w, h] of blocks) for (const z3rExtent of exts) {
      const ctx = C({ windowLayout, muffins, entrance, ggwMaps, v2, muffinsSize: { w, h }, z3rExtent });
      const els = A.elements(ctx), b = A.standard(ctx);
      assert.ok(A.valid(b, els), JSON.stringify(ctx) + JSON.stringify(b));
      n++;
    }
  assert.ok(n > 1000);
});

test('comboKey', () => {
  assert.equal(A.comboKey(ref.entrance[0]), 'wide|split|muffins|e1');
  assert.equal(A.comboKey(ref.split[0]), 'wide|split|muffins|e0');
  assert.equal(A.comboKey(ref.ggw1[0]), 'wide|split|ggw1|e1');
  assert.equal(A.comboKey(C({ entrance: true, ggwMaps: 2 })), 'wide|split|ggw2|e1');
  assert.equal(A.comboKey(C({ muffins: 'items' })), 'wide|items|none|e0');
  assert.equal(A.comboKey(ref.block[0]), 'wide|block1340x744|none|e0');
  assert.equal(A.comboKey(C({ muffins: 'items', entrance: true, ggwMaps: 1 })), 'wide|items|ggw1|e1');
  assert.equal(A.comboKey(ref.vertical[0]), 'vertical|block448x1330|none|e1');
  const v = C({ windowLayout: 'vertical', muffins: 'split', entrance: true, ggwMaps: 2, muffinsSize: { w: 448, h: 1330 } });
  assert.equal(A.comboKey(v), 'vertical|block448x1330|none|e1');
  assert.ok(!A.elements(v).some((e) => e.id === 'maps'));
  assert.equal(A.mapsSource(v), 'none');
  assert.equal(A.mapsSource(ref.ggw1[0]), 'ggw');
  assert.equal(A.mapsSource(ref.split[0]), 'muffins');
  assert.equal(A.mapsSource(ref.block[0]), 'none');
});

test('elements labels and subs', () => {
  const E = (ctx) => Object.fromEntries(A.elements(ctx).map((e) => [e.id, e]));
  assert.deepEqual(A.elements(ref.entrance[0]).map((e) => e.id), ['items', 'maps', 'entrance', 'stonks', 'race']);
  assert.equal(E(C({})).maps.sub, 'Muffins maps, side by side');
  assert.equal(E(C({})).maps.label, 'Maps (light + dark)');
  assert.equal(E(C({})).maps.w, 884);
  assert.equal(E(C({ v2: true })).maps.w, 896);
  assert.equal(E(C({ entrance: true, ggwMaps: 2 })).maps.sub, 'GGW maps, side by side');
  assert.equal(E(C({ entrance: true, ggwMaps: 2 })).maps.w, 896);
  assert.equal(E(C({ entrance: true, ggwMaps: 1 })).maps.sub, 'GGW single map with its light/dark toggle');
  assert.equal(E(C({ entrance: true, ggwMaps: 1 })).maps.w, 448);
  const b = E(C({ muffins: 'block', muffinsSize: { w: 1340, h: 744 }, muffinsParts: ['maps', 'sphere tracker'] }));
  assert.equal(b.muffins.label, 'Muffins (items, maps, sphere tracker)');
  assert.ok(!b.items && !b.maps);
  assert.equal(E(C({ muffins: 'block', muffinsSize: { w: 448, h: 692 }, muffinsParts: ['stacked maps'] })).muffins.label, 'Muffins (items, stacked maps)');
  assert.equal(E(C({})).items.label, 'Item tracker');
  assert.equal(E(C({})).race.sub, 'Control bar and race room');
  assert.equal(E(C({ showRace: false })).race.sub, 'Control bar only (race room hidden)');
  assert.equal(E(C({ entrance: true })).entrance.label, 'Entrance tracker (GGW)');
  assert.equal(E(C({ entrance: true, z3rExtent: { w: 900.4, h: 239.6 } })).entrance.w, 900);
  assert.equal(E(C({ entrance: true, z3rExtent: { w: 900.4, h: 239.6 } })).entrance.h, 240);
  const v = E(ref.vertical[0]);
  assert.equal(v.entrance.w, 520);
  assert.equal(v.entrance.h, 326);
  assert.equal(E({ ...ref.vertical[0], z3rExtent: { w: 700, h: 200 } }).entrance.w, 520);
  assert.equal(E(C({})).stonks.fixed, false);
  assert.equal(E(C({})).stonks.minW, A.MIN.stonks.w);
  assert.equal(E(C({})).items.minW, 448);
});

test('collides at 3, 4, 5 px', () => {
  const a = R(0, 0, 10, 10);
  assert.equal(A.collides(a, R(13, 0, 10, 10)), true);
  assert.equal(A.collides(a, R(14, 0, 10, 10)), false);
  assert.equal(A.collides(a, R(15, 0, 10, 10)), false);
  assert.equal(A.collides(a, R(0, 13, 10, 10)), true);
  assert.equal(A.collides(a, R(0, 14, 10, 10)), false);
  assert.equal(A.collides(a, R(0, 15, 10, 10)), false);
  assert.equal(A.collides(a, R(5, 5, 10, 10)), true);
  assert.equal(A.collides(a, R(10, 0, 10, 10), 0), false);
});

test('normalise, drop, frame, bbox', () => {
  const b = { a: R(10, 20, 5, 5), b: R(30, 40, 10, 10) };
  assert.deepEqual(A.bbox(b), R(10, 20, 30, 30));
  assert.deepEqual(A.frame(b), { w: 30, h: 30 });
  assert.deepEqual(A.normalise(b), { a: R(0, 0, 5, 5), b: R(20, 20, 10, 10) });
  assert.deepEqual(A.drop(b), { boxes: A.normalise(b), frame: { w: 30, h: 30 } });
  assert.equal(b.a.x, 10);
  assert.deepEqual(A.conflicts({ a: R(0, 0, 5, 5), b: R(8, 0, 5, 5), c: R(20, 0, 5, 5) }), [['a', 'b']]);
  assert.deepEqual(A.bbox({}), R(0, 0, 0, 0));
});

test('valid', () => {
  const [ctx, boxes] = ref.entrance, els = A.elements(ctx);
  assert.equal(A.valid(boxes, els), true);
  const mut = (f) => { const b = clone(boxes); f(b); return A.valid(b, els); };
  assert.equal(mut((b) => { b.stonks.w = 570; }), false);
  assert.equal(mut((b) => { b.stonks.y = 559; b.race.y = 559; }), false);
  assert.equal(mut((b) => { b.stonks.y = 558; }), false);
  assert.equal(mut((b) => { b.items.w = 447; }), false);
  assert.equal(mut((b) => { b.stonks.w = A.MIN.stonks.w - 1; }), false);
  assert.equal(mut((b) => { b.race.h = A.MIN.race.h - 1; }), false);
  assert.equal(mut((b) => { delete b.race; }), false);
  assert.equal(mut((b) => { b.extra = R(5000, 0, 5, 5); }), false);
  assert.equal(mut((b) => { b.stonks.x = 0.5; }), false);
  assert.equal(mut((b) => { b.stonks.w = NaN; }), false);
  assert.equal(mut((b) => { for (const r of Object.values(b)) r.x += 10; }), false);
  assert.equal(mut((b) => { b.stonks.h = 500; b.race.h = 500; }), true);
  assert.equal(A.valid(null, els), false);
});

test('settle and reconcile', () => {
  const [ctx, boxes] = ref.entrance, els = A.elements(ctx);
  const s = A.settle({ a: R(0, 0, 100, 100), b: R(50, 10, 100, 100) });
  assert.deepEqual(A.conflicts(s), []);
  assert.deepEqual(A.bbox(s).x, 0);
  assert.equal(A.reconcile(null, els), null);
  assert.equal(A.reconcile(undefined, els), null);
  assert.equal(A.reconcile('x', els), null);
  assert.equal(A.reconcile(5, els), null);
  assert.equal(A.reconcile([], els), null);
  assert.equal(A.reconcile({ items: null }, els), null);
  const junk = clone(boxes); junk.items.x = 'a';
  assert.equal(A.reconcile(junk, els), null);
  const nan = clone(boxes); nan.race.w = NaN;
  assert.equal(A.reconcile(nan, els), null);
  const neg = clone(boxes); neg.race.x = -5;
  assert.equal(A.reconcile(neg, els), null);
  const miss = clone(boxes); delete miss.race;
  assert.equal(A.reconcile(miss, els), null);
  assert.deepEqual(A.reconcile(boxes, els), boxes);
  assert.deepEqual(A.reconcile({ boxes }, els), boxes);
  const extra = clone(boxes); extra.zzz = R(1, 1, 1, 1);
  assert.deepEqual(A.reconcile(extra, els), boxes);
  const small = clone(boxes); small.stonks.w = 50; small.stonks.h = 20;
  const r = A.reconcile(small, els);
  assert.ok(r && A.valid(r, els));
  assert.ok(r.stonks.w >= A.MIN.stonks.w && r.stonks.h >= A.MIN.stonks.h);
  // fixed size changed: saved for 884-wide maps, now 896
  const v2 = A.elements(C({ v2: true, entrance: true }));
  const r2 = A.reconcile(boxes, v2);
  assert.ok(r2 && A.valid(r2, v2));
  assert.equal(r2.maps.w, 896);
  // fixed size changed so that it overlaps
  const wide = A.elements(C({ entrance: true, ggwMaps: 2 }));
  const sv = clone(boxes); sv.items.w = 100; sv.maps.x = 104;
  const r3 = A.reconcile(sv, wide);
  assert.ok(r3 && A.valid(r3, wide));
  const rs = A.resolve(ctx, boxes);
  assert.equal(rs.saved, true);
  assert.equal(rs.key, 'wide|split|muffins|e1');
  const rn = A.resolve(ctx, null);
  assert.equal(rn.saved, false);
  assert.deepEqual(rn.boxes, rn.standard);
  assert.equal(rn.elements.length, 5);
});

const refBoxes = () => clone(ref.entrance[1]);

const T = () => ({ a: R(0, 100, 100, 100), b: R(300, 300, 100, 50) });
const TF = { w: 400, h: 350 };
const place = (t, id, m) => ({ ...t, [id]: { ...t[id], x: m.x, y: m.y } });

test('move docks at 4 px on all four sides', () => {
  const t = T();
  let m = A.move(t, 'b', 106, 300, { frame: TF });
  assert.deepEqual([m.x, m.snapX], [104, 100]);
  m = A.move(t, 'b', -108, 260, { frame: TF });
  assert.deepEqual([m.x, m.snapX], [-104, 0]);
  m = A.move(t, 'b', 40, 206, { frame: TF });
  assert.deepEqual([m.y, m.snapY], [204, 200]);
  m = A.move(t, 'b', 40, 44, { frame: TF });
  assert.deepEqual([m.y, m.snapY], [46, 100]);
  for (const [X, Y] of [[106, 300], [-108, 260], [40, 206], [40, 44]]) {
    const r = A.move(t, 'b', X, Y, { frame: TF });
    assert.ok(!A.collides({ x: r.x, y: r.y, w: 100, h: 50 }, t.a));
  }
});

test('move aligns edges and snaps to the frame', () => {
  const t = T();
  let m = A.move(t, 'b', 205, 325, { frame: TF });
  assert.deepEqual([m.x, m.y], [205, 325]);
  assert.equal(m.snapX, null);
  m = A.move(t, 'b', 4, 295, { frame: TF });
  assert.deepEqual([m.x, m.snapX], [0, 0]);
  m = A.move(t, 'b', 295, 303, { frame: TF });
  assert.deepEqual([m.x, m.snapX, m.y, m.snapY], [300, 400, 300, 350]);
  m = A.move(t, 'b', 250, 303, { frame: TF });
  assert.deepEqual([m.x, m.snapX], [250, null]);
  m = A.move(t, 'b', 250, 303, { frame: TF, snap: 60 });
  assert.equal(m.snapX, 400);
  m = A.move(t, 'b', 95, 99, { frame: TF });
  assert.ok(!A.collides({ x: m.x, y: m.y, w: 100, h: 50 }, t.a));
  m = A.move(t, 'b', 150, 305, { frame: TF, snap: 0 });
  assert.deepEqual([m.x, m.y, m.snapX, m.snapY], [150, 305, null, null]);
});

test('move escape, outside frame, negative', () => {
  const t = T();
  const m = A.move(t, 'b', 40, 140, { frame: TF, snap: 0 });
  assert.ok(!A.collides({ x: m.x, y: m.y, w: 100, h: 50 }, t.a));
  // nearest escape: dock below a (y 204) is 64 away, above (y 46) is 94 away, right (x 104) 64, left (-104) 144
  assert.ok((m.x === 40 && m.y === 204) || (m.x === 104 && m.y === 140));
  const o = A.move(t, 'b', 1000, -500, { frame: TF });
  assert.deepEqual([o.x, o.y], [1000, -500]);
  const n = A.move(t, 'b', -300.4, -20.6, { frame: TF });
  assert.deepEqual([n.x, n.y], [-300, -21]);
  // boxed in: no valid escape returns current
  const w = { a: R(0, 0, 100, 100), b: R(104, 0, 100, 100) };
  const k = A.move(w, 'b', 10, 10, { frame: { w: 204, h: 100 }, snap: 0 });
  assert.ok(!A.collides({ x: k.x, y: k.y, w: 100, h: 100 }, w.a));
});

test('resize minimum, stop, snaps, se', () => {
  const t = { a: R(0, 0, 100, 100), b: R(300, 0, 100, 100), c: R(0, 300, 100, 100) };
  const f = { w: 400, h: 400 };
  let r = A.resize(t, 'a', 'e', 50, 0, { minW: 60, minH: 60, frame: f });
  assert.equal(r.w, 60);
  r = A.resize(t, 'a', 'e', 1000, 0, { frame: f, snap: 0 });
  assert.equal(r.w, 296);
  r = A.resize(t, 'a', 's', 0, 1000, { frame: f, snap: 0 });
  assert.equal(r.h, 296);
  r = A.resize(t, 'a', 'e', 290, 0, { frame: f });
  assert.deepEqual([r.w, r.snapX], [296, 300]);
  r = A.resize(t, 'a', 's', 0, 294, { frame: f });
  assert.deepEqual([r.h, r.snapY], [296, 300]);
  r = A.resize(t, 'a', 'e', 205, 0, { frame: f });
  assert.equal(r.w, 205);
  assert.equal(r.snapX, null);
  r = A.resize(t, 'a', 'e', 402, 0, { frame: { w: 400, h: 400 }, snap: 12 });
  assert.equal(r.w, 296);
  const u = { a: R(0, 0, 100, 100), b: R(104, 0, 100, 100) };
  r = A.resize(u, 'b', 'e', 210, 0, { frame: { w: 204, h: 100 } });
  assert.equal(r.snapX, 204);
  assert.equal(r.w, 100);
  r = A.resize(t, 'a', 'se', 1000, 1000, { frame: f, snap: 0 });
  assert.ok(!A.conflicts({ ...t, a: R(0, 0, r.w, r.h) }).length);
  assert.ok(r.w >= 100 && r.h >= 100);
  const d = { a: R(0, 0, 100, 100), b: R(200, 200, 100, 100) };
  r = A.resize(d, 'a', 'se', 1000, 1000, { frame: { w: 300, h: 300 }, snap: 0 });
  assert.ok(!A.conflicts({ ...d, a: R(0, 0, r.w, r.h) }).length);
});

test('move and resize property', () => {
  let seed = 12345;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const ctxs = [ref.split[0], ref.entrance[0], ref.block[0], ref.vertical[0], C({ entrance: true, ggwMaps: 2 })];
  for (const ctx of ctxs) {
    let b = A.standard(ctx);
    const els = A.elements(ctx), ids = Object.keys(b);
    for (let i = 0; i < 1000; i++) {
      const id = ids[Math.floor(rnd() * ids.length)], fr = A.frame(b);
      if (rnd() < 0.5) {
        const before = A.conflicts(b).length;
        const m = A.move(b, id, rnd() * (fr.w + 400) - 200, rnd() * (fr.h + 400) - 200, { frame: fr, snap: Math.floor(rnd() * 30) });
        assert.ok(Number.isInteger(m.x) && Number.isInteger(m.y));
        const nb = { ...b, [id]: { ...b[id], x: m.x, y: m.y } };
        assert.equal(A.conflicts(nb).filter((c) => c.includes(id)).length, 0);
        b = A.drop(nb).boxes;
        assert.equal(A.conflicts(b).length, before);
      } else {
        const el = els.find((e) => e.id === id);
        if (el.fixed) continue;
        const edge = ['e', 's', 'se'][Math.floor(rnd() * 3)], cur = b[id];
        const r = A.resize(b, id, edge, cur.x + rnd() * 900, cur.y + rnd() * 900, { frame: fr, minW: el.minW, minH: el.minH, snap: 12 });
        assert.ok(Number.isInteger(r.w) && Number.isInteger(r.h));
        assert.ok(r.w >= el.minW && r.h >= el.minH);
        const nb = { ...b, [id]: { ...cur, w: r.w, h: r.h } };
        assert.equal(A.conflicts(nb).length, 0);
        b = A.drop(nb).boxes;
      }
      assert.ok(A.valid(b, els));
    }
  }
});

test('toView gap preservation and alignment', () => {
  for (let s = 0.3; s <= 1.5; s += 0.01) {
    const t = { s, ox: 7, oy: 3 };
    for (const x of [0, 1, 447, 448, 451, 733]) {
      const a = A.toView(R(x, 10, 100, 40), t), b = A.toView(R(x + 104, 10, 100, 40), t);
      assert.ok(b.x - (a.x + a.width) >= 1, `s=${s} x=${x}`);
      const c = A.toView(R(x, 54, 100, 40), t);
      assert.ok(c.y - (a.y + a.height) >= 1);
    }
    const p = A.toView(R(0, 0, 448, 448), t), q = A.toView(R(0, 452, 530, 340), t);
    assert.equal(p.x, q.x);
    const e1 = A.toView(R(0, 0, 884, 448), t), e2 = A.toView(R(100, 452, 784, 340), t);
    assert.equal(e1.x + e1.width, e2.x + e2.width);
  }
  assert.deepEqual(A.toView(R(10, 20, 30, 40), { s: 1, ox: 5, oy: 6 }), { x: 15, y: 26, width: 30, height: 40 });
});

test('fitScale, windowScale', () => {
  assert.equal(A.fitScale({ w: 1000, h: 500 }, { width: 2000, height: 2000 }), 1);
  assert.equal(A.fitScale({ w: 1000, h: 500 }, { width: 500, height: 2000 }), 0.5);
  assert.equal(A.fitScale({ w: 1000, h: 500 }, { width: 2000, height: 250 }), 0.5);
  const t = A.windowScale({ w: 1000, h: 500 }, 1200, 500);
  assert.deepEqual(t, { s: 1, ox: 100, oy: 0 });
  const u = A.windowScale({ w: 1000, h: 500 }, 2000, 1500);
  assert.equal(u.s, 2);
  assert.deepEqual([u.ox, u.oy], [0, 250]);
  assert.equal(A.windowScale({ w: 1001, h: 500 }, 1004, 500).ox, 1);
});

test('raceViews', () => {
  const t = { s: 0.7, ox: 3, oy: 4 }, box = R(10, 20, 300, 330);
  const R0 = A.toView(box, t), v = A.raceViews(box, t);
  assert.equal(v.controls.height, Math.round(30 * 0.7));
  assert.equal(v.controls.y, R0.y);
  assert.equal(v.race.y, R0.y + v.controls.height);
  assert.equal(v.controls.height + v.race.height, R0.height);
  assert.equal(v.controls.width, R0.width);
  assert.equal(v.race.x, R0.x);
  const tiny = A.raceViews(R(0, 0, 100, 10), { s: 1, ox: 0, oy: 0 });
  assert.equal(tiny.controls.height, 10);
  assert.equal(tiny.race.height, 0);
});

test('trackerPlan', () => {
  const win = { W: 1400, H: 950 };
  let ctx = ref.entrance[0], b = ref.entrance[1], t = { s: 0.5, ox: 10, oy: 20 };
  let p = A.trackerPlan(ctx, b, t, win);
  assert.equal(p.css, 'split');
  assert.deepEqual(p.bounds, { x: 0, y: 0, width: 1400, height: 950 });
  assert.equal(p.vars['--it-scale'], 0.5);
  assert.equal(p.vars['--it-left'], '10px');
  assert.equal(p.vars['--it-top'], '20px');
  assert.equal(p.vars['--map-scale'], 0.5);
  assert.equal(p.vars['--map-left'], (10 + 226 - 4) + 'px');
  assert.equal(p.vars['--map-top'], '20px');
  ctx = { ...ctx, v2: true };
  p = A.trackerPlan(ctx, b, t, win);
  assert.equal(p.vars['--map-left'], '236px');
  ctx = ref.ggw1[0]; b = ref.ggw1[1];
  p = A.trackerPlan(ctx, b, t, win);
  assert.deepEqual(p.bounds, A.toView(b.items, t));
  assert.equal(p.css, 'split');
  assert.equal(p.vars['--it-left'], '0px');
  assert.equal(p.vars['--map-left'], (224 + 64) + 'px');
  assert.equal(p.vars['--map-top'], '0px');
  ctx = ref.block[0]; b = ref.block[1];
  p = A.trackerPlan(ctx, b, { s: 0.5, ox: 0, oy: 0 }, win);
  assert.equal(p.css, 'fit');
  assert.equal(p.fit, 0.5);
  assert.deepEqual(p.bounds, { x: 0, y: 0, width: 670, height: 372 });
  assert.deepEqual(p.vars, {});
  p = A.trackerPlan(C({ muffins: 'items' }), { items: R(0, 0, 448, 448) }, { s: 0.5, ox: 0, oy: 0 }, win);
  assert.equal(p.css, 'fit');
  assert.equal(p.fit, 0.5);
  p = A.trackerPlan(ref.vertical[0], ref.vertical[1], { s: 1, ox: 0, oy: 0 }, win);
  assert.equal(p.css, 'fit');
  assert.equal(p.fit, 1);
});

test('z3rPlan', () => {
  const win = { W: 1400, H: 950 }, t = { s: 0.5, ox: 10, oy: 20 };
  assert.equal(A.z3rPlan(ref.split[0], ref.split[1], t, win, null), null);
  let p = A.z3rPlan(ref.vertical[0], ref.vertical[1], t, win, { w: 520, h: 310 });
  const E = A.toView(ref.vertical[1].entrance, t);
  assert.deepEqual(p.bounds, E);
  assert.equal(p.vertical, true);
  assert.equal(p.back, false);
  assert.equal(p.ggw, 0);
  assert.equal(p.zoom, 0.5);
  assert.equal(p.vars['--flow-w'], '520px');
  p = A.z3rPlan(ref.vertical[0], ref.vertical[1], t, win, { w: 520, h: 800 });
  assert.equal(p.zoom, Math.round(100 * (E.height / 800)) / 100);
  p = A.z3rPlan(ref.entrance[0], ref.entrance[1], t, win, { w: 1370, h: 106 });
  assert.deepEqual(p.bounds, A.toView(ref.entrance[1].entrance, t));
  assert.equal(p.zoom, 0.5);
  assert.deepEqual([p.back, p.vertical, p.ggw, p.vars], [false, false, 0, {}]);
  p = A.z3rPlan(ref.entrance[0], ref.entrance[1], t, win, null);
  assert.equal(p.zoom, 0.5);
  assert.equal(A.z3rPlan(ref.entrance[0], ref.entrance[1], t, win, { w: 100000, h: 10 }).zoom, 0.1);
  for (const key of ['ggw1', 'ggw2']) {
    const ctx = key === 'ggw1' ? ref.ggw1[0] : C({ entrance: true, ggwMaps: 2 });
    const b = A.standard(ctx), n = ctx.ggwMaps;
    p = A.z3rPlan(ctx, b, t, win, { w: 1370, h: 106 });
    const M = A.toView(b.maps, t), f = p.zoom;
    const side = Math.min(M.height, M.width / n), z = side / f / A.GGW_MAP;
    assert.equal(p.back, true);
    assert.equal(p.ggw, n);
    assert.deepEqual(p.bounds, { x: 0, y: 0, width: 1400, height: 950 });
    assert.equal(p.vars['--gm-z'], z.toFixed(4));
    assert.ok(Math.abs(parseFloat(p.vars['--gm-left-1']) * z * f - M.x) < 0.1);
    assert.ok(Math.abs(parseFloat(p.vars['--gm-left-2']) * z * f - (M.x + side)) < 0.1);
    assert.ok(Math.abs(parseFloat(p.vars['--gm-top']) * z * f - M.y) < 0.1);
    const E2 = A.toView(b.entrance, t);
    assert.equal(p.vars['--band-left'], (E2.x / f).toFixed(2) + 'px');
    assert.equal(p.vars['--band-top'], (E2.y / f).toFixed(2) + 'px');
    assert.equal(p.vars['--band-right'], ((1400 - E2.x - E2.width) / f).toFixed(2) + 'px');
    assert.equal(p.vars['--band-bottom'], ((950 - E2.y - E2.height) / f).toFixed(2) + 'px');
  }
});

test('Z3R_FLOW_W and constant --flow-w', () => {
  assert.equal(A.Z3R_FLOW_W, 520);
  const win = { W: 1400, H: 950 };
  for (const s of [0.3, 0.7, 1, 1.4]) {
    const p = A.z3rPlan(ref.vertical[0], ref.vertical[1], { s, ox: 0, oy: 0 }, win, { w: 520, h: 326 });
    assert.equal(p.vars['--flow-w'], '520px');
  }
  assert.equal(A.elements(ref.vertical[0]).find((e) => e.id === 'entrance').w, 520);
});

test('z3rOverlay', () => {
  const win = { W: 1000, H: 800 };
  let o = A.z3rOverlay({ x: 100, y: 200, width: 300, height: 50 }, { w: 600, h: 400 }, win);
  assert.equal(o.zoom, 1);
  assert.deepEqual(o.bounds, { x: 100, y: 200, width: 600, height: 400 });
  o = A.z3rOverlay({ x: 800, y: 700, width: 100, height: 50 }, { w: 600, h: 400 }, win);
  assert.deepEqual(o.bounds, { x: 400, y: 400, width: 600, height: 400 });
  o = A.z3rOverlay({ x: -50, y: -50, width: 10, height: 10 }, { w: 600, h: 400 }, win);
  assert.deepEqual([o.bounds.x, o.bounds.y], [0, 0]);
  o = A.z3rOverlay({ x: 0, y: 0, width: 10, height: 10 }, { w: 2000, h: 400 }, win);
  assert.equal(o.zoom, 0.5);
  assert.deepEqual(o.bounds, { x: 0, y: 0, width: 1000, height: 200 });
  for (const [w, h, W, H] of [[1370, 106, 777, 555], [900, 1200, 640, 480], [333, 777, 1234, 321], [5000, 5000, 100, 100], [100, 100, 3000, 3000]]) {
    const r = A.z3rOverlay({ x: 700, y: 300, width: 20, height: 20 }, { w, h }, { W, H });
    assert.ok(r.zoom <= 1 && r.zoom >= 0.1);
    assert.ok(Math.abs(Math.round(r.zoom * 100) - r.zoom * 100) < 1e-9);
    assert.ok(r.bounds.width <= W && r.bounds.height <= H);
    assert.ok(r.bounds.x >= 0 && r.bounds.y >= 0 && r.bounds.x + r.bounds.width <= W && r.bounds.y + r.bounds.height <= H);
  }
});

test('move fallback slides and never jumps past the current position', () => {
  const t = { a: R(0, 0, 100, 100), b: R(104, 300, 100, 50) };
  const F = { w: 204, h: 350 };
  // b below a; proposal overlaps a while x is free: slides along x
  let m = A.move(t, 'b', 150, 60, { frame: F, snap: 0 });
  assert.equal(m.x, 150);
  assert.deepEqual([m.snapX, m.snapY], [null, null]);
  assert.ok(!A.collides({ x: m.x, y: m.y, w: 100, h: 50 }, t.a));
  const cur = t.b;
  const dist = (p, q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  for (const [X, Y] of [[20, 20], [50, 60], [90, 90], [10, 150], [60, 104], [102, 40], [200, 99]]) {
    const r = A.move(t, 'b', X, Y, { frame: F, snap: 0 });
    assert.ok(!A.collides({ x: r.x, y: r.y, w: 100, h: 50 }, t.a), `${X},${Y}`);
    assert.ok(dist(r, { x: X, y: Y }) <= dist(cur, { x: X, y: Y }), `${X},${Y}`);
  }
  // slide along an obstacle: x follows the pointer, y stays clear
  let b = { a: R(0, 0, 400, 100), b: R(0, 200, 100, 50) };
  m = A.move(b, 'b', 250, 50, { frame: { w: 400, h: 250 }, snap: 0 });
  assert.equal(m.x, 250);
  assert.ok(m.y >= 104);
  // stepped drag across a neighbour ends docked on the far side, no step collides
  b = { a: R(100, 0, 100, 100), b: R(0, 0, 80, 100) };
  const fr = { w: 200, h: 100 };
  for (let x = 0; x <= 300; x += 10) {
    const r = A.move(b, 'b', x, 0, { frame: fr, snap: 0 });
    assert.ok(!A.collides({ x: r.x, y: r.y, w: 80, h: 100 }, b.a), `x=${x}`);
    b = { ...b, b: { ...b.b, x: r.x, y: r.y } };
  }
  assert.ok(b.b.x >= 100 + 100 + 4 || b.b.x + 80 + 4 <= 100);
  b = { a: R(100, 0, 100, 100), b: R(0, 0, 80, 100), c: R(0, 104, 300, 20) };
  for (let x = 0; x <= 300; x += 10) {
    const r = A.move(b, 'b', x, 0, { frame: { w: 300, h: 124 }, snap: 0 });
    assert.ok(!A.conflicts({ ...b, b: { ...b.b, x: r.x, y: r.y } }).some((c) => c.includes('b')), `x=${x}`);
    b = { ...b, b: { ...b.b, x: r.x, y: r.y } };
  }
});

test('hardening: bad extents and block sizes', () => {
  const sane = (ctx) => {
    const els = A.elements(ctx), b = A.standard(ctx);
    assert.ok(A.valid(b, els), JSON.stringify(ctx));
    assert.ok(els.every((e) => Number.isInteger(e.w) && Number.isInteger(e.h) && e.w > 0 && e.h > 0));
    assert.match(A.comboKey(ctx), /^(wide|vertical)\|/);
    assert.ok(!A.comboKey(ctx).includes('NaN') && !A.comboKey(ctx).includes('undefined'));
    assert.ok(A.valid(A.resolve(ctx, null).boxes, els));
  };
  const bad = [{ w: NaN, h: NaN }, { w: 0, h: 0 }, { w: 0, h: 50 }, { w: Infinity, h: 20 }, { w: -5, h: -5 }, { w: '12', h: null }, {}];
  for (const windowLayout of ['wide', 'vertical']) for (const z3rExtent of bad) for (const ggwMaps of [0, 2]) {
    sane(C({ windowLayout, entrance: true, z3rExtent, ggwMaps, muffins: windowLayout === 'vertical' ? 'block' : 'split', muffinsSize: { w: 448, h: 1330 } }));
  }
  const bs = [undefined, null, {}, { w: 0, h: 0 }, { w: NaN, h: 5 }, { w: Infinity, h: Infinity }, { w: -1, h: 700 }];
  for (const muffinsSize of bs) for (const windowLayout of ['wide', 'vertical']) {
    const ctx = C({ windowLayout, muffins: 'block', muffinsSize, muffinsParts: ['maps'], entrance: true });
    sane(ctx);
    const m = A.elements(ctx).find((e) => e.id === 'muffins');
    assert.deepEqual([m.w, m.h], [448, 448]);
    assert.ok(A.comboKey(ctx).includes('block448x448'));
  }
  assert.equal(A.elements(C({ entrance: true, z3rExtent: { w: 0, h: 0 } })).find((e) => e.id === 'entrance').w, 1370);
  const p = A.z3rPlan(C({ entrance: true }), A.standard(C({ entrance: true })), { s: 1, ox: 0, oy: 0 }, { W: 1370, H: 1002 }, { w: 0, h: 0 });
  assert.ok(Number.isFinite(p.zoom) && p.zoom > 0);
  const q = A.z3rPlan(C({ entrance: true }), A.standard(C({ entrance: true })), { s: 1, ox: 0, oy: 0 }, { W: 1370, H: 1002 }, { w: NaN, h: 5 });
  assert.ok(Number.isFinite(q.zoom));
});

test('reconcile with stale fixed sizes', () => {
  const small = C({ entrance: true, z3rExtent: { w: 900, h: 100 } }), big = C({ entrance: true, z3rExtent: { w: 1370, h: 300 } });
  const saved = A.standard(small);
  const els = A.elements(big), r = A.reconcile(saved, els);
  assert.ok(r && A.valid(r, els));
  assert.equal(r.entrance.h, 300);
  const vs = C({ windowLayout: 'vertical', muffins: 'block', muffinsSize: { w: 448, h: 700 }, entrance: true });
  const vb = { ...vs, muffinsSize: { w: 900, h: 1330 }, z3rExtent: { w: 520, h: 800 } };
  const vels = A.elements(vb), vr = A.reconcile(A.standard(vs), vels);
  assert.ok(vr && A.valid(vr, vels));
  assert.deepEqual(A.resolve(vb, A.standard(vs)).boxes, vr);
});
