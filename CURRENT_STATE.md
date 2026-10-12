# CURRENT_STATE — Electron Shell (newest on top)

---

> **Trimmed 2026-10-12 (D-215, token efficiency).** Older entries were moved, unchanged, to `void/CURRENT_STATE_archive_2026-10-12.md` (full original copy). This live file keeps the header and the newest entries only. Search the archive by date or topic when you need history.

## 2026-09-01 (same day, Go Home) — real click-test CONFIRMED live: the new secure-key bridge
## actually works on pops's own installed 0.3.1 build

Pops installed the hand-delivered `PoPs Suite Setup 0.3.1.exe`, opened PoPs Estimating through it,
and confirmed via screenshot: AI Source tile shows "✓ Key set" against his real connected folder.
This is the first real confirmation the `secureKeys:get`/`secureKeys:set` bridge, `safeStorage`
encryption, and the app-side boot-repair logic all actually work together on a real Windows
install — everything before this was Node-harness/mocked-bridge verification only. Pops: "worked,
if no other checks go home."

**Real, honest scope note:** this confirms the key was present/readable after installing and
opening the app — it confirms the bridge works end to end, but doesn't by itself prove the exact
LevelDB-recreation failure mode (the specific "Creating DB... since it was missing" condition) was
reproduced and recovered from; that's a narrower, harder-to-force repro. The bridge itself being
proven functional is the real, load-bearing confirmation either way — if that condition happens
again, the repair path is now confirmed to actually fire correctly.

---

## 2026-09-01 (same day, continued) — v0.3.1 real release cut: `PoPs Suite Setup 0.3.1.exe` built,
## hand-delivered (no GH_TOKEN, same fallback as every prior version)

Pops: "build the shell release." Real build via `npm run dist` (electron-builder 25.1.8) — took
three attempts, both real, both fixed, not worked around:

1. **First attempt failed** — `d3dcompiler_47.dll: Access is denied` while cleaning `dist\
   win-unpacked`. Root cause found, not guessed: 4 real `PoPs Suite.exe` processes were running
   from that exact folder (confirmed via `Get-Process` — the same folder pops's real Desktop
   shortcut points to, per this module's own prior notes). Asked pops before touching anything
   live, since one or more could have been his active session; confirmed, closed all 4
   (`Stop-Process -Force`), retried.
2. **Second attempt failed differently** — packaging succeeded this time, but NSIS's `makensis.exe`
   hit "Can't open output file" building `PoPs Suite Setup 0.3.1.exe`, leaving a real but
   truncated 261KB stub behind (real installers run ~94MB) plus a locked uninstaller stub — a
   known, common Windows/antivirus transient-file-lock issue with NSIS, not a code problem.
   Deleted both partial artifacts, retried.
3. **Third attempt succeeded clean.** `dist\PoPs Suite Setup 0.3.1.exe`, 94,264,017 bytes — matches
   the real size of every prior version's installer (0.1.0/0.2.0/0.3.0 all ~94MB), confirming a
   complete build, not another partial. Signing skipped (no signing info configured — same
   documented, accepted gap as every prior version; a real public CA cert is still deferred until
   there's a paying customer, per this module's own `CLAUDE.md`).

**Hand-delivered directly to pops** — same fallback every prior version has used, `GH_TOKEN`/
`gh auth` still not available in this environment to publish a real GitHub Release. **Real
consequence, same as always:** since no Release/tag exists for v0.3.1, this will not show up as an
in-app auto-update — it needs a fresh manual install over the existing copy.

**Real, honest gap, same as every prior version:** not click-tested inside a real running install
from this environment (can't launch/drive one here) — the actual point of this release (a real
quit/relaunch recovering a key via the new secure-storage bridge) is unconfirmed until pops
installs and tries it. See `PICKUP-NEXT.md`'s top entry for the exact real test.

---

## 2026-09-01 — v0.3.1: real OS-level secure-key bridge (D-050 Phase 3) — generic safeStorage
## backup/restore for CBM's and PoPs Estimating's own AI Source key

**Pointer note, real drift found this session:** this file's own newest entry (below) was still
2026-08-21/v0.3.0 despite a real 2026-08-30 session shipping `requestSingleInstanceLock()` (fixed
a real production incident, pops's Hub appearing to revert to first-time setup) — that work is
documented in the main mount's own `CURRENT_STATE.md` but was never logged here, the same D-108
drift pattern flagged suite-wide. Not backfilled this pass (out of scope for this session's actual
task) — worth a real reconciliation next time this module gets its own dedicated session.

Picked up from PoPs Estimating's D-050 investigation: its own AI Source key (a real, resold
Anthropic-billing credential/selection, not throwaway data) sits in plain localStorage, vulnerable
to a real, confirmed bug — the Electron app's own Local Storage layer occasionally logs "Creating
DB ... since it was missing" on a full quit/relaunch and silently starts a fresh, empty store,
wiping whatever localStorage held. CBM's own identical `pops_suite_ai_key_v1` key carries the same
exposure. The plan doc (`PoPs Estimating/AI_CREDITS_BILLING_PLAN.md`) named this as Phase 3, flagged
explicitly as "a real Electron Shell change... needs its own session in that module."

**Built:** a generic, product-agnostic secure key/value bridge — `main.js` gains
`SECURE_KEYS_FILE` (`secure-keys.json` in `app.getPath('userData')`, real file on disk, a different
storage subsystem than the vulnerable one), `readSecureKeysFile()`/`writeSecureKeysFile()`, and two
new IPC handlers: `secureKeys:get`/`secureKeys:set`, both origin-checked against `APP_ORIGIN` (same
trust boundary `installPersistentFileSystemPermissions()` already enforces) before touching
anything. Values are encrypted at rest via Electron's `safeStorage` (OS-keychain-backed — DPAPI on
Windows) before ever reaching disk. `preload.js` exposes `window.popsSecureStorage.get(name)`/
`.set(name,value)` via `contextBridge` — only reachable from the app's own trusted origin, matches
the existing `contextIsolation:true`/`sandbox:true` baseline, no relaxation.

