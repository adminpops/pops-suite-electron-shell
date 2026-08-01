# PICKUP-NEXT — top priorities for next session

> Created 2026-08-01 — this module didn't have this file before (its own CLAUDE.md said to add it
> "the first time this module has enough real history to need them"; today qualifies). Read at
> session open, alongside `CURRENT_STATE.md`.

## 🔴 TOP — capture this session's transcript first, attended

Per D-036 (main mount), a session's transcript can't be reliably captured from inside itself. The
session that built the Admin Hub end-to-end (2026-07-31 through 2026-08-01, "good build session
today, run transcrpt and go home") still needs capturing. First attended action next time this
folder opens: find it (`list_sessions`/`search_session_transcripts`), confirm `isRunning:false`
(`get_session`), pull it (`list_events`), write to `transcripts/<session-id>-<date>.md` (new
folder — create it).

## Real demo, pending (pops's own plan, "tomorrow" as of 2026-08-01)

Pops is creating a client with a second email account and installing the shell on another machine
as a demo. Needs, in PoPs House: a real client record, a CTC key (Hub login) AND a CBM key
(unlocks the CBM tile — the Hub needs both, not just the CTC key), then Export Subscription
Registry → send Claude the file → publish. Full detail: this file's own `CURRENT_STATE.md`,
2026-08-01 entries.

## Real, not-yet-started: Labor Forecast / Schedule & Scope server-side migration

Both apps still compute their real formulas entirely client-side (no calc endpoint exists for
either) — confirmed while deciding not to host them alongside the other 5 modules. Moving them
server-side is its own project, same size as the original CBM/CTC pivot (D-037/D-039) — needs a
real scoping session, not a quick add-on. Until then they stay `launch:null` in the Hub and
unhosted on Engine Server.

## Real installer/demo consequence, already accepted

`main.js`'s `APP_URL` now points at the Hub instead of straight at CBM (2026-08-01). The already-
published `v0.1.0` installer will show the Hub on its next real rebuild/update — pops confirmed
knowing this before the change. No action needed unless a rebuild happens and something looks
wrong.

---
*Update at every session close.*
