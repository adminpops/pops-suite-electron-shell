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

const { app, BrowserWindow, dialog, Menu, session, Tray, ipcMain, screen, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

// Real PoPs Suite icon (D-092, 2026-08-21) — replaces the brand-indigo placeholder that shipped
// with v0.2.0. Same file, same mechanism the placeholder's own comment anticipated: swap
// build/icon.png, no code change needed (electron-builder auto-generates .ico/.icns from it at
// build time; Tray/BrowserWindow both just point at the same PNG). Old placeholder archived to
// void/icon_placeholder_2026-08-18.png, never deleted.
const ICON_PATH = path.join(__dirname, 'build', 'icon.png');

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
const APP_ORIGIN = new URL(APP_URL).origin;

// Tracked at module scope so the tray (createTray) and the fullscreen overlay
// (createFullscreenOverlay) can both reach the one real app window without threading a reference
// through every function that might need it.
let mainWindow = null;
let tray = null;

// Persistent File System Access permissions (added 2026-08-01, fixes the CBM/PoPs Estimating
// folder-repick bug flagged the same day) -- Electron does NOT grant persistent File System
// Access permissions by default, unlike real Chrome (electron/electron#41957). CBM's
// loadDocsFolderHandle() and PoPs Estimating's wsLoadFolderHandle() both store the real
// FileSystemDirectoryHandle in a shared IndexedDB key and call handle.queryPermission() on load --
// the handle itself is found fine (same origin, shared IndexedDB), but without this handler
// queryPermission() can't come back 'granted' after a real top-level navigation (Hub -> CBM ->
// Hub -> PoPs Estimating are each a real win.loadURL() page load, not an SPA transition), so both
// apps correctly fall back to demanding a fresh manual pick every time. Electron 37+ exposes a
// 'fileSystem' permission type on setPermissionCheckHandler specifically to let an app opt into
// remembering a grant across same-session navigations -- this shell was still pinned to Electron
// 32 (bumped to 37 same change) which predates that API entirely. Scoped to this app's own single
// trusted origin, same boundary setWindowOpenHandler below already enforces.
//
// Real bug found 2026-08-02 via live diagnostic logging: Electron reports requestingOrigin to
// setPermissionCheckHandler WITH a trailing slash ("https://engine-server-5.vercel.app/"), but
// APP_ORIGIN (from new URL(APP_URL).origin) never has one -- a straight string comparison always
// failed, so every queryPermission() check reported not-granted even seconds after a real,
// successful pick. Re-parsing requestingOrigin through new URL() normalizes it before comparing,
// so the trailing slash can't break the match either way round.
function installPersistentFileSystemPermissions() {
  session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
    if (permission !== 'fileSystem') return false;
    try { return new URL(requestingOrigin).origin === APP_ORIGIN; } catch (e) { return false; }
  });
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    // Real gap closed alongside the fix above: this previously granted 'fileSystem' to ANY
    // origin unconditionally, since the request handler doesn't get a requestingOrigin param at
    // all -- deriving it from the requesting page's own URL closes that so it matches the same
    // single-trusted-origin boundary the check handler (and setWindowOpenHandler below) enforce.
    let originMatches = false;
    try { originMatches = new URL(webContents.getURL()).origin === APP_ORIGIN; } catch (e) { /* leave false */ }
    callback(permission === 'fileSystem' && originMatches);
  });
}

// Real OS-level key protection (D-050 Phase 3, added 2026-09-01) — CBM's and PoPs Estimating's own
// AI Source config (pops_suite_ai_key_v1 / pops_estimating_ai_key_v1) is real, resold billing data
// (a customer's BYO Anthropic key, or their pooled-mode selection tied to real purchased credits),
// stored today as plain localStorage — vulnerable to the same real, confirmed bug named in D-050's
// investigation (2026-09-01, PoPs Estimating): the Electron app's own Local Storage layer
// occasionally logs "Creating DB ... since it was missing" on a full quit/relaunch and silently
// starts a fresh, empty store, wiping whatever plain localStorage held. A real file on disk is
// immune to that (it's a different storage subsystem entirely) — this is a generic, product-
// agnostic backup/restore bridge: any origin-matched app running inside this shell can ask to
// back up a named string (encrypted at rest via Electron's safeStorage, OS-keychain-backed — DPAPI
// on Windows) and have it restored if localStorage ever comes back empty. The app side (CBM/
// PoPs Estimating) still owns localStorage as its fast synchronous read path unchanged — this is a
// belt-and-suspenders repair mechanism, not a replacement, so no existing synchronous
// loadAiKeyConfig()-style call site needs to become async.
const SECURE_KEYS_FILE = path.join(app.getPath('userData'), 'secure-keys.json');

