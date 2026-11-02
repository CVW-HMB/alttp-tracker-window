(() => {
  if (window.__muffinsFitInstalled) return;
  window.__muffinsFitInstalled = true;
  // #app reports 1340 wide in every map mode, so size comes from the map mode, as the tracker's launcher does.
  const size = () => {
    const d = new URLSearchParams(location.search).get('d') || '';
    const sphere = d[3] === 'Y';
    if (d[0] === 'V') return [sphere ? 892 : 448, 1330];
    if (d[0] === 'C') return [448, sphere ? 988 : 692];
    return [d[0] === 'M' ? 1340 : 448, sphere ? 744 : 448];
  };
  const fit = () => {
    const [w, h] = size();
    const s = document.documentElement.style;
    s.setProperty('--nat-w', w + 'px');
    s.setProperty('--nat-h', h + 'px');
    s.setProperty('--fit', String(Math.max(0.1, Math.min(innerWidth / w, innerHeight / h))));
  };
  window.__muffinsFit = fit;
  addEventListener('resize', fit);
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', fit); else fit();
})();
