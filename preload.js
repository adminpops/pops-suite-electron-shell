// contextIsolation is on and nodeIntegration is off (see main.js), so the page has no Node/
// Electron API access by default, which is correct: it's a normal web app that happens to run in
// a native window, not an app that needs desktop-level capabilities. Expose real desktop-only
// features here via contextBridge.exposeInMainWorld, never by turning nodeIntegration back on.

const { contextBridge, ipcRenderer } = require('electron');

// D-050 Phase 3 (2026-09-01) — real OS-level backup/restore for CBM's and PoPs Estimating's own
// AI Source config, backed by main.js's safeStorage-encrypted secure-keys.json. `window.
// popsSecureStorage` only exists when the page is actually running inside this shell — every call
// site in CBM/PoPs Estimating checks `typeof window.popsSecureStorage!=='undefined'` first, so
// running the same app as a plain browser tab (Hub-hosted, no shell) is completely unaffected,
// same localStorage-only behavior as before this existed.
contextBridge.exposeInMainWorld('popsSecureStorage', {
  get: (name) => ipcRenderer.invoke('secureKeys:get', name),
  set: (name, value) => ipcRenderer.invoke('secureKeys:set', name, value)
});
