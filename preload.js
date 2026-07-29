// Intentionally minimal — contextIsolation is on and nodeIntegration is off (see main.js), so the
// page has no Node/Electron API access by default, which is correct: it's a normal web app that
// happens to run in a native window, not an app that needs desktop-level capabilities. Nothing to
// bridge yet. If a real desktop-only feature comes up later (native file save, OS notifications),
// expose it here via contextBridge.exposeInMainWorld, never by turning nodeIntegration back on.
