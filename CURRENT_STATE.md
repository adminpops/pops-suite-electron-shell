# CURRENT_STATE — Electron Shell (newest on top)

---

## 2026-07-29 — Module created and verified live, same session

Built during the D-053 suite-wide hardening session (opened in Schedule & Scope). Real fork
resolved directly with pops before building: his own source doc sketched a locally-bundled HTML
file, but his later words ("the html lives on our server") pointed the other way — asked, he said
host it.

**Built:** `main.js`/`preload.js`/`package.json`. Loads
`https://engine-server-5.vercel.app/app/cbm` (CBM's app, newly hosted on the Engine Server for
this purpose — see that repo's own history) in a native window with Electron's documented
security baseline for a remote-URL app (no Node access from the page).

**Verified — pops ran it himself, real machine, real window:** `npm install` (had to approve
electron's postinstall script once — `npm approve-scripts electron`, now recorded in
`package.json`), `npm start` opened a real window titled "Construction Bid Manager," pops logged
in and closed it: "it worked i loged out and closed, some areas where jumpy but cleared" (minor
rendering jumpiness on first load/resize, self-resolved, not investigated further).

**Not done:**
- Code-signing certificates (~$100–500/yr) — needed before any real distribution.
- Auto-update (`electron-updater`) — not wired in.
- CTC and PoPs Estimating aren't wrapped — only CBM.
- The "jumpy" rendering pops noticed hasn't been investigated — didn't recur badly enough to chase
  this session, worth a second look if it happens again.

**Blocked:** none. **Next:** pops's call — wrap another app, buy code-signing certs, or leave as
a working proof-of-concept until there's a real reason to distribute it.
