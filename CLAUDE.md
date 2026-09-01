# Project Instructions — Electron Shell (read at every session open)

> Auto-loaded when this folder is the workspace. **New module, scaffolded 2026-07-29** during a
> suite-wide hardening session (D-053, main mount). Source of truth for the whole suite is the
> main mount: `C:\Users\mikeg\PoPs Suite\New Claude Work Env`.

## What this is

The PoPs Suite desktop app shell — a thin native (Electron) window that loads the real,
server-hosted app UI. No HTML/JS ships inside this app itself; per D-052 ("the html lives on our
server"), this window just points a `BrowserWindow` at a real hosted URL. CBM is the pilot
(`https://engine-server-5.vercel.app/app/cbm`) — CTC and PoPs Estimating aren't wrapped yet, would
need the same static-hosting treatment on the Engine Server first.

Real cost still owed before this ships to a customer: code-signing certificates for Windows/Mac
installers (~$100–500/yr, discussed with pops — his call to absorb into general pricing, not
itemize per purchaser).

## FIRST THING EVERY SESSION — NO EXCEPTIONS (Bootstrap)
Read in order, give a one-paragraph orientation, WAIT for direction:
1. `New Claude Work Env\decisions\D-053-suite-wide-hardening-architecture.md` — full origin story
   and current state of everything this module is part of.
2. `CURRENT_STATE.md` — what happened last session.
3. `PICKUP-NEXT.md` (added 2026-09-01) — top real priorities.
4. Skim `main.js`/`preload.js`/`package.json` — small enough to just read directly, no separate
   spec file yet.

## Two Core Rules
**Rule A — Don't build until clear.** Ambiguous → ASK. Especially real here: which app gets
wrapped next, when code-signing gets purchased, whether individual per-user accounts are ever
needed (D-053 explicitly deferred that as a future feature decision, not a security requirement).
**Rule B — Listen to exact words.** Capture pops verbatim, don't paraphrase.
**Rule D — Discuss-first / plan-first before any code.** No coding until pops says "save state."

## Security baseline (locked, don't relax without a real reason)
`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` in every `BrowserWindow` — this
app has no reason to touch Node/filesystem APIs from the loaded page. Non-app-origin links open in
the OS's real browser instead of navigating the shell window away.

## Go Home (session close-out)
1. Confirm closing. 2. Update `CURRENT_STATE.md` (newest on top). 3. Commit + push (private repo,
`github.com/adminpops/pops-suite-electron-shell`, same branch-protection + gitleaks hardening as
every other suite repo). Requires pops's authorization per commit, same as always.

## Folder layout
> **Corrected 2026-09-01 — this whole section was stale, verified against a real directory listing
> (`Get-ChildItem -Force`), not assumed.** The old text claimed `decisions/`/`void/`/
> `PICKUP-NEXT.md` didn't exist yet; all three already did (PICKUP-NEXT.md since 2026-08-01,
> decisions/ holding D-085 at minimum) — a real, if minor, instance of the same D-108 drift
> pattern flagged suite-wide, caught here because trusting this stale claim led to a real Write-
> without-Read overwrite of PICKUP-NEXT.md the same session (recovered from git history, see that
> file's own header note). Lesson: verify a folder's real contents before trusting any CLAUDE.md's
> claim about what does/doesn't exist yet, this file included.
- `main.js` / `preload.js` / `package.json` — the whole app.
- `CURRENT_STATE.md` / `PICKUP-NEXT.md` — state files.
- `decisions/` — locked decisions (e.g. `D-085-fullscreen-overlay-tray-icon.md`).
- `void/` — archive, never deleted.
- `transcripts/`, `spec/`, `build/`, `certs/`, `dist/` — session transcripts, `HUB_BUILD_SPEC.md`,
  build assets (icon), dev signing cert, build output — real, not verified item-by-item this pass.
- `.github/workflows/gitleaks.yml` — secret scanning.
- No `MEMORY.md` yet, confirmed by this same listing — add it the first time this module has
  enough real history to need it.
