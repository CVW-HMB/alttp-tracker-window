const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('appSetups', {
  list: () => ipcRenderer.invoke('setups-list'),
  get: (id) => ipcRenderer.invoke('setups-get', id),
  save: (o) => ipcRenderer.invoke('setups-save', o),
  use: (id) => ipcRenderer.invoke('setups-use', id),
  remove: (id) => ipcRenderer.invoke('setups-remove', id),
  extent: (e) => ipcRenderer.send('z3r-extent', e),
});
