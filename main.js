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

const { app, BrowserWindow, dialog, Menu, session } = require('electron');
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
const APP_ORIGIN = new URL(APP_URL).origin;

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
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

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
  // get here"). Root cause: the View menu's "Toggle Full Screen" item was the only way out, but
  // Windows hides a BrowserWindow's native menu bar while it's fullscreen -- so the one control
  // that could exit becomes invisible the moment you enter, with no other way back. before-input-
  // event is the same documented mechanism used for Alt+Left/Right above precisely because it
  // fires regardless of menu-bar visibility or where focus is inside the loaded page.
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'Escape' && win.isFullScreen()) {
      win.setFullScreen(false);
    }
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
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (new URL(url).origin !== APP_ORIGIN) {
      require('electron').shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });
}

app.whenReady().then(() => {
  installPersistentFileSystemPermissions();
  const splash = createSplash();
  createWindow(splash);
  checkForUpdates();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
