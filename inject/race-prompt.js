// racetime.gg asks for a race comment with window.prompt(), which Electron does not implement:
// the call returns null and the Add comment form silently gives up. This replaces prompt() with
// an in-page dialog. The form that asked is remembered and re-submitted once the dialog closes,
// at which point prompt() hands back the typed answer.
(() => {
  if (window.__trackerPrompt) return;
  window.__trackerPrompt = true;

  let answer = null;   // handed to the next prompt() call, during the re-submit
  let asking = null;   // the form whose submit is in progress; forgotten once the submit event is over
  document.addEventListener('submit', (e) => {
    asking = e.target;
    setTimeout(() => { if (asking === e.target) asking = null; }, 0);
  }, true);

  function dialog(text, initial, done) {
    const root = document.createElement('div');
    root.className = 'tracker-prompt';
    root.innerHTML =
      '<div class="tracker-prompt-box" role="dialog">' +
        '<label></label>' +
        '<textarea rows="3" maxlength="500"></textarea>' +
        '<div class="tracker-prompt-btns">' +
          '<button type="button" class="tracker-prompt-cancel">Cancel</button>' +
          '<button type="button" class="tracker-prompt-ok">OK</button>' +
        '</div>' +
      '</div>';
    root.querySelector('label').textContent = text == null ? '' : String(text);
    const ta = root.querySelector('textarea');
    ta.value = initial == null ? '' : String(initial);
    let open = true;
    const finish = (v) => { if (!open) return; open = false; root.remove(); done(v); };
    root.querySelector('.tracker-prompt-ok').addEventListener('click', () => finish(ta.value));
    root.querySelector('.tracker-prompt-cancel').addEventListener('click', () => finish(null));
    root.addEventListener('mousedown', (e) => { if (e.target === root) finish(null); });
    root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); finish(null); }
      else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); finish(ta.value); }
    });
    document.body.appendChild(root);
    ta.focus();
    ta.select();
  }

  window.prompt = function (text, initial) {
    const form = asking;
    asking = null;
    if (answer !== null) { const v = answer; answer = null; return v; }
    if (!form) return null;
    dialog(text, initial, (v) => {
      if (v === null || !form.isConnected) return;
      answer = v;
      try { form.requestSubmit(); } finally { answer = null; }
    });
    return null;
  };
})();
