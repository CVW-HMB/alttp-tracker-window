(() => {
  if (window.__trackerFitInstalled) return;
  window.__trackerFitInstalled = true;
  let on = true, queued = false;
  const de = document.documentElement;
  // Picks stacked or side-by-side, whichever lets the content render larger.
  const fit = () => {
    queued = false;
    const root = document.getElementById('root');
    if (!root) return;
    if (!on) { de.style.removeProperty('--fit'); de.classList.remove('tt-row'); return; }
    const W = innerWidth - 8, H = innerHeight - 8;
    de.classList.remove('tt-row');
    const cw = root.offsetWidth, ch = root.offsetHeight;
    de.classList.add('tt-row');
    const rw = root.offsetWidth, rh = root.offsetHeight;
    if (!cw || !ch || !rw || !rh) return;
    const sc = Math.min(W / cw, H / ch), sr = Math.min(W / rw, H / rh);
    if (sc >= sr) de.classList.remove('tt-row');
    de.style.setProperty('--fit', String(Math.max(0.1, Math.max(sc, sr))));
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