function readSecureKeysFile() {
  try {
    const raw = fs.readFileSync(SECURE_KEYS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch (e) {
    return {}; // missing file / first run / corrupt -- start clean, never throw
  }
}
function writeSecureKeysFile(obj) {
  fs.writeFileSync(SECURE_KEYS_FILE, JSON.stringify(obj), 'utf8');
}

// Real trust boundary, same one setWindowOpenHandler/installPersistentFileSystemPermissions above
// already enforce: only the app's own single trusted origin may read/write secure keys, checked
// per-call (not just at window-creation time) since a compromised/misdirected renderer could
// otherwise ask for another product's stored key.
function isTrustedSender(event) {
  try { return new URL(event.senderFrame.url).origin === APP_ORIGIN; } catch (e) { return false; }
}

ipcMain.handle('secureKeys:get', (event, name) => {
  if (!isTrustedSender(event) || typeof name !== 'string' || !name) return null;
  if (!safeStorage.isEncryptionAvailable()) return null; // no OS keychain available -- caller falls back to localStorage-only, unchanged
  const store = readSecureKeysFile();
  const encoded = store[name];
  if (!encoded) return null;
  try {
    return safeStorage.decryptString(Buffer.from(encoded, 'base64'));
  } catch (e) {
    return null; // corrupt/undecryptable entry -- never throw into the renderer, just report "nothing usable"
  }
});

ipcMain.handle('secureKeys:set', (event, name, value) => {
  if (!isTrustedSender(event) || typeof name !== 'string' || !name || typeof value !== 'string') {
    return { ok: false, error: 'Invalid request.' };
  }
  if (!safeStorage.isEncryptionAvailable()) return { ok: false, error: 'OS-level encryption is not available on this machine.' };
  try {
    const store = readSecureKeysFile();
    store[name] = safeStorage.encryptString(value).toString('base64');
    writeSecureKeysFile(store);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
});

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

// Fullscreen control-strip overlay (added 2026-08-18, D-085) -- a separate, tiny, always-on-top,
// frameless window docked to the top-right corner of whichever display the main window is
// fullscreen on. Not native OS chrome, so entering real fullscreen (which hides all native chrome)
// has nothing here to hide. Shown only while win.isFullScreen() -- the real native title bar
// already covers minimize/maximize/close the rest of the time, no need to duplicate it. Loads a
// tiny inline data: URL (three buttons, no product content) -- same "shell chrome only, no app
// HTML/JS ships here" boundary as the splash window and loading bar above.
let overlayWindow = null;

const OVERLAY_WIDTH = 112;
const OVERLAY_HEIGHT = 34;
const OVERLAY_MARGIN = 8;

const OVERLAY_HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;background:#1c1830;overflow:hidden;-webkit-user-select:none;}
  #bar{display:flex;height:${OVERLAY_HEIGHT}px;-webkit-app-region:drag;}
  button{
    -webkit-app-region:no-drag; flex:1; border:0; background:transparent; color:#e8e6f5;
    font:14px/1 system-ui,sans-serif; cursor:pointer; display:flex; align-items:center;
    justify-content:center;
  }
  button:hover{background:rgba(255,255,255,0.12);}
  #closeBtn:hover{background:#e81123; color:#fff;}
</style></head><body>
  <div id="bar">
    <button id="minBtn" title="Minimize">&#x2013;</button>
    <button id="restoreBtn" title="Exit full screen">&#x2922;</button>
    <button id="closeBtn" title="Close">&#x2715;</button>
  </div>
  <script>
    document.getElementById('minBtn').onclick = () => window.popsOverlay.minimize();
    document.getElementById('restoreBtn').onclick = () => window.popsOverlay.exitFullscreen();
    document.getElementById('closeBtn').onclick = () => window.popsOverlay.close();
  </script>
</body></html>`;

function positionOverlay(win) {
  if (!overlayWindow) return;
  const display = screen.getDisplayMatching(win.getBounds());
  const x = display.bounds.x + display.bounds.width - OVERLAY_WIDTH - OVERLAY_MARGIN;
  const y = display.bounds.y + OVERLAY_MARGIN;
  overlayWindow.setBounds({ x, y, width: OVERLAY_WIDTH, height: OVERLAY_HEIGHT });
}

function showFullscreenOverlay(win) {
  if (!overlayWindow) {
    overlayWindow = new BrowserWindow({
      width: OVERLAY_WIDTH,
      height: OVERLAY_HEIGHT,
      frame: false,
      resizable: false,
      movable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      focusable: false, // never steals focus/keyboard from the real app content behind it
      backgroundColor: '#1c1830',
      webPreferences: {
        preload: path.join(__dirname, 'overlay-preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });
    overlayWindow.setAlwaysOnTop(true, 'screen-saver'); // stays above a fullscreen window on Windows
    overlayWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(OVERLAY_HTML));
    overlayWindow.on('closed', () => { overlayWindow = null; });
  }
  positionOverlay(win);
  overlayWindow.showInactive(); // "inactive" so it never pulls keyboard focus off the real app
}

function hideFullscreenOverlay() {
  if (overlayWindow) overlayWindow.hide();
}

ipcMain.on('overlay:minimize', () => {
  if (!mainWindow) return;
  // A fullscreen window won't visibly minimize on Windows until it leaves fullscreen first.
  mainWindow.setFullScreen(false);
  mainWindow.minimize();
});
ipcMain.on('overlay:exit-fullscreen', () => { if (mainWindow) mainWindow.setFullScreen(false); });
ipcMain.on('overlay:close', () => { if (mainWindow) mainWindow.close(); });

// System tray (added 2026-08-18, pops: "also need a way to drop it down in the tray") -- the app
// keeps a persistent tray icon the whole time it's running, independent of fullscreen/minimize
// state, as another always-available way back to the window (useful alongside the fullscreen
// overlay above, not a replacement for it -- the overlay handles the in-fullscreen case
// specifically, the tray handles "I minimized/lost the window and want it back" generally). Left
// window-close behavior unchanged (still quits, per the existing window-all-closed handler below)
// -- turning close-to-tray on is a bigger behavior change than what pops asked for here.
function createTray() {
  tray = new Tray(ICON_PATH);
  tray.setToolTip('PoPs Suite');
  const showWindow = () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  };
  tray.on('click', showWindow);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show PoPs Suite', click: showWindow },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]));
}

// Splash window (added 2026-08-01, pops: "can you build a static window while loading in
// progress and progress bar") -- shown only for the app's cold launch, before the real Hub page
// has ever loaded once. Loads a small local `loading.html` -- pure branding/animation, no product
// content, same "shell chrome only" reasoning as everything else in this file, so it doesn't
// conflict with D-052. Frameless + centered + skipTaskbar so it doesn't look like a second real
// app window, just a splash.
function createSplash() {
  const splash = new BrowserWindow({
    width: 360,
    height: 220,
    frame: false,
    resizable: false,
    center: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#2f1f6b',
    icon: ICON_PATH,
    webPreferences: { sandbox: true }
  });
  splash.loadFile(path.join(__dirname, 'loading.html'));
  return splash;
}

// Real, visible top-of-window progress bar (added same session as the splash window above) --
// the taskbar progress ring is easy to miss since it's off in the taskbar, not in the window
// itself. Injected via insertCSS/executeJavaScript (works regardless of the loaded page's own
// CSP -- these are devtools-protocol-level injections, not <style>/<script> tags subject to it),
// removed again once the page finishes. Runs on every navigation, not just cold launch, since
// clicking from the Hub into a large module (CBM/PoPs Estimating) is exactly when this matters
// most.
const LOADING_BAR_CSS = `
#__pops_shell_loading_bar {
  position: fixed; top: 0; left: 0; width: 100%; height: 3px;
  z-index: 2147483647; overflow: hidden; pointer-events: none;
}
#__pops_shell_loading_bar::after {
  content: ''; position: absolute; top: 0; left: -40%; width: 40%; height: 100%;
  background: linear-gradient(90deg, transparent, #f5a623, transparent);
  animation: __pops_shell_loading_slide 1s ease-in-out infinite;
}
@keyframes __pops_shell_loading_slide {
  0% { left: -40%; } 100% { left: 100%; }
}
`;
const SHOW_LOADING_BAR_JS = `
(function(){
  if (!document.getElementById('__pops_shell_loading_bar')) {
    var d = document.createElement('div');
    d.id = '__pops_shell_loading_bar';
    (document.body || document.documentElement).appendChild(d);
  }
})();
`;
const HIDE_LOADING_BAR_JS = `
(function(){
  var el = document.getElementById('__pops_shell_loading_bar');
  if (el) el.remove();
})();
`;

function createWindow(splash) {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    show: !splash, // if a splash window is up (cold launch), stay hidden until the real page is
    // ready so there's no blank/white flash behind the splash; on later window recreations
    // (macOS 'activate' with no splash in play) just show immediately as before.
    backgroundColor: '#f4f5fa', // matches the Hub's own page background -- avoids a jarring pure-
    // white flash while the very first load is still in flight, before backgroundColor even matters
    icon: ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow = win;
  win.on('closed', () => { if (mainWindow === win) mainWindow = null; });

  buildMenu(win);

  win.loadURL(APP_URL);

  if (splash) {
    win.webContents.once('did-finish-load', () => {
      splash.close();
      win.show();
    });
  }

  // Real loading indicator (added 2026-08-01, pops: "and it takes a while to load") -- CBM (684KB)
  // and PoPs Estimating (876KB) are large single-file apps, real weight to fetch/parse, especially
  // cold. The window used to just sit blank-white with zero feedback while that happened, which
  // reads as frozen, not "working." Signals used, all page-content-free: the window title, an
  // indeterminate taskbar progress ring, and (added later same session) a real visible progress
  // bar injected at the top of the window itself. Title uses a plain ASCII hyphen/dots on purpose
  // -- an em dash/ellipsis here (unlike in the page's own <title>, set through Electron's normal
  // page-title-updated path) rendered as mojibake in the native Windows title bar; simplest fix is
  // not risking those characters in a directly-set title at all.
  win.webContents.on('did-start-loading', () => {
    win.setTitle('PoPs Suite - Loading...');
    win.setProgressBar(2);
    win.webContents.insertCSS(LOADING_BAR_CSS).catch(() => {});
    win.webContents.executeJavaScript(SHOW_LOADING_BAR_JS).catch(() => {});
  });
  win.webContents.on('did-stop-loading', () => {
    win.setProgressBar(-1);
    win.webContents.executeJavaScript(HIDE_LOADING_BAR_JS).catch(() => {});
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

  // Escape exits fullscreen (added 2026-08-17, real bug pops hit live: "i used the view tab and
  // went full screen, and there was no way to go back, i had to use task manager and end task to
  // get here"). Kept as a convenience alongside the overlay below -- costs nothing, helps anyone
  // who just reaches for Escape out of habit.
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'Escape' && win.isFullScreen()) {
      win.setFullScreen(false);
    }
  });

  // Real fix for the fullscreen dead-end (added 2026-08-18, superseding the Escape-only patch
  // above as the primary fix -- pops confirmed live that patch never actually reached his
  // installed copy, see decisions/D-085, but the underlying trap is real regardless: true OS
  // fullscreen hides ALL native window chrome -- title bar, minimize/maximize/close -- on both
  // Windows and Mac, by OS design, not something Electron can override while the window stays in
  // that mode. Pops's own direction: "keep the fullscreen make sure title bar survives." Since no
  // native chrome can survive real fullscreen, the fix is a small always-on-top overlay window
  // that ISN'T native chrome -- the OS has nothing to hide.
  win.on('enter-full-screen', () => showFullscreenOverlay(win));
  win.on('leave-full-screen', () => hideFullscreenOverlay());
  win.on('closed', () => hideFullscreenOverlay());

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
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (new URL(url).origin !== APP_ORIGIN) {
      require('electron').shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });
}

// Real fix (2026-08-30) -- root cause of pops's "the hub reverted to first-time setup" report,
// confirmed directly on his own machine, not guessed: this file never called
// requestSingleInstanceLock(), so nothing stopped two real "PoPs Suite.exe" process trees from
// running at once against the SAME session.defaultSession user-data-dir. Confirmed live: an
// instance from earlier that morning was still alive hours later (never cleanly quit -- a real,
// separate, apparently rare shutdown-hang, not reproduced or root-caused this pass), and launching
// a second instance on top of it collided on the shared IndexedDB storage -- LevelDB is
// single-writer, so the SECOND process's indexedDB.open() calls for pops_suite_fs_v1/
// pops_suite_keys_v1 genuinely hit the onblocked/timeout path already built into hubFolderIDB()/
// hubKeysIDB() and silently resolved to "nothing found," which is what made a real, intact account
// look like a fresh install. This was never actually about File System Access permissions
// surviving a restart (a real, separate, genuine Electron limitation -- still worth the
// requestPermission()-based reconnect fixes already shipped in the Hub itself for the case where a
// restart really did happen cleanly) -- it was a second process stepping on the first one's lock.
// The standard, documented Electron fix: if a second launch finds the lock already held, it quits
// itself immediately and asks the FIRST instance to focus its own window instead of ever opening a
// competing connection to the same storage.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    installPersistentFileSystemPermissions();
    const splash = createSplash();
    createWindow(splash);
    createTray();
    checkForUpdates();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
