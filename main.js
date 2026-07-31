// ═══════════════════════════════════════════════════════════════════════════
// PoPs Suite desktop shell — D-053 layer 6, CBM as the pilot (same pattern every other
// piece of new suite architecture has proven out first).
//
// Deliberately loads a URL, not a local file. Pops's own words: "the users data will remain in
// the clients system but we will maintain the secrets of the software ask and answer and the
// html lives on our server." This window is a pure native wrapper around the real, server-hosted
// app — no HTML/JS ships inside this app at all. The calculation logic was already server-side
// (D-037/D-039); this closes the last local piece, the UI shell itself.
//
// Security settings below (contextIsolation on, nodeIntegration off, no remote module) are
// Electron's own documented baseline for "loads a remote URL" apps — this window has no reason to
// touch Node/filesystem APIs at all, so it doesn't get the ability to.
// ═══════════════════════════════════════════════════════════════════════════

const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

// Checks GitHub Releases on this repo (adminpops/pops-suite-electron-shell — public, see
// package.json's own build.publish block) for a newer version, downloads it in the background,
// and prompts to restart once it's ready. Repo has no real secrets/IP in it (D-052 keeps all of
// that server-side), so no auth token is needed to read its public releases — the customer-facing
// app never embeds any credential.
function checkForUpdates() {
  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    // Never block the app over a failed update check (no internet, GitHub down, etc.) — this is
    // a background convenience, not something that should interrupt someone trying to work.
    console.error('Update check failed (non-fatal):', err.message);
  });
}

autoUpdater.on('update-downloaded', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Update ready',
    message: 'A new version of PoPs Suite has been downloaded. Restart now to apply it?',
    buttons: ['Restart now', 'Later'],
  }).then((result) => {
    if (result.response === 0) autoUpdater.quitAndInstall();
  });
});

// Swap per app when this shell wraps CTC/PoPs Estimating too — one shell, one URL constant,
// same as every other module's own _WS_ENGINE_SERVER/_EST_ENGINE_SERVER pointer pattern.
// (No custom vercel.json rewrite needed — Vercel's own cleanUrls already serves
// app/cbm/index.html at this exact path.)
const APP_URL = 'https://engine-server-5.vercel.app/app/cbm';

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.loadURL(APP_URL);

  // Anything not the app's own origin (e.g. a link someone pastes into a message that ends up
  // clicked from inside the shell) opens in the OS's real default browser instead of navigating
  // this window away from the real app — same reasoning as any desktop app that embeds a
  // single trusted origin.
  const appOrigin = new URL(APP_URL).origin;
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (new URL(url).origin !== appOrigin) {
      require('electron').shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });
}

app.whenReady().then(() => {
  createWindow();
  checkForUpdates();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
