# Admin Hub Dashboard — Build Spec

> Translates the agreed D-057 design into a concrete technical spec a developer can build from. No
> code written yet. Lives here (Electron Shell) since this is the Hub's actual host — `main.js`'s
> `APP_URL` becomes this Hub instead of pointing straight at CBM. Three sections: server schema,
> API shape, UI wireframe. Source decision: `New Claude Work Env\decisions\D-057-admin-hub-
> dashboard-suite-wide.md` — read that first for the full verbatim design conversation; this file
> is the synthesis.
>
> Cross-module dependencies, read before touching any of them: PoPs Field's `_field-auth.js`
> (Admin login reuse), PoPs Field's + PoPs Procurement's `company-*` endpoints (Tier 1 data
> source), PoPs House's subscription registry export (likely entitlement source), D-029 (shared
> data folder mechanism, already used by CTC/CBM/PoPs Estimating/PoPs House).

---

## Section 1 — Server Schema

### Account Entitlement record (new — where "what does this account own" actually lives)

D-057 flagged this as unconfirmed; resolving it here as the build-spec author's call, same
pattern as other cross-module schema decisions in this suite (e.g. D-014's Gap 3).

```
account_entitlement:
  account_id:              string    (D-041's stable cross-module identity)
  company_id:               string    (PoPs Field/Procurement's own identity — same value once
                                       D-041's bootstrap flow runs, see PoPs Field's own
                                       field-bootstrap.js)
  modules:                    {
    ctc:                          { owned: boolean, tier: "sub"|"purchase"|null }
    cbm:                          { owned: boolean, tier: "sub"|"purchase"|null }
    pops_estimating:                { owned: boolean, tier: "sub"|"purchase"|null }
    aia_billing:                      { owned: boolean }   (free with CTC per D-034, no tier)
    pops_apm:                          { owned: boolean }  (free with CTC per D-034, no tier)
    labor_forecast:                      { owned: boolean, tier: "sub"|"purchase"|null }
    schedule_scope:                        { owned: boolean, tier: "sub"|"purchase"|null }
    pops_field:                              { owned: boolean }  (D-006 — always a subscription
                                                                  add-on, no purchase tier)
    pops_procurement:                          { owned: boolean }  (rides the same D-006 model as
                                                                    PoPs Field — no offline path)
  }
  last_synced_at:                              timestamp
```

**Source of truth, not re-invented here:** this record is a read-shaped projection built from
PoPs House's existing subscription registry export (`subscriptions_export.json` → published to
`Engine Server/data/subscriptions.json`, same mechanism D-041 already uses for CTC's own
cancelled/lapsed key rejection). The Hub's own entitlement endpoint (Section 2) reads that
existing registry rather than maintaining a second, competing source of truth.

### Hub Shared-Folder Config (new — D-057 Section 4's Admin-designated folder)

**Real constraint, not glossed over:** the File System Access API's directory handles are
per-browser-profile, non-transferable — the server can't literally hand a folder handle from the
Admin's machine to a PM's machine. What CAN be shared server-side is a human-readable label so
every employee's own "Connect Folder" action (already existing in CTC/CBM/PoPs Estimating/PoPs
House) points at the same real-world shared resource, not a different one by accident.

```
hub_shared_folder_config:
  account_id:               string
  folder_label:               string   (Admin's own descriptive name, e.g. "Company OneDrive —
                                        Shared Data", shown to every employee so they connect to
                                        the SAME resource, not blindly guess)
  set_by:                       user_id   (must be role "admin")
  set_at:                          timestamp
```

### Module Summary Export (file, NOT a server record — D-057 Section 4's Tier 2)

This is the file each CTC/CBM/PoPs Estimating instance writes into the shared folder every 3
hours while open. Lives on the client's own shared folder, never touches the Engine Server — the
whole point, per D-052. Documented here as a schema contract every writer + the Hub's own reader
must agree on, same role `subscriptions_export.json` already plays for PoPs House.

```
// File name convention: <module>_hub_summary_<account_id>.json — one per module per account, so
// multiple companies sharing one drive (agency/bookkeeper scenario) don't collide.

ctc_hub_summary.json:
  account_id:                 string
  module:                       "ctc"
  pushed_at:                       timestamp   (Hub shows "as of <this>" — the honest staleness
                                                signal D-057 already accepted as a real trade-off)
  jobs_active:                        integer
  budget_total:                          decimal
  actuals_total:                            decimal
  forecast_total:                              decimal
  over_budget_job_count:                          integer

cbm_hub_summary.json:
  account_id:                 string
  module:                       "cbm"
  pushed_at:                       timestamp
  bids_in_pipeline:                   integer
  bids_won_mtd:                          integer
  bids_lost_mtd:                            integer
  win_rate_mtd_pct:                            decimal

pops_estimating_hub_summary.json:
  account_id:                 string
  module:                       "pops_estimating"
  pushed_at:                       timestamp
  estimates_active:                   integer
  estimates_completed_mtd:               integer
```

**Real, deliberate limitation:** field lists above are a first-pass "what an owner actually glances
at" set, not exhaustive — expand per module as real usage shows what's actually useful, don't
front-load every possible metric before anyone's used this once.

### Purchase Request Log (new — not locked in D-057, recommended addition)

D-057's locked flow is a plain `mailto:` — no server round-trip required for it to work at all.
This record is a real, optional addition: logs the request server-side too, so admin.pops@gmail.com
has a durable list to work from even if a request email gets buried in the inbox. Cheap to add,
matches the suite's own "paperwork trail" pattern (PJT sync queue, manual procurement log, etc.).

