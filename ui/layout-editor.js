(() => {
  const $ = (id) => document.getElementById(id);
  const stage = $('stage'), frameEl = $('frame');
  const C = { windowLayout: 'wide', v2: false, muffins: 'split', muffinsSize: { w: 448, h: 448 }, muffinsParts: [], entrance: false, ggwMaps: 0, z3rExtent: null, showRace: true };
  const mock = (ctx, saved, note) => ({ ...Arrange.resolve(ctx, saved), windowLayout: ctx.windowLayout, gap: Arrange.GAP, note: note || '' });
  const MOCKS = {
    'wide-split': () => mock(C),
    'wide-entrance': () => mock({ ...C, entrance: true }, null, 'Sample note: the entrance tracker size comes from your last session.'),
    'wide-ggw1': () => mock({ ...C, entrance: true, ggwMaps: 1 }),
    'wide-ggw2': () => mock({ ...C, entrance: true, ggwMaps: 2 }),
    'wide-block': () => mock({ ...C, muffins: 'block', muffinsSize: { w: 1340, h: 744 }, muffinsParts: ['maps', 'sphere tracker'] }),
    'vertical-entrance': () => mock({ ...C, windowLayout: 'vertical', muffins: 'block', muffinsSize: { w: 448, h: 1330 }, muffinsParts: ['stacked maps'], entrance: true }),
    'wide-saved': () => {
      const ctx = { ...C, entrance: true }, std = Arrange.standard(ctx), s = JSON.parse(JSON.stringify(std));
      s.race = { x: 0, y: std.stonks.y + std.stonks.h + Arrange.GAP, w: std.stonks.w, h: std.race.h };
      return mock(ctx, s);
    }
  };

  let state = null, boxes = {}, k = 1, drag = null, sent = null, fr = { w: 0, h: 0 };
  const nodes = {}, guides = { v: null, h: null };
  const copy = (b) => JSON.parse(JSON.stringify(b));
  const elOf = (id) => state.elements.find((e) => e.id === id);
  const dimText = (e, b) => `${b.w} x ${b.h}, ` + (e.fixed ? 'fixed size' : `min ${e.minW} x ${e.minH}`);

  function build() {
    for (const e of state.elements) {
      const n = document.createElement('div');
      n.className = 'box' + (e.fixed ? ' fixed' : '');
      n.dataset.id = e.id;
      n.innerHTML = '<div class="label"></div><div class="sub"></div><div class="dim"></div>';
      n.querySelector('.label').textContent = e.label;
      n.querySelector('.sub').textContent = e.sub || '';
      if (!e.fixed) for (const ed of ['e', 's', 'se']) {
        const h = document.createElement('div');
        h.className = 'handle';
        h.dataset.edge = ed;
        h.addEventListener('pointerdown', (ev) => pointerStart(ev, e.id, 'resize', ed));
        n.appendChild(h);
      }
      n.addEventListener('pointerdown', (ev) => { if (!ev.target.closest('.handle')) pointerStart(ev, e.id, 'move'); });
      frameEl.appendChild(n);
      nodes[e.id] = n;
    }
    for (const g of ['v', 'h']) {
      guides[g] = document.createElement('div');
      guides[g].className = 'guide ' + g;
      guides[g].hidden = true;
      frameEl.appendChild(guides[g]);
    }
  }

  const over = (n) => n.scrollWidth > n.clientWidth || n.scrollHeight > n.clientHeight;
  function fit(id) {
    const n = nodes[id], e = elOf(id), s = n.querySelector('.sub'), d = n.querySelector('.dim');
    d.textContent = dimText(e, boxes[id]);
    s.hidden = !e.sub;
    d.hidden = false;
    for (const step of [0, 1, 2]) {
      if (step === 1) d.hidden = true;
      if (step === 2) s.hidden = true;
      for (let f = 12; f >= 6; f -= 0.5) {
        n.style.fontSize = f + 'px';
        if (!over(n)) return;
      }
    }
  }

  function place(id) {
    const n = nodes[id], b = boxes[id];
    n.style.left = b.x * k + 'px';
    n.style.top = b.y * k + 'px';
    n.style.width = b.w * k + 'px';
    n.style.height = b.h * k + 'px';
    n.style.padding = Math.max(0, Math.min(3, Math.floor((Math.min(b.w, b.h) * k - 2) / 8))) + 'px';
  }

  function layout() {
    fr = Arrange.frame(boxes);
    const sw = stage.clientWidth, sh = stage.clientHeight;
    k = Math.min(0.7 * sw / fr.w, 0.7 * sh / fr.h, 1);
    frameEl.style.left = (sw - fr.w * k) / 2 + 'px';
    frameEl.style.top = (sh - fr.h * k) / 2 + 'px';
    frameEl.style.width = fr.w * k + 'px';
    frameEl.style.height = fr.h * k + 'px';
    $('size').textContent = `Window at 100%: ${fr.w} x ${fr.h}`;
  }

  function render() {
    layout();
    for (const e of state.elements) { place(e.id); fit(e.id); }
  }

  function showGuides(sx, sy) {
    guides.v.hidden = sx == null;
    guides.h.hidden = sy == null;
    if (sx != null) guides.v.style.left = sx * k + 'px';
    if (sy != null) guides.h.style.top = sy * k + 'px';
  }

  function begin(id, mode, edge) {
    if (drag) cancelDrag();
    drag = { id, mode, edge, start: { ...boxes[id] }, saved: copy(boxes), frame: { ...fr } };
    nodes[id].classList.add('drag');
  }

  function update(dx, dy) {
    if (!drag) return;
    const { id, start } = drag, snap = 10 / k;
    if (drag.mode === 'move') {
      const r = Arrange.move(boxes, id, start.x + dx, start.y + dy, { snap, frame: drag.frame });
      boxes[id] = { ...boxes[id], x: r.x, y: r.y };
      showGuides(r.snapX, r.snapY);
      place(id);
    } else {
      const e = elOf(id), ed = drag.edge;
      const r = Arrange.resize(boxes, id, ed, start.x + start.w + dx, start.y + start.h + dy, { minW: e.minW, minH: e.minH, snap, frame: drag.frame });
      boxes[id] = { ...boxes[id], w: ed.includes('e') ? r.w : boxes[id].w, h: ed.includes('s') ? r.h : boxes[id].h };
      showGuides(r.snapX, r.snapY);
      place(id);
      fit(id);
    }
  }

  function end() {
    if (!drag) return;
    nodes[drag.id].classList.remove('drag');
    drag = null;
    showGuides(null, null);
    boxes = Arrange.drop(boxes).boxes;
    render();
  }

  function cancelDrag() {
    if (!drag) return;
    nodes[drag.id].classList.remove('drag');
    boxes = drag.saved;
    drag = null;
    showGuides(null, null);
    for (const e of state.elements) { place(e.id); fit(e.id); }
  }

  function pointerStart(ev, id, mode, edge) {
    if (ev.button) return;
    ev.preventDefault();
    try { ev.currentTarget.setPointerCapture(ev.pointerId); } catch (e) {}
    begin(id, mode, edge);
    drag.pid = ev.pointerId; drag.sx = ev.clientX; drag.sy = ev.clientY;
  }

  window.addEventListener('pointermove', (ev) => {
    if (drag && drag.pid === ev.pointerId) update((ev.clientX - drag.sx) / k, (ev.clientY - drag.sy) / k);
  });
  const up = (ev) => { if (drag && drag.pid === ev.pointerId) end(); };
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', (ev) => { if (drag && drag.pid === ev.pointerId) cancelDrag(); });
  window.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && drag) cancelDrag(); });
  window.addEventListener('resize', () => { if (state && !drag) render(); });

  const send = (...a) => { if (window.api) window.api.send(...a); };
  $('cancel').addEventListener('click', () => send('layout-editor-cancel'));
  $('reset').addEventListener('click', reset);
  $('confirm').addEventListener('click', confirm);

  function reset() {
    if (!state) return;
    cancelDrag();
    boxes = copy(state.standard);
    render();
  }

  function confirm() {
    if (!state) return;
    cancelDrag();
    boxes = Arrange.normalise(boxes);
    ed.sent = { key: state.key, boxes: copy(boxes) };
    send('layout-editor-confirm', ed.sent);
  }

  function stateOut() {
    const fe = frameEl.getBoundingClientRect(), rects = {}, labels = {};
    for (const e of state.elements) {
      const r = nodes[e.id].getBoundingClientRect();
      rects[e.id] = { x: r.x, y: r.y, w: r.width, h: r.height };
      labels[e.id] = { label: nodes[e.id].querySelector('.label').textContent, sub: nodes[e.id].querySelector('.sub').textContent };
    }
    return { key: state.key, k, frame: { ...fr }, frameRect: { x: fe.x, y: fe.y, w: fe.width, h: fe.height }, boxes: copy(boxes), rects, labels, conflicts: Arrange.conflicts(boxes) };
  }

  const ed = window.__editor = {
    state: () => (state ? stateOut() : null),
    dragBy(id, dx, dy, steps = 8, onStep) {
      begin(id, 'move');
      for (let i = 1; i <= steps; i++) { update(dx * i / steps, dy * i / steps); if (onStep) onStep(i); }
      end();
      return stateOut();
    },
    resizeBy(id, edge, dx, dy, steps = 8, onStep) {
      begin(id, 'resize', edge);
      for (let i = 1; i <= steps; i++) { update(dx * i / steps, dy * i / steps); if (onStep) onStep(i); }
      end();
      return stateOut();
    },
    reset,
    confirm,
    sent: null
  };

  function fail(text) {
    $('msg').textContent = text;
    $('msg').hidden = false;
    $('reset').hidden = true;
    $('confirm').hidden = true;
    $('size').textContent = '';
  }

  async function init() {
    const name = new URLSearchParams(location.search).get('mock');
    try {
      state = name ? (MOCKS[name] ? MOCKS[name]() : null) : await window.api.invoke('layout-editor-state');
    } catch (e) { state = null; }
    if (!state) return fail('The layout editor could not be opened.');
    $('note').textContent = state.note || '';
    $('note').hidden = !state.note;
    $('mode').textContent = (state.windowLayout === 'vertical' ? 'Standard is the Vertical layout. ' : 'Standard is the Wide layout. ') +
      (state.saved ? 'Showing your saved arrangement.' : 'Showing Standard.');
    boxes = copy(state.boxes);
    build();
    render();
  }
  init();
})();
