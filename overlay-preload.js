// Preload for the fullscreen control-strip overlay window only (see createFullscreenOverlay() in
// main.js) — same contextIsolation/no-nodeIntegration boundary as preload.js, just exposing three
// fixed actions instead of nothing. The overlay's own inline HTML/JS never touches Electron/Node
// directly; it can only call these three named functions.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('popsOverlay', {
  minimize: () => ipcRenderer.send('overlay:minimize'),
  exitFullscreen: () => ipcRenderer.send('overlay:exit-fullscreen'),
  close: () => ipcRenderer.send('overlay:close'),
});
