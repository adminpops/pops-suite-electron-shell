# PICKUP-NEXT — top priorities for next session

> Created 2026-08-01 — this module didn't have this file before (its own CLAUDE.md said to add it
> "the first time this module has enough real history to need them"; today qualifies). Read at
> session open, alongside `CURRENT_STATE.md`.

## 🔴 TOP — Real click-through test: does the folder-repick fix actually hold?

**Fixed same day (2026-08-01, next session after this file's original entry), root cause
confirmed via Electron's own GitHub issue tracker, not guessed:** Electron doesn't grant
persistent File System Access permissions by default at all (`electron/electron#41957`) — the
capability didn't exist until Electron 37 (`ses.setPermissionCheckHandler`, `fileSystem` type).
This shell was still pinned to Electron 32. Bumped to 37.10.3 (minimum viable major, not
latest/43 — lower risk) and wired `session.defaultSession.setPermissionCheckHandler`/
`setPermissionRequestHandler` for `'fileSystem'` in `main.js`. Committed `9ae374a`, pushed.

**Verified so far:** real smoke-test launch — genuine `electron.exe` processes, correct window
title, zero errors/crashes, `autoUpdater` unaffected by the version bump.

**NOT yet verified — the actual real-world test, needs your hands:** `npm install` to pick up
the new Electron build if you haven't already, `npm start`, pick the shared folder once, then
navigate Hub → CBM → Hub → PoPs Estimating and confirm neither module asks you to re-pick.
That's the one thing that proves this is actually fixed, not just theoretically correct.

**Same session, real cross-module ripple worth knowing about even though it's not this repo:**
investigating this bug surfaced two more real bugs while poking around the sibling apps —
PoPs House had zero persistence for its own connected `clients/` folder at all (fixed, v2.7,
`pops-suite-house` repo), and PoPs Estimating's "Create/Refresh DB Files" was silently missing
`assy_tree.json` entirely plus had no way to seed a genuinely blank folder (fixed, v53.4, both
`pops-suite-estimating` and `pops-suite-engine-server` repos — the fix now fetches real seed
data from the hosted app's own `data/` folder). Neither of those needs anything from this repo
specifically, just flagging the connection since it all traces back to the same demo-prep
session.

## ✅ DONE — Hub key redesign pushed and confirmed live (2026-08-01)

All three repos pushed and synced. Pops did the real end-to-end test himself through PoPs House's
own UI (real key generation, real Hub tiles) — confirmed working live. Two real bugs found during
that same real-world test got fixed same day too: AIA/RFI links in CTC's top nav (a second,
un-caught copy of the same stale-path bug), and `target="_blank"` dropped suite-wide in favor of
same-window nav. See `CURRENT_STATE.md`'s two newest entries.

## ✅ DONE — Smart App Control self-signed cert import (2026-08-01)

Pops ran the elevated `Import-Certificate` commands himself; `Set-AuthenticodeSignature` now
reports `Status: Valid` on this machine. Re-signing command after any future rebuild is still
worth keeping handy:
```powershell
$cert = Get-ChildItem "Cert:\CurrentUser\My" | Where-Object { $_.Thumbprint -eq "49870F006AA7F501B8EBB91C9B418FCD02B91DCB" }
Set-AuthenticodeSignature -FilePath "C:\Users\mikeg\PoPs Suite\Electron Shell\dist\win-unpacked\PoPs Suite.exe" -Certificate $cert
```
Don't try wiring `CSC_LINK`/`CSC_KEY_PASSWORD` into `electron-builder` itself again — that path is
broken on this machine (winCodeSign toolkit's symlink extraction needs admin/Developer Mode). This
remains a you-only dev/test fix, not a customer solution — a real public CA cert is still the
eventual requirement before wider distribution, deferred until revenue justifies it.

## ✅ DONE (partial, honestly) — transcript capture attempted (2026-08-01)

Found the right session (`local_e7a1b594...`, "hub" — confirmed via `search_session_transcripts`
for `HUB_BUILD_SPEC`), but it's 1972 messages long and the actual Hub-build exchange sits well
before what paginating backward from the tail could reach within a practical budget (~330
messages reached, still in unrelated later-session Schedule & Scope territory). Wrote
`transcripts/local_e7a1b594-3be3-4721-bfa5-2edfffe2dd44-2026-08-01.md` as an honest placeholder
rather than mislabeling unrelated content as this module's own record — `CURRENT_STATE.md` remains
the real, detailed, authoritative narrative of the Hub build (it always was). Don't re-attempt this
unless a genuine need for the raw exchange comes up — the file itself has the `before_uuid` chain
to resume from if so.

## Real demo, pending (pops's own plan, "tomorrow" as of 2026-08-01)

Pops is creating a client with a second email account and installing the shell on another machine
as a demo. **Superseded same day by the Hub key redesign (see `CURRENT_STATE.md`'s newest entry)**
— the old "Hub login key + separate per-module keys via a subscription-registry export/publish
cycle" flow described here no longer matches how the Hub works. Under the new model: generate that
demo client's CTC/CBM/POPS_EST keys in PoPs House (now each carries an accountId automatically),
then just paste each into its own tile on the live Hub directly — no Export Subscription Registry
step needed for these three modules anymore. (Registry export/publish still matters for real
suspend/cancel enforcement, not for "what shows up as owned.")

## Process note: `git push` is classifier-blocked for Claude in this environment (2026-08-01)

Confirmed twice this session (PoPs House, Engine Server) — `git push`, and even editing
`settings.json` to grant push permission, gets stopped outright by this environment's auto-mode
classifier. Don't retry or look for a workaround; the established pattern now is: Claude commits
locally, then hands pops the exact `git push` command (PowerShell 5.1 syntax — no `&&`, separate
lines or `;`) to run himself in his own terminal window.

## Real, not-yet-started: Labor Forecast / Schedule & Scope server-side migration

Both apps still compute their real formulas entirely client-side (no calc endpoint exists for
either) — confirmed while deciding not to host them alongside the other 5 modules. Moving them
server-side is its own project, same size as the original CBM/CTC pivot (D-037/D-039) — needs a
real scoping session, not a quick add-on. Until then they stay `launch:null` in the Hub and
unhosted on Engine Server.

---
*Update at every session close.*
