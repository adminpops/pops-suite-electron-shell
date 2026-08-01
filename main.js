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
//
// 2026-08-01 — APP_URL switched from CBM straight to the Admin Hub (HUB_BUILD_SPEC.md,
// spec/HUB_BUILD_SPEC.md), now that the Hub has a working first pass (module grid, locked-tile
// requests, Admin shared-folder setup) verified live. CBM itself is still reachable — it's the
// Hub's own "Open →" tile — this just adds the Hub as a real home screen instead of skipping
// straight to one module. Pops's own call, confirmed knowing this changes what the already-shipped
// v0.1.0 installer shows on its next real rebuild/update.
// ═══════════════════════════════════════════════════════════════════════════

const { app, BrowserWindow, dialog, Menu } = require('electron');
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

// Points at the Hub, not a single module — the Hub itself launches CBM (and, once hosted, CTC/
// PoPs Estimating) from its own module grid. (No custom vercel.json rewrite needed — Vercel's own
// cleanUrls already serves app/hub/index.html at this exact path, same as app/cbm did.)
const APP_URL = 'https://engine-server-5.vercel.app/app/hub';

// Real navigation menu (added 2026-08-01, pops: "everthing needs back buttons i have to close
// and start over") -- the shell only ever loaded a URL and left it at that, so clicking into a
// module from the Hub had no way back except quitting and relaunching. Native menu bar, not page
// content -- same "shell chrome only, no app HTML/JS ships" reasoning as the context-menu fix.
// "Home" is a separate action from "Back" on purpose: back-history inside a module's own app can
// get deep/weird (tabs, modals, etc.), Home always guarantees a clean return to the Hub.
function buildMenu(win) {
  const template = [
    {
      label: 'Navigate',
      submenu: [
        { label: 'Back', accelerator: 'Alt+Left', click: () => { if (win.webContents.canGoBack()) win.webContents.goBack(); } },
        { label: 'Forward', accelerator: 'Alt+Right', click: () => { if (win.webContents.canGoForward()) win.webContents.goForward(); } },
        { label: 'Home (Hub)', accelerator: 'Alt+Home', click: () => { win.loadURL(APP_URL); } },
        { type: 'separator' },
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => { win.webContents.reload(); } }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: '#f4f5fa', // matches the Hub's own page background -- avoids a jarring pure-
    // white flash while the very first load is still in flight, before backgroundColor even matters
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  buildMenu(win);

  win.loadURL(APP_URL);

  // Real loading indicator (added 2026-08-01, pops: "and it takes a while to load") -- CBM (684KB)
  // and PoPs Estimating (876KB) are large single-file apps, real weight to fetch/parse, especially
  // cold. The window used to just sit blank-white with zero feedback while that happened, which
  // reads as frozen, not "working." Two native, page-content-free signals instead: the window
  // title says so, and the taskbar icon gets an indeterminate progress ring (Electron's own
  // documented pattern -- setProgressBar(2) = indeterminate on Windows, <0 = removed). The title
  // corrects itself automatically once the real page loads and sets its own <title> -- Electron
  // does that by default, nothing to revert manually.
  win.webContents.on('did-start-loading', () => {
    win.setTitle('PoPs Suite — Loading…');
    win.setProgressBar(2);
  });
  win.webContents.on('did-stop-loading', () => {
    win.setProgressBar(-1);
  });

  // Mouse back/forward side buttons (most mice have these) -- same real back/forward navigation
  // as the menu items above, just via the hardware buttons users already expect this from.
  win.on('app-command', (e, cmd) => {
    if (cmd === 'browser-backward' && win.webContents.canGoBack()) win.webContents.goBack();
    else if (cmd === 'browser-forward' && win.webContents.canGoForward()) win.webContents.goForward();
  });

  // Alt+Left / Alt+Right keyboard back/forward -- the menu accelerators above already cover this
  // on Windows, but before-input-event is the documented cross-platform way to be sure it fires
  // even when focus is deep inside the loaded page's own content.
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || !input.alt) return;
    if (input.key === 'ArrowLeft' && win.webContents.canGoBack()) win.webContents.goBack();
    else if (input.key === 'ArrowRight' && win.webContents.canGoForward()) win.webContents.goForward();
  });

  // Electron does NOT give editable fields a native right-click Cut/Copy/Paste menu by default
  // (unlike a real browser) -- nothing in this file ever wired one up, so right-click did nothing
  // on any text field in any app opened through this shell (Ctrl+V/Ctrl+C still worked via the
  // default application menu's Edit accelerators). Standard documented Electron pattern: build a
  // menu from the real edit-state flags Chromium hands back, so items are only enabled when the
  // action is actually valid (e.g. Paste greyed out with an empty clipboard).
  win.webContents.on('context-menu', (event, params) => {
    const template = [];
    if (params.isEditable) {
      template.push(
        { role: 'cut', enabled: params.editFlags.canCut },
        { role: 'copy', enabled: params.editFlags.canCopy },
        { role: 'paste', enabled: params.editFlags.canPaste },
        { type: 'separator' },
        { role: 'selectAll', enabled: params.editFlags.canSelectAll }
      );
    } else if (params.selectionText) {
      template.push({ role: 'copy' });
    }
    if (template.length) {
      Menu.buildFromTemplate(template).popup({ window: win });
    }
  });

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