```
hub_purchase_request:
  id:                     req_<uuid>
  account_id:               string
  requested_by:                user_id   (the Admin who clicked it)
  module:                        string   (e.g. "cbm")
  requested_at:                     timestamp
  status:                              "requested" | "fulfilled"   (manually flipped by whoever
                                                                    at PoPs actually ships the key
                                                                    — no automation implied)
```

---

## Section 2 — API Shape

### Entitlements (Hub's own core read)

```
GET /api/hub/entitlements     returns the account_entitlement projection (Section 1), built from
                               PoPs House's existing subscription registry — no new data entry
                               anywhere, just a read-shaped view of what already exists.
```

### Shared-folder label

```
PUT /api/hub/shared-folder-label     Admin only, sets folder_label (Section 1) — a name, not a
                                      path, since paths can't cross machines.
GET /api/hub/shared-folder-label     any employee's own module reads this so its own "Connect
                                      Folder" flow can prompt "connect to: <label>" instead of a
                                      blind picker.
```

### Tier 1 data (PoPs Field / PoPs Procurement) — no new endpoints

The Hub calls what already exists directly: `company-wts`, `company-pending-overtime`,
`company-timesheets` (PoPs Field); `company-pos`, `company-invoices`, `company-vendors`,
`company-manual-procurement...` (PoPs Procurement). Same Admin-role auth already built into each.
**Real, deliberate non-decision:** whether the Hub calls these live on every load, or a lightweight
`/api/hub/tier1-summary` aggregator endpoint gets added to reduce round-trips, is an
implementation detail for whoever actually builds this — not architecturally significant either
way, and premature to lock before real usage shows whether N calls vs. 1 aggregated call actually
matters.

### Purchase requests

```
POST /api/hub/purchase-request     logs a request (Section 1); fires alongside, not instead of,
                                    the mailto: link — the log is a backup trail, the email is the
                                    real notification mechanism, per D-057's own "make the
                                    paperwork" framing.
GET  /api/hub/purchase-requests    admin.pops@gmail.com's own follow-up list — likely surfaces in
                                    PoPs House, not the Hub itself (PoPs House is where pops
                                    already tracks client/sales activity).
```

---

## Section 3 — UI Wireframe

### First open — welcome/readme (D-057 Section 5)

Modal on first Hub load: thanks the Admin for using the suite, a brief plain-language description
of how the modules connect to each other (the same "Connected Suite Pipeline" story
`SUITE_KNOWLEDGE.md` already tells, written for a customer audience, not an internal one).
"Don't show this again" checkbox — once dismissed, stays dismissed (stored via the account
entitlement record or a simple per-account flag, not per-device, so it doesn't reappear if the
Admin opens the Hub on a second machine).

### Module grid (the Hub's main view)

- One tile per module (CTC, CBM, PoPs Estimating, AIA Billing, PoPs APM, Labor Forecast,
  Schedule & Scope, PoPs Field, PoPs Procurement).
- **Unlocked tile:** full color, shows its Tier 1/Tier 2 summary stats inline (whatever's real for
  that module per Section 1's schema — Tier 2 tiles show the "as of <pushed_at>" staleness
  timestamp visibly, never hidden), and is itself a launch button into the real module.
- **Locked tile:** dimmed/greyed, hover tooltip (2-second delay, matching the suite-wide Rule C
  standard) with a brief plain-language description of what that module does. Click → price popup.

### Locked-module popup

Shows the module's price (real numbers — not decided in D-057, a PICKUP-NEXT item for whoever
scopes real build work) and a "Request this module" button. Click → opens the OS default email
client via `mailto:admin.pops@gmail.com` with a pre-filled subject/body (account name, which
module, that it's a request pending payment) — same shape as PoPs Procurement's own
`buildMailtoLink()` helper, reusable pattern, not a new one to invent. Also fires
`POST /api/hub/purchase-request` (Section 2) in the background — failure there never blocks the
mailto action from happening, same "never let a background log call block the real user action"
principle already used in PoPs Procurement's RFQ email flow.

### Admin shared-folder setup (Tier 2's onboarding moment)

A settings panel on the Hub: "Connect your shared folder" — Admin picks/creates it once via the
same File System Access API picker every other module already uses, types a label (Section 1),
saves via `PUT /api/hub/shared-folder-label`. Each Tier 2 module (CTC/CBM/PoPs Estimating), on its
own "Connect Folder" action, reads that label back (`GET`) and shows it in its own picker prompt
("connect to: Company OneDrive — Shared Data") so every employee's local pick lands on the same
real-world folder — doesn't remotely configure anyone's machine, just removes the guesswork.

---

## What this spec does not decide

- **Real price list** for the locked-module popup — placeholder numbers only until pops supplies
  real ones.
- **Exact Tier 2 summary-export field lists beyond the first pass above** — expand per real usage,
  not speculatively.
- **Whether per-module Admin tabs (CTC's own, CBM's own, etc.) get deprecated, kept, or folded
  into the Hub over time** — D-057 flagged this explicitly as unresolved; a real product decision,
  not a technical one.
- **Exact 3-hour auto-push implementation per module** (timer placement, whether it skips writing
  if nothing changed since last push) — each of CTC/CBM/PoPs Estimating is its own codebase; this
  needs a real session in each one, not a single shared mechanism, since they don't share a code
  base the way PoPs Field/Procurement do.
- **Visual design/branding** of the Hub itself — functional wireframe only, above.
- **Whether the Tier 1 aggregator endpoint gets built** (Section 2's own flagged non-decision).

These are implementation-detail or product decisions for the actual build session, not
architecture — flagged here so they don't get silently assumed later.

---
*Synthesized 2026-07-31 from D-057 (agreed to as a whole same day). Append-only per suite
convention — if a decision changes, add a dated addendum section rather than rewriting the
affected block.*