**Not a replacement for localStorage** — a deliberate belt-and-suspenders design so neither CBM's
nor PoPs Estimating's existing synchronous `loadAiKeyConfig()`-style reads needed to become async:
each app's own `saveAiKeyConfig()` still writes localStorage first (unchanged, fast, synchronous),
then fire-and-forget mirrors the same value into the secure file. A new boot-time check in each app
(`estSecureKeyBootCheck()`/`cbmSecureKeyBootCheck()`) restores localStorage from the secure copy if
it's ever found empty (the real bug this exists for) and backs up any pre-existing key that
predates this feature. Both app-side changes shipped same session: PoPs Estimating v64.11, CBM
v16.60.

**Verified:** `node --check` clean on both `main.js`/`preload.js`; a logic-level Node harness
(stubbing `safeStorage`/`app`/`fs`, mirroring the real handler bodies verbatim) confirmed
get/set round-tripping, two independent product keys coexisting without cross-contamination,
untrusted-origin senders refused, invalid args refused cleanly, and a corrupt/missing file never
throwing — 7/7 checks passed. Each app's own restore/backup boot logic was separately exercised
live in a browser preview with a mocked `window.popsSecureStorage`, both directions confirmed
correct. **Not click-tested inside a real Electron window** — same standing limitation as every
prior change in this module (this environment can't launch/drive one) — `safeStorage.
isEncryptionAvailable()`'s real behavior on pops's actual machine, and a real full quit/relaunch
recovering a wiped key, are both unconfirmed until he runs a real build.

**Version bumped `0.3.0` → `0.3.1`.** Source committed. **Not released/published** — cutting a real
`npm run dist` build and getting it to pops's installed copy is its own separate action, same
authorization gate as always; flagged as the real next step, not done automatically.

---

## 2026-08-21 — v0.3.0: real PoPs Suite icon wired in, replacing the placeholder (D-092)

The v0.2.0 placeholder icon's own comment anticipated this exact swap: "Swappable later: replace
this one file, no other change needed." That held true — no code change in `main.js` beyond
updating the comment; `build/icon.png` (1254×1254, the icon-only mark locked in D-092) replaces
the hand-rolled brand-indigo placeholder. Archived the old placeholder to
`void/icon_placeholder_2026-08-18.png` (never delete). Version bumped `0.2.0` → `0.3.0`.

**Verified with a real build, not just a file copy:** `node --check main.js` clean, then a real
`npm run dist` — electron-builder auto-generated a proper multi-resolution `.ico` (61KB, up from
the placeholder's own ~1KB single-size icon) from the new source with zero icon-related warnings,
and produced a real installer, `dist\PoPs Suite Setup 0.3.0.exe`. `package-lock.json` unchanged by
the rebuild step.

**Real, honest gap, same as every prior Electron Shell change:** this environment can't launch/
drive a real installed Electron window, so the icon hasn't been visually confirmed in the taskbar/
title bar/tray on a real installed copy — only that the build pipeline accepts it cleanly and
produces a real, correctly-sized `.ico`. Same class of gap as the fullscreen-overlay/tray-icon
work (D-085) — needs a real install + look to fully close.

**Committed** (`b32772b`). **Release cut same session:** confirmed `gh auth`/`GH_TOKEN` still
unavailable in this environment (same standing limitation named in every prior release entry —
`electron-builder`'s own `publish` block targets `github.com/adminpops/pops-suite-electron-shell`,
but nothing here can authenticate to actually create the release). Hand-delivered the already-built
`dist\PoPs Suite Setup 0.3.0.exe` directly to pops instead — same fallback this module has used for
every prior version (v0.1.0, v0.2.0). **Real consequence worth knowing:** since no real GitHub
Release/tag exists for v0.3.0, `electron-updater`'s auto-update check won't find this version —
this has to be a fresh manual install over the existing one, not an in-app auto-update.

## 2026-08-18 (later same day) — D-085 built: fullscreen overlay, system tray, placeholder icon — v0.2.0, not released yet

Following straight from the entry below, pops agreed to a real fix (not another hotkey patch) plus
two new asks, then said "save state." Full decision: `decisions/D-085-fullscreen-overlay-tray-icon.md`.

**Shipped (`main.js`, `overlay-preload.js` new, `package.json`, `build/icon.png` new):**
- **Fullscreen control overlay** — a small always-on-top, frameless, non-native window (minimize /
  exit-fullscreen / close buttons) shown only while the main window is fullscreen, docked top-right
  of whichever display it's on. Fixes the dead-end at its root: true OS fullscreen hides all
  *native* chrome by OS design, so the fix uses a window that isn't native chrome instead of trying
  to keep native chrome visible (which isn't possible). Escape-key handling kept alongside it, no
  harm in leaving it.
- **System tray** — persistent icon while the app runs; click/"Show PoPs Suite" restores+focuses
  the window; "Quit" added. Window-close behavior (still quits) deliberately left unchanged.
- **Placeholder app icon** (`build/icon.png`) — no real PoPs Suite logo file exists anywhere in the
  suite yet (checked); generated a simple brand-indigo/amber placeholder with a hand-rolled PNG
  encoder (no image tooling available in this environment). Wired into the Tray, both
  `BrowserWindow`s, and `package.json`'s `build.icon` for the installer. Swap the one file later
  for real branding.
- **Version bumped `0.1.0` → `0.2.0`** — deliberately, so this doesn't repeat the entry below's
  mistake (a real fix that never actually reached pops's machine because nothing got released).

**Real, honest gap:** syntax-verified (`node --check`, both files) and diff-reviewed clean, not
click-tested — this environment can't launch/drive a real Electron window. **Still needs a real
cut-and-published release (`npm run dist`) before any of this reaches pops's installed copy** —
same root cause as the entry below, now named explicitly as the real next step, not skipped.

**Committed and pushed** (`4f35780`). Built locally (`npm run dist`, no GH_TOKEN/release workflow
exists so it couldn't auto-publish) and hand-installed from `dist\PoPs Suite Setup 0.2.0.exe` since
no publish credential was available. **Confirmed live: "fullscreen fix worked."** D-085 is closed —
fullscreen overlay verified working on the real installed build. Tray icon and placeholder app icon
still not explicitly confirmed, only the fullscreen piece — worth a quick follow-up check.

---

## 2026-08-18 — Escape fix confirmed NOT working live; real cause found: never actually released

Pops click-tested the 2026-08-17 fix live: "escape did not work." Checked before assuming the code
itself is wrong: `caca58b` (the fix below) IS committed to this repo — confirmed via `git log`. But
`git tag` returns **zero tags**, and `package.json` still reads `"version": "0.1.0"` — the same
version as before the fix. Per this module's own D-053 origin (`electron-updater` + GitHub Releases
as the update feed), **a plain `git push` does not reach an already-installed copy** — only a
version-bumped, published GitHub Release does. Pops's installed app was still running whatever
build predates this fix; the code was never wrong, it just never shipped to his machine.

**Real next step, not code — a release:** bump `package.json`'s version, run `npm run dist`
(electron-builder, configured to publish to `github.com/adminpops/pops-suite-electron-shell`),
confirm the new version reaches pops's installed copy via auto-update (or a fresh manual install),
then re-test Escape against that real build. Not done this pass — needs pops's go-ahead, same as
any build/publish action.

---
