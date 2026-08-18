# D-085 — Fullscreen Control Overlay, System Tray, Placeholder App Icon (LOCKED 2026-08-18)

> This module has no `decisions/` folder yet before this file — created now, same "create if
> missing" pattern the suite uses elsewhere. Full discussion: this session's transcript
> (2026-08-18, "Bootstrap project tracker").

## What triggered this

2026-08-17's Escape-key fix for the fullscreen dead-end (real bug: pops got stuck in fullscreen,
had to Task Manager his way out) was confirmed 2026-08-18 to never have actually reached his
installed copy — real cause found: it was committed (`caca58b`) but never released (`package.json`
still read `0.1.0`, zero git tags existed). Discussing the real fix surfaced two more real asks,
pops verbatim: **"maybe you should put a minimse,maximize and a red x in the right corner"**, then
**"keep the fullscreen make sure title bar survives, also need a way to drop it down in the
tray"**, and separately, on the icon gap found while scoping this: **"i like the icon asset now
keep, add overlay save state."**

## Locked decisions

1. **True OS fullscreen stays available** (pops's explicit call — did not want it removed in favor
   of "just maximize," the alternative proposed and declined). Root constraint, confirmed not an
   Electron limitation: real OS fullscreen hides ALL native window chrome (title bar included) on
   both Windows and Mac, by OS design — no way to keep *native* chrome visible while in that mode.
2. **Fix: a small always-on-top overlay window, not native chrome.** Docked to the top-right corner
   of whichever display the main window is fullscreen on, shown only while fullscreen (the real
   native title bar already covers minimize/maximize/close otherwise, no need to duplicate it).
   Three buttons: minimize (exits fullscreen first, then minimizes — a fullscreen window won't
   visibly minimize on Windows otherwise), exit-fullscreen, close. `focusable:false` /
   `showInactive()` so it never steals keyboard focus from the real app content behind it.
3. **System tray added, independent of the overlay.** Persistent tray icon the whole time the app
   runs; click or context-menu "Show PoPs Suite" restores/focuses the window; "Quit" added
   alongside. **Window-close behavior intentionally left unchanged** (still quits the app) — turning
   close-to-tray on would be a bigger behavior change than what was asked for; the tray is an
   additional way back to the window, not a replacement for the existing close semantics.
4. **Placeholder app icon shipped now, not blocked on real branding.** No PoPs Suite logo file
   exists anywhere in the suite yet (checked — logos today are only ever customer-uploaded
   `logoDataUrl` base64 strings inside app state, not a static brand asset on disk). Generated a
   simple placeholder (`build/icon.png`, brand-indigo `#2D2A7F` background, amber `#F59E0B` "P"
   monogram) with a hand-rolled PNG encoder (no image-editing tool was available in this
   environment — no Python/PIL, no ImageMagick). Wired into `package.json`'s `build.icon` (so
   electron-builder auto-generates `.ico`/`.icns` at build time) and used directly for both the
   Tray icon and both `BrowserWindow`s (splash + main), so taskbar/alt-tab/installer all pick it up
   consistently. **Swappable later — replace the one file, no other change needed.**

## Real, honest gap — not verified live

**This environment cannot launch or drive a real Electron window** (same limitation flagged every
time this module's code has been touched). Everything above is syntax-verified (`node --check`,
both `main.js` and the new `overlay-preload.js`) and diff-reviewed clean, not click-tested. Version
bumped to `0.2.0` specifically so this doesn't repeat 2026-08-17's mistake — **a real tagged
release still has to be cut and published (`npm run dist`) for any of this to reach pops's
installed copy**, same as any other Electron Shell change. Real next step: cut that release, then
click-test live — enter fullscreen, confirm the overlay appears top-right and all three buttons
work; check the tray icon appears, restores the window, and Quit works; confirm the new app icon
shows in the taskbar/window/installer instead of Electron's default.

**Not committed yet** — pops's authorization needed, same as any code change.
