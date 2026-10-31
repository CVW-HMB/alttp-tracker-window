const { contextBridge, ipcRenderer } = require('electron');

const SEND = [
  'drag-start', 'drag-move', 'drag-end', 'drag-reset', 'set-option', 'load-race', 'race-nav', 'open-launcher',
  'open-site-launcher', 'update-muffins', 'set-url', 'launch',
];
const INVOKE = ['launcher-state'];
const LISTEN = ['state', 'focus-url', 'launcher-state'];

contextBridge.exposeInMainWorld('api', {
  send: (ch, ...args) => { if (SEND.includes(ch)) ipcRenderer.send(ch, ...args); },
  invoke: (ch, ...args) => (INVOKE.includes(ch) ? ipcRenderer.invoke(ch, ...args) : Promise.reject(new Error('blocked'))),
  on: (ch, cb) => { if (LISTEN.includes(ch)) ipcRenderer.on(ch, (_e, ...args) => cb(...args)); },
});
