(() => {
  if (window.__muffinsFitInstalled) return;
  window.__muffinsFitInstalled = true;
  const fit = () => {
    const app = document.getElementById('app');
    if (!app) return;
    const s = document.documentElement.style;
    s.setProperty('--fit', '1');
    const w = Math.max(app.scrollWidth, app.offsetWidth), h = Math.max(app.scrollHeight, app.offsetHeight);
    if (!w || !h) return;
    s.setProperty('--fit', String(Math.max(0.1, Math.min(innerWidth / w, innerHeight / h))));
  };
  window.__muffinsFit = fit;
  addEventListener('resize', fit);
  const start = () => { fit(); setTimeout(fit, 500); setTimeout(fit, 2000); };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', start); else start();
})();
