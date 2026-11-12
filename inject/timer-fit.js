(() => {
  if (window.__trackerFitInstalled) return;
  window.__trackerFitInstalled = true;
  let on = true, queued = false;
  const de = document.documentElement;
  // Room kept below the timer for the control row and status line, so the counters and timer
  // hold their size and place when those come and go.
  const BELOW = 102, SIDE_W = 300, SIDE_BELOW = 54, GAP = 28;
  // Picks stacked or side-by-side, whichever lets the content render larger.
  const fit = () => {
    queued = false;
    const root = document.getElementById('root');
    if (!root) return;
    if (!on) { for (const k of ['--fit', '--fit-top']) de.style.removeProperty(k); de.classList.remove('tt-row'); return; }
    const W = innerWidth - 8, H = innerHeight - 8;
    de.classList.remove('tt-row');
    let cw = root.offsetWidth, ch = root.offsetHeight;
    de.classList.add('tt-row');
    let rw = root.offsetWidth, rh = root.offsetHeight;
    if (!cw || !ch || !rw || !rh) return;
    const [a, b] = root.firstElementChild ? root.firstElementChild.children : [];
    if (a && b) {
      ch = Math.max(ch, a.offsetHeight + b.offsetHeight + BELOW);
      rw = Math.max(rw, a.offsetWidth + GAP + SIDE_W);
      rh = Math.max(rh, a.offsetHeight, b.offsetHeight + SIDE_BELOW);
    }
    const sc = Math.min(W / cw, H / ch), sr = Math.min(W / rw, H / rh);
    if (sc >= sr) de.classList.remove('tt-row');
    const s = Math.max(0.1, Math.max(sc, sr));
    de.style.setProperty('--fit', String(s));
    de.style.setProperty('--fit-top', Math.max(0, (innerHeight - (sc >= sr ? ch : rh) * s) / 2).toFixed(2) + 'px');
  };
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(fit); } };
  window.__trackerFit = (v) => { on = v; fit(); };
  addEventListener('resize', schedule);
  const start = () => {
    const root = document.getElementById('root');
    if (root) new MutationObserver(schedule).observe(root, { childList: true, subtree: true });
    fit();
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', start); else start();
})();
