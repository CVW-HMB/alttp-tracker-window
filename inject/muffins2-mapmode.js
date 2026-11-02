// Muffins 2.0: set the session's map mode the way its own popout windows sync settings.
((id, want) => {
  const ch = new BroadcastChannel(`alttptracker_sync_${id}`);
  ch.postMessage({ windowId: 'alttp-tracker-window', action: { type: 'trackerSettings/setMapMode', payload: want } });
  ch.close();
})
