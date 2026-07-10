# Dev Updates

## 2026-07-10 ~00:05 CT — Phase 5 follow-up: approved billing convention + project assignments applied (Claude Code)

**AI model:** Claude Sonnet 5 (Claude Code)

### Summary

User reviewed the Phase 5 dry run below and approved four decisions; this
pass updates the dry-run engine, tests, and UI to reflect them exactly, then
runs the full verification suite and commits (not pushed). Still zero Notion
writes, zero SQLite writes - only the preview's own analysis logic changed.

### Decision 1 — billing convention

Amounts are now computed strictly as `exactMinutes / 60 × hourlyRate`,
rounding only the final dollar total to cents; per-entry `totalHours` is now
the exact (unrounded) value rather than hours pre-rounded to hundredths.
Concretely:

- `ProposedHoursRecord.totalHours`/`.expectedAmount` are now the exact-minute
  values (e.g. the July 8 2:05-5:00 PM row is `2.9166666667h` / `$87.50`).
- The old app-convention figures (`computeTotalHours`→`computeAmount`, which
  rounds hours to hundredths first) are retained only as clearly-labeled
  `referenceAppRoundedHours`/`referenceAppRoundedAmount` fields - informational,
  never used in any calculation.
- `totals.totalInvoiceAmount` is now **exactly $311.00** (sum of exact
  per-session hours × rate, rounded once), matching the historical Hours
  Worked page. `totals.referenceAppConventionTotal` ($311.10) documents what
  the rejected convention would have produced.
- `totals.discrepancies` is now empty for this dataset - the earlier
  reported $0.10 gap is resolved by this decision, not just noted.
- New `billing-convention-approved` warning (info-severity), scoped to the
  one row where the two conventions actually differ
  (`hrs-2026-07-08-s2`), documents the decision and the rejected figure.

### Decision 2 — project assignments

Replaced the keyword-derived (partly ambiguous/unassigned) project matches
with an explicit, user-approved table
(`APPROVED_PROJECT_ASSIGNMENTS` in `source-data.ts`), which `dry-run.ts`'s
`buildHours()` now prefers whenever a session has an entry:

| Session | Project |
|---|---|
| 2026-07-08 09:00-11:00 (non-billable onsite) | none (explicit) |
| 2026-07-08 11:00 AM-1:00 PM | BOL Review Process V2 |
| 2026-07-08 2:05-5:00 PM | Power Automate Documentation |
| 2026-07-08 5:10-5:49 PM | AFP Command Center / Sales & Operations Hub |
| 2026-07-09 9:12 AM-2:00 PM | BOL Review Process V2 |

The `unassigned-project`/`multi-project-session` warnings no longer fire for
any of the five sessions (the fallback keyword-matching logic is retained
for any future session without an explicit approval, but nothing here needs
it now); a new `project-assignments-approved` info note covers all five
instead, citing the 2026-07-10 approval.

### Decision 3 — July 9 work log

`APPROVED_WORK_LOG_PROJECTS` in `source-data.ts` sets `wl-2026-07-09`'s main
`projectKey` to `bolReviewV2` and a new `relatedProjectKeys: [commandCenter,
powerAutomateDocs]` field (added to `ProposedWorkLogRecord` in `types.ts`,
since the domain `WorkLog` schema only supports a single `projectId` - this
metadata is preserved in the *preview* record, flagged for the user rather
than silently dropped if a real migration is built later). A generated
`relatedProjectsNote` string and secondary "+ project" badges in the UI
carry the same cross-reference into the visible summary. New
`worklog-related-projects-preserved` info warning documents this.

July 8's work log now spans **three** distinct approved projects (one per
session) with no single "main" specified by the user for that day - left
`projectKey: null` with `relatedProjectKeys` listing all three, reusing the
existing `worklog-multi-project` warning code (reworded to info-severity
since it's no longer an unresolved ambiguity, just a busy day). Flagged to
the user as a judgment call, not something explicitly instructed.

### Changes made

- `src/lib/notion/migration/types.ts` - `ProposedHoursRecord`,
  `ProposedWorkLogRecord`, `DayTotals`, `SessionTotal`, `ReconciliationTotals`
  reshaped per the decisions above; `schemaVersion` bumped `1` → `2`.
- `src/lib/notion/migration/source-data.ts` - added
  `APPROVED_PROJECT_ASSIGNMENTS` and `APPROVED_WORK_LOG_PROJECTS`.
- `src/lib/notion/migration/dry-run.ts` - `buildHours()`/`buildWorkLogs()`
  now prefer the approved tables over keyword matching; `buildTotals()`
  rewritten to sum exact hours × rate and round once; warning set updated
  (`billing-convention-approved`, `project-assignments-approved`,
  `worklog-related-projects-preserved` added; `rounding-convention-discrepancy`
  retired in favor of the above).
- `src/features/settings/migration-preview/components/migration-preview-view.tsx` -
  removed the now-redundant "exact" vs "app" dual columns (a single
  authoritative value per field now), added a "Billing convention (approved
  2026-07-10)" explainer card, added related-project badges + note on work
  logs, kept a small "(ref: $X)" annotation only on the one row where the
  rejected convention would have differed.
- `docs/notion-migration-plan.md` and this file - unchanged by this pass
  (the Phase 5 approval checklist added last time already anticipated this
  review step).

### Tests updated (107/107 passing, net +2 from the prior pass)

Rewrote `dry-run.test.ts` for the new shape and decisions: exact-hours as
the proposed value, `$311.00` total with `discrepancies: []`, per-session
approved project assertions (exact map of session id → project key),
`referenceAppConventionTotal` still reporting $311.10 as reference-only, and
the new July 8/July 9 related-project assertions.
`calculations.test.ts`/`project-matcher.test.ts`/`no-write-path.test.ts`
unchanged and still pass unmodified (the underlying `calculateSession`
utility and keyword matcher didn't need to change - only how `dry-run.ts`
uses their output changed).

### Final verification suite

- `npm run lint` - pass (0 errors, 0 warnings).
- `npm run typecheck` - pass.
- `npm test` - pass (107/107).
- `npm run build` - pass; same 24 routes as the prior Phase 5 pass.

### Browser verification performed

Re-ran `/settings/migration-preview` end to end: Reconciliation card now
shows a single `$311.00` (no exact/app split), the new "Billing convention
(approved 2026-07-10)" card citing the rejected $311.10 reference, and no
"Discrepancies found" callout (list is empty). Extracted the Proposed hours
table's cell contents directly via DOM query to confirm every row against
the approved-assignment table exactly: all five sessions matched their
specified project (or "Unassigned" for the non-billable onsite row), and
the `$87.50 (ref: $87.60)` annotation appears on exactly one row
(`2026-07-08 14:05-17:00`) - nowhere else. Confirmed the July 8 work log
shows "Unassigned" primary with three "+ project" badges, and July 9 shows
"BOL Review Process V2" primary with "+ AFP Command Center..." and "+ Power
Automate Documentation" badges plus the generated cross-reference note.
Checked `preview_console_logs` at `error` level and `preview_network` for
failed requests after every navigation - zero errors, zero failed requests.

### Confirmations

- No Notion API call and no SQLite write in this pass either - only the
  pure analysis logic in `src/lib/notion/migration/` and its test/UI
  callers changed.
- `NOTION_SYNC_ENABLED` and `.env.local` untouched.
- Committed this pass (see commit hash in the final report) - **not
  pushed**, per instruction.

---

## 2026-07-09 ~23:15 CT — Phase 5: historical migration dry run (preview-only, Claude Code)

**AI model:** Claude Sonnet 5 (Claude Code)

### Summary

Phase 5 per the user's brief: build a one-time migration **dry-run** system
that previews exactly what migrating the historical AFP-Work Notion pages
("Hours Worked", "Work Done" → "July 8, 2026" / "July 9, 2026") would create
— proposed client/projects/hours/work-log records, fully reconciled totals,
warnings, and duplicate detection — without performing any write. No Notion
API call is made by this feature at all (the source content was read once,
read-only, via Notion's search/fetch tools, then transcribed into a
versioned fixture) and no SQLite row is inserted/updated/deleted anywhere in
it. `NOTION_SYNC_ENABLED` stays unset/false throughout, untouched. Not
committed yet — awaiting the user's review.

### Source records read (read-only, via Notion search/fetch)

| Page | Notion ID |
|---|---|
| Hours Worked | `3984259d-cffa-81be-930a-ca4ef072d72a` |
| Work Done | `3984259d-cffa-81aa-a638-e428d0bcf252` |
| July 8, 2026 | `3984259d-cffa-81a4-91d8-ca2e268546b5` |
| July 9, 2026 | `3984259d-cffa-816a-9132-ff82206e7651` |

Transcribed verbatim (times, workstream labels, notes, summaries,
invoice-ready description blocks) into
`src/lib/notion/migration/source-data.ts` so the dry-run engine is
deterministic and testable without a live Notion connection.

### What was built

1. **`src/lib/notion/migration/`** (new directory, no `server-only` in the
   engine files so it's directly unit-testable):
   - `types.ts` — result shape (`MigrationDryRunResult`), proposed-record
     types, provenance, warnings, reconciliation totals.
   - `source-data.ts` — the transcribed fixture (raw sessions, raw work
     logs, source-stated totals, the known stale-header/gap facts).
   - `calculations.ts` — session-level time/rate math, reusing
     `src/lib/calculations.ts`'s existing `minutesBetween`/
     `computeTotalHours`/`computeAmount` rather than reimplementing rounding
     rules. Computes both an "exact" (unrounded-hours) and an
     "app-convention" (matches what the existing Hours flow would actually
     store) figure per session, plus the discrepancy between them.
   - `project-matcher.ts` — generic keyword-based project matcher
     (candidates + priority order), independent of the AFP fixture so it's
     testable with synthetic inputs.
   - `dry-run.ts` — `buildMigrationDryRun()`: pure orchestration, no Notion
     client, no SQLite, no `Date.now()`/`Math.random()`. Derives proposed
     records, matches projects, reconciles totals, and generates warnings.
   - `read-existing.ts` (`server-only`) — the *only* file here that touches
     SQLite, and only via `repo.all()` reads, for duplicate detection.
2. **`GET /api/notion/migration-preview`** — thin route: read-only snapshot
   + `buildMigrationDryRun()`, wrapped in try/catch, `NextResponse.json`.
3. **Settings UI** — new "Historical Migration Dry Run" card
   (`migration-preview-card.tsx`) linking to a dedicated route,
   `/settings/migration-preview` (`migration-preview-view.tsx`): source
   pages, reconciliation (with a discrepancies callout), proposed
   client/projects/hours/work-logs tables, warnings, skipped/duplicates, and
   Download JSON / Copy JSON buttons (client-side blob/clipboard — no extra
   endpoint). Fetches automatically on mount (unlike the Notion connection
   checks, this makes zero external calls, so there's no "don't hammer
   Notion" reason to gate it behind a button) with a manual "Re-run".
4. **`docs/notion-migration-plan.md`** — new "Phase 5 — dry-run preview"
   section with an explicit approval checklist (review every hours row,
   every project assignment, approve totals, confirm duplicate protection,
   explicit approval before any write-mode code is even written).

### Proposed client

**Anytime Fuel Pros** — $30.00/hr, **America/Chicago** (stated explicitly on
the Hours Worked page; differs from the app's generic default of
`America/New_York` used in mock seed data — flagged as a warning, not
silently overridden), status `active`.

### Proposed projects (3, derived — not the user's candidate list assumed blindly)

Derived by keyword-matching each session's workstream text and each work
log's body against the three candidates the user suggested; all three were
actually evidenced in the source content, so all three are proposed:

- **BOL Review Process V2** — matched by the July 9 session text and
  extensively evidenced in both day logs' narrative.
- **AFP Command Center / Sales & Operations Hub** — matched by "Command
  Center" in the July 9 session text and the day log's "Created a ... Notion
  page ... for the Command Center plan."
- **Power Automate Documentation** — matched by the July 8 2:05–5:00 PM
  session text ("technical documentation and Power Automate support") and
  the "Power Automate Flow Map" page creation mentioned in the July 9 log.

Two sessions (July 8, 11 AM–1 PM "AFP work"; July 8, 5:10–5:49 PM "website
and operations planning") matched **none** of the three and were left
**unassigned** rather than guessed — flagged as warnings. The July 9 session
matched **two** projects at once (BOL Review Process V2 *and* Command
Center) — flagged as an ambiguous multi-project session; its primary pick
(BOL Review Process V2) is a best-effort default, not a confident
assignment, and the July 9 work log's own project was left unassigned as a
result (its only session is itself ambiguous).

### Proposed hours (5 rows — every historical billable *and* non-billable session)

| Date | Start–End | Billable | Hours (app / exact) | Amount (app / exact) | Project |
|---|---|---|---|---|---|
| 2026-07-08 | 09:00–11:00 | No | 2.00 / 2.0000 | $0.00 | — (onsite, non-billable) |
| 2026-07-08 | 11:00–13:00 | Yes | 2.00 / 2.0000 | $60.00 / $60.00 | unassigned |
| 2026-07-08 | 14:05–17:00 | Yes | 2.92 / 2.9167 | $87.60 / $87.50 | Power Automate Documentation |
| 2026-07-08 | 17:10–17:49 | Yes | 0.65 / 0.6500 | $19.50 / $19.50 | unassigned |
| 2026-07-09 | 09:12–14:00 | Yes | 4.80 / 4.8000 | $144.00 / $144.00 | BOL Review Process V2 (ambiguous) |

### Proposed work logs (2 — July 8, July 9)

Both `status: done`, `priority: medium` (not stated in source, defaulted —
flagged). July 8 → Power Automate Documentation (its only identified
project); July 9 → unassigned (its one session is multi-project).
July 9's `invoiceDescription` concatenates **three** separate "Invoice-
Ready" blocks found on that page (main, midday add-on, end-of-day) —
flagged, since the page itself never states which is canonical.

### Recalculated totals — the source's "10.37 hours / $311.00" was *not* assumed, it was recalculated

- **Billable hours:** 10.37 (app-convention, matches source) / **10.3667**
  exact (unrounded) — both round to the source-stated 10.37.
- **Non-billable hours:** 2.00 (the July 8 9–11 AM onsite block).
- **Invoice amount — a real, reportable rounding discrepancy found:**
  - **Exact-minute total: $311.00** — matches the source page's own stated
    total exactly.
  - **App-convention total (using this app's existing
    `computeTotalHours`→`computeAmount` pipeline, which rounds elapsed time
    to hundredths of an hour *before* multiplying by rate): $311.10** — ten
    cents higher.
  - **Root cause, isolated to one row:** the July 8 2:05–5:00 PM session is
    175 minutes = 2.91666...7h exactly (→ $87.50 at $30/hr), but
    `computeTotalHours` rounds that to 2.92h *before* the rate multiply →
    2.92 × $30 = $87.60. Every other session's minutes happen to land on a
    clean hundredth of an hour, so this is the only row affected — but it's
    enough to move the reconciled total by $0.10. If this data were entered
    through the app's normal Hours flow as-is, it would store $311.10, not
    the $311.00 the Notion page currently shows. Surfaced explicitly in the
    UI's "Discrepancies found" callout and in `totals.discrepancies`, not
    silently resolved either way — the user needs to decide which
    convention a real migration should use.
- **Per-day:** July 8 → 5.57h / $167.00 (both conventions agree — the
  affected row's $0.10 gap doesn't change the 2-decimal display for that
  day in isolation, only the running total); July 9 → 4.80h / $144.00. Both
  match the source pages' own stated per-day figures exactly.

### Tests added (55 new, 105/105 total passing)

- `calculations.test.ts` — time calculation, rate calculation, rounding
  behavior (including the exact $0.10 discrepancy case above,
  hand-verified), ambiguous/missing-time handling (identical start/end,
  break exceeding span, midnight wraparound).
- `project-matcher.test.ts` — project derivation as a generic, fixture-
  independent function: single match, no match, ambiguous multi-match,
  priority-order tie-breaking, empty candidate list.
- `dry-run.test.ts` — historical session parsing, proposed client/projects/
  hours/work-logs shape, full totals reconciliation against source-stated
  figures, warning generation, duplicate detection (client/hours/work-log,
  parameterized against a fake existing-records snapshot — no real DB
  needed), determinism (`buildMigrationDryRun()` called twice with the same
  input `toEqual`s), and that `writesPerformed`/`notionWritesPerformed`/
  `sqliteWritesPerformed` are always `false`.
- `no-write-path.test.ts` — static source-text scan across every file in
  `src/lib/notion/migration/` plus the API route, asserting none of them
  contain `.insert(`, `.update(`, `.delete(`, `.remove(`, `pushEntity`,
  `pullDatabase`, `syncEntityNow`, `runFullSync`, `pages.create`,
  `pages.update`, or `dataSources.query`. (Importing `read-existing.ts`
  directly in a test isn't possible under plain-node vitest — it pulls in
  `server-only` repository modules, and the `server-only` package throws
  outside a react-server/webpack context, same reason
  `schema-requirements.test.ts` avoided it in Phase 3 — so this is a
  source-scan guardrail rather than a mocked runtime call, deliberately.)

### Final verification suite

- `npm run lint` — pass (0 errors, 0 warnings; one `react/no-unescaped-
  entities` caught and fixed during this pass).
- `npm run typecheck` — pass.
- `npm test` — pass (105/105 — 50 from Phase 4 + 55 new).
- `npm run build` — pass; `/api/notion/migration-preview` and
  `/settings/migration-preview` compile alongside the existing 24 routes.

### Browser verification performed

Started a dev server and exercised `/settings/migration-preview` directly:
source-records cards (4 pages, correct "read Xh ago" timestamps),
reconciliation card (10.37h / $311.10 app / $311.00 exact / $311.00
source-stated, "Matches source-stated totals" badge, the discrepancies
callout with both $0.10 explanations), per-day totals table, proposed
client/projects/hours/work-logs sections all rendered with the exact
figures above, warnings list (10 distinct warning codes with correct
`relatedIds`), "Skipped / duplicates (0)" (correct — nothing has been
migrated yet, so nothing collides), and the Export card. Clicked **Copy
JSON** — succeeded (clipboard write, success toast). Verified the new
"Historical Migration Dry Run" card renders correctly on `/settings` and
links through. Checked `preview_console_logs` at `error` level and
`preview_network` for failed requests after every navigation/interaction —
zero errors, zero failed requests throughout.

### Confirmations

- **No Notion API call was made by this feature.** Grepped
  `src/lib/notion/migration/` and the new route: no `notion.*` client call
  anywhere — the source content is a transcribed fixture, not a live fetch.
  The only Notion reads this whole phase performed were the one-time
  `notion-search`/`notion-fetch` calls used to transcribe the fixture
  before writing any code, both explicitly read-only tools.
- **No SQLite write occurred.** `read-existing.ts` calls only `repo.all()`;
  statically verified (see `no-write-path.test.ts`) that no
  `insert`/`update`/`delete`/`remove` call exists anywhere in this feature.
- **`NOTION_SYNC_ENABLED` was never touched** — remains unset/false exactly
  as before this phase.
- **Local mock mode and existing SQLite data are untouched** — the current
  seeded client is still "AFP" at $65/hr (mock data), not "Anytime Fuel
  Pros"; nothing in this phase seeds, migrates, or deletes anything.
- **Nothing was committed.** Awaiting the user's review of the proposed
  records, the $0.10 rounding-convention discrepancy, and the ambiguous
  project assignments before this is committed — and, separately, before
  any write-migration code is even written (see the new Phase 5 approval
  checklist in `docs/notion-migration-plan.md`).

### Deliberately not built this phase

Per explicit instruction: no write endpoint, no `NOTION_SYNC_ENABLED=true`,
no actual migration of data into Notion or SQLite. This phase is
preview-only end to end.

---

## 2026-07-09 ~22:10 CT — Phase 4: real AFP Notion databases created and mapped (Claude Code)

**AI model:** Claude Sonnet 5 (Claude Code)

### Summary

Phase 4 per the user's brief: created all six real Notion databases the app
needs, using the connected Notion MCP integration (same "Battle Bound
Branding" workspace the app's own integration is scoped to), wired their ids
into `.env.local`, and ran the read-only verification tool. All six came back
`configured`, `accessible`, and `schemaValid` on the first check - zero
schema mismatches, so **zero application code changes were needed** this
phase. `NOTION_SYNC_ENABLED` stays unset/false throughout. Not committed yet
- awaiting the user's review of the final report (nothing to commit anyway,
since no tracked files changed - see below).

### Structure deviation found and deliberately not corrected

Live inspection (via Notion search/fetch) showed `Power Automate Flow Map`
and `AFP Command Center / Internal Sales & Operations Hub Plan` are direct
children of `AFP-Work`, not nested under `Work Stuff` as the user's target
diagram showed. Per the explicit "do not move existing pages" rule, these
were left exactly where they are. Only a new `Knowledge Database` was added
as a child of `Work Stuff` (which had no children before this phase).

### Databases created (all via Notion MCP `notion-create-database`, additive only)

| Database | Notion ID | Parent page | Entity |
|---|---|---|---|
| Clients Database | `f1ce565d-fe7d-4223-9194-3891851099a6` | AFP-Work | `client` |
| Projects Database | `0bcf7825-268a-412c-a102-bb76040eea63` | AFP-Work | `project` |
| Hours Worked Database | `a192465a-4bbe-442e-86a5-255db6d65df6` | Invoice Details | `hours` |
| Work Done Database | `69e74fe8-dcba-48cc-92a7-5ede949342e6` | Invoice Details | `worklog` |
| Invoice Reports Database | `648e1260-58eb-431d-9ca9-da7c0088f8ef` | Invoice Details | `invoice` |
| Knowledge Database | `d5a5ce19-1061-4747-9480-962187edde24` | Work Stuff | `knowledge` |

Each schema was built directly from `NOTION_PROPERTY_REQUIREMENTS` in
`src/lib/notion/schema-requirements.ts` (property name + exact type per
field), with `SELECT`/`MULTI_SELECT` option values taken from the domain
types in `src/types/domain.ts`. Verified each database's returned schema
immediately after creation via `notion-fetch` before moving to the next one.

The existing `Hours Worked` and `Work Done` *pages* under Invoice Details
were left completely untouched - the new `Hours Worked Database`/`Work Done
Database` are separate siblings, not replacements. Confirmed via
`notion-fetch` on `AFP-Work`, `Invoice Details`, and `Work Stuff` after all
six were created: every pre-existing child page is still present, in its
original position, with only the six new databases appended after them.

### `.env.local` updated

Added all six `NOTION_DATABASE_*` ids (see table above). `NOTION_SYNC_ENABLED`
remains unset (defaults to `false`). Confirmed still gitignored/untracked
(`git ls-files --error-unmatch .env.local` fails, `git check-ignore -v` shows
`.gitignore:34:.env*`).

### Read-only verification results

`GET /api/notion/verify-databases` (run via `curl` against a local dev
server, then re-run through the actual "Verify databases" button in
Settings): **all six databases reported `configured: true`, `accessible:
true`, `schemaValid: true` on the first check - `ready: true` overall, zero
missing/wrong-type properties.** This means the databases were already
accessible to the app's "AFP Contractor Workspace" integration (inherited
share permission from a parent page), so the manual "share with integration"
step turned out to be unnecessary - nothing needed fixing or re-checking.

`GET /api/notion/status` immediately after: `syncEnabled: false`,
`configuredDatabases` lists all six, `missingDatabases: []`, and critically
the automatic startup sync logged `entitiesSynced: 0, conflicts: 0, errors:
0` with message *"Notion sync is disabled (NOTION_SYNC_ENABLED is not
'true')..."* - hard proof that having all six real database ids configured
did not trigger any read or write against Notion, even on the automatic
startup sync.

Browser-verified in Settings: Notion Connection card shows "Connected · 6/6
databases mapped"; Notion Database Mapping card shows all six as "Ready"
with green Configured/Accessible/Schema valid indicators; toast read
"Read-only mapping ready — all six databases check out." Zero console
errors.

### Property changes made

None. Every property matched on the first attempt - no additive fixes were
necessary.

### Final verification suite

- `npm run lint` - pass (0 errors, 0 warnings).
- `npm run typecheck` - pass.
- `npm test` - pass (50/50, unchanged from Phase 3 - no code changed this
  phase).
- `npm run build` - pass; same 22 routes as Phase 3 (no new routes needed).

### Confirmations

- **Live write sync remains disabled**: `NOTION_SYNC_ENABLED` unset/false;
  `syncEnabled: false` confirmed via `/api/notion/status`; the startup sync's
  `entitiesSynced/conflicts/errors` all `0` proves no read or write occurred.
- **No existing Notion content was modified**: confirmed via `notion-fetch`
  on all three parent pages post-creation - every pre-existing child (Hours
  Worked, Work Done, Power Automate Flow Map, AFP Command Center) is present,
  unchanged, in its original position.
- **July 8 / July 9 historical entries were not migrated**: no pull was
  performed (gated by `NOTION_SYNC_ENABLED=false`), and nothing in this
  phase read row-level content from any database or existing page.
- **Nothing was committed.** The only tracked-file change this phase is this
  `DevUpdates.md` append (no application code was touched); `.env.local` was
  also updated but stays gitignored/untracked.

### Exact next step for historical data migration

Per `docs/notion-migration-plan.md`, migrating the July 8/July 9 Hours
Worked and Work Done entries into the new databases is a separate, not-yet-
approved step requiring `NOTION_SYNC_ENABLED=true`. It has intentionally not
been started.

---

## 2026-07-09 ~21:30 CT — Phase 3: real Notion database creation and read-only mapping (Claude Code)

**AI model:** Claude Sonnet 5 (Claude Code)

### Summary

Phase 3 per the user's brief: identify the exact six databases the app
needs, document schemas for all of them, add a fully read-only database
verification feature, surface it in Settings, write a non-destructive
migration plan for the user's existing "Hours Worked"/"Work Done" pages, and
add tests - all without enabling any write synchronization. Not committed
yet - pending the user's review of the final report.

### Key finding: the existing architecture needed a new gate

Before this phase, "database id is set" was the *only* condition gating
both push (`syncEntityNow`/`pushEntity`) and pull (`pullDatabase`/
`runFullSync`) in `src/lib/notion/sync-engine.ts`. That's a problem for this
phase specifically: verifying a real database's schema requires setting its
real `NOTION_DATABASE_*` id, but doing so under the old code would have
silently armed both push-on-edit *and* the automatic startup/interval pull
- i.e. simply configuring an id for schema-checking purposes would already
start pulling real Notion rows into local SQLite, which directly conflicts
with "do not perform the migration yet" and "do not enable write
synchronization."

Fix: added a new master switch, `NOTION_SYNC_ENABLED` (default `false`/off),
checked independently in `config.ts` (`NotionConfig.syncEnabled`) and gated
inside `pushEntity`, `pullDatabase`, and as an early-return in `runFullSync`
in `sync-engine.ts`. Database ids can now be set purely for schema
verification (which never checks this flag - see below) without arming any
real read/write until the user explicitly sets `NOTION_SYNC_ENABLED=true`.

### The exact six databases (derived from code, not guessed)

From `NotionDatabaseMap` in `src/lib/notion/config.ts` and `NOTION_SCHEMA` in
`src/lib/notion/mappers.ts`: **client, project, hours, worklog, knowledge,
invoice** - matching `NOTION_DATABASE_CLIENTS/PROJECTS/HOURS/WORKLOGS/
KNOWLEDGE/INVOICES`. Mapped against the user's existing Notion tree:

| Entity | Env var | Existing Notion page |
|---|---|---|
| hours | `NOTION_DATABASE_HOURS` | Hours Worked |
| worklog | `NOTION_DATABASE_WORKLOGS` | Work Done |
| invoice | `NOTION_DATABASE_INVOICES` | Invoice Reports |
| knowledge | `NOTION_DATABASE_KNOWLEDGE` | Work Stuff |
| client | `NOTION_DATABASE_CLIENTS` | none - needs a new database |
| project | `NOTION_DATABASE_PROJECTS` | none - needs a new database |

The sixth (previously unlabeled) database is **Clients** - it falls out
directly from `NotionDatabaseMap` having exactly six keys once
hours/worklog/invoice/knowledge/project are accounted for; nothing was
guessed.

### Changes made

1. **`src/lib/notion/schema-requirements.ts`** (new, pure, no `server-only`
   so it's directly unit-testable) - `NOTION_PROPERTY_REQUIREMENTS` (exact
   property name + expected Notion type per entity, mirroring the push
   builders in `mappers.ts`), `NOTION_DATABASE_ENV_VARS` (single source of
   truth for env var name + label, now also used by
   `notion-connection-card.tsx` instead of a local duplicate), and pure
   functions: `validateProperties`, `isSchemaValid`, `invalidProperties`,
   `detectDatabaseConfiguration`, `isDatabaseReady`, `isMappingReady`.
2. **`src/lib/notion/verify-databases.ts`** (new, `server-only`) -
   `verifyNotionDatabases()`: for each configured database, calls
   `notion.databases.retrieve` then `notion.dataSources.retrieve` (both
   read-only GETs returning schema metadata) and validates the result
   against the pure requirements above. Never calls `dataSources.query`
   (which would read row content) and never calls any create/update/
   archive/delete endpoint.
3. **`GET /api/notion/verify-databases`** - thin route wrapper, read-only.
4. **Settings UI** - new `NotionMappingCard`
   (`src/features/settings/components/notion-mapping-card.tsx`) showing,
   per database: database name, configured/not, accessible/not, schema
   valid/not, the specific missing-or-wrong-type properties, and an overall
   "Read-only mapping ready" badge. Manual "Verify databases" trigger (not
   polled, to avoid hammering Notion). `NotionConnectionCard` gained a
   "Sync enabled"/"Sync disabled (read-only)" badge and now surfaces the
   last sync log's message text directly (previously only the timestamp was
   shown, so "sync is disabled" feedback was invisible).
5. **`.env.example`** - added `NOTION_SYNC_ENABLED=false` with an
   explanation of what it does and doesn't gate; the six `NOTION_DATABASE_*`
   vars were already present from Phase 2.
6. **`docs/notion-migration-plan.md`** (new) - maps the user's existing
   Notion tree to entities, spells out exactly what pull/push do and don't
   touch, flags the "Work Stuff" ambiguity (may be a plain page, not a
   database - the verify tool will reveal this rather than guessing), warns
   about not editing old fictional seed rows once sync is ever enabled (that
   would create new pages in the real workspace via `pages.create`), and
   ends with an explicit approval checklist. **No migration was performed.**
7. **`docs/notion-setup.md`** - updated to reference the new
   `NOTION_SYNC_ENABLED` gate and the "Verify databases" check; added a
   safety-note line stating there is no delete/archive/move call anywhere
   in `src/lib/notion/` (confirmed by grep before writing that claim).
8. **Tests** - `src/lib/notion/schema-requirements.test.ts`, 23 cases:
   requirement-set shape (exactly the six entity types, exactly one title
   property each), `validateProperties` (ok / missing / wrong-type / null-
   or-empty actual-properties / extra unrelated columns ignored),
   `isSchemaValid`/`invalidProperties`, `detectDatabaseConfiguration`
   (api-key-only / database-id-missing / neither), `isDatabaseReady` and
   `isMappingReady` (including the "empty database list is never ready"
   edge case). All pure - no network, no `server-only` imports, so they run
   directly under `vitest`.

### What remains mock/local

- No real `NOTION_DATABASE_*` id is set anywhere (`.env.local` still only
  has `NOTION_API_KEY` from Phase 2). All app data is still 100% local
  SQLite.
- `NOTION_SYNC_ENABLED` is unset (defaults to `false`) everywhere.
- The existing Hours Worked / Work Done / Invoice Reports / Work Stuff
  Notion pages are completely untouched - nothing in this phase read,
  wrote, or even connected to them (verified live against the real
  integration during browser testing below, using a deliberately invalid
  database id so no real page was touched).

### Whether any Notion write path is active

**No.** `pages.create`/`pages.update` (the only write calls anywhere in
`src/lib/notion/`) are reachable only through `pushEntity`, which now
refuses to run unless `NOTION_SYNC_ENABLED=true` - which is not set. Grepped
the whole `src/lib/notion/` tree for delete/archive/move calls: none exist,
confirming there is no destructive write path in the codebase at all, active
or not.

### Browser verification performed

Started a dev server (no stale process conflicts this time) and exercised
Settings live against the real, valid `NOTION_API_KEY` already in
`.env.local`:

- Notion Connection card: now shows "Configured" + "Sync disabled
  (read-only)" badges, and the disabled-sync message text from the last
  sync log render inline.
- Notion Database Mapping card renders with "Not checked yet" before the
  first check.
- Clicked "Verify databases" with no database ids set: all six reported
  `configured: false` with a clear per-entity "`NOTION_DATABASE_X` is not
  set" message; toast read "6/6 database(s) not ready yet." Confirmed the
  raw JSON response shape via network inspection.
- Temporarily set `NOTION_DATABASE_HOURS` to a throwaway all-zero id (not a
  real database) to exercise the "configured but inaccessible" path: got a
  real Notion API error surfaced cleanly - "Could not find database with
  ID: ...  Make sure the relevant pages and databases are shared with your
  integration \"AFP Contractor Workspace\"" - confirming the integration
  itself is live and named, with no crash and no properties-list noise
  (fixed the card to only show the missing-properties list once a database
  is actually reachable, not for the "not configured" or "inaccessible"
  cases, after the first pass looked noisy for those). Removed the
  throwaway value immediately after and restored `.env.local` to its exact
  prior (Phase 2) contents.
- Zero console errors at any point (checked via `preview_console_logs` at
  `error` level after every interaction).

### Final verification suite

- `npm run lint` - pass (0 errors, 0 warnings).
- `npm run typecheck` - pass.
- `npm test` - pass (50/50 - 27 from Phase 2 + 23 new).
- `npm run build` - pass; `/api/notion/verify-databases` compiles alongside
  the existing 22 routes.

### Not committed

Per the user's explicit instruction, nothing from this phase has been
committed or pushed. Awaiting review of the final report before committing.

---

## 2026-07-09 ~20:50 CT — Phase 2 browser verification (Claude Code)

**AI model:** Claude Sonnet 5 (Claude Code)

### Summary

Follow-up to the Phase 2 entry directly below: completes the live browser
verification that entry noted as blocked, then re-runs the full check suite
and prepares a clean commit.

### Dev server conflict, resolved

Two `next dev` processes were found bound to this project directory:

- Port 3000 (PID 97441/97443, started 19:18): traced to a `Claude.app`
  Helpers `disclaimer` wrapper — an actively owned server from another live
  Claude Code chat, not stale.
- Port 3001 (PID 53926/53945, started 18:55): its shell ancestor had
  `PPID 1` (reparented to init - the original session that launched it had
  already exited). Confirmed stale and killed (`kill 53945 53926 53902`).

Next.js's dev lock (`.next/dev/lock`) is directory-scoped, not port-scoped,
so a second `next dev` against this same project still couldn't start while
the port-3000 process (legitimate, not stale) held it. Asked the user how to
proceed; they stopped that session's server themselves. Its process was
still alive a few seconds later (closing the chat window didn't kill the
underlying process), so per the user's explicit confirmation it was
terminated directly (`kill 97443 97441`) and the stale lock file cleaned up
automatically. This session's own dev server then started cleanly on port
3000.

### Browser verification performed (Settings page)

- **"Test connection" button renders** - confirmed in the DOM next to "Sync
  now".
- **Valid credentials (the real key from `.env.local`)** - clicking it
  returned `{ ok: true, configured: true, botId, workspaceName: "Battle
  Bound Branding" }` and surfaced a success toast. No console errors.
- **Missing credentials** - temporarily commented out `NOTION_API_KEY` in
  `.env.local` (backed up first, restored after). Next.js hot-reloaded the
  env change (`Reload env: .env.local` in server logs, no restart needed).
  Settings correctly fell back to "Not connected · running in local-only
  mode" / "Not configured", top bar showed "Notion not connected", and
  clicking "Test connection" showed a graceful error toast: "NOTION_API_KEY
  is not set." No crash, no console errors.
- **Invalid (but present) credentials** - set `NOTION_API_KEY` to an obvious
  placeholder value. `GET /api/notion/test-connection` returned HTTP 200
  (not a 500) with `{ ok: false, configured: true, error: "API token is
  invalid." }` - the real Notion API error surfaced cleanly through the
  toast, no unhandled exception, no console errors.
- **Restored** `.env.local` to the real key afterward and re-confirmed the
  valid-credentials result above still holds.
- Checked `preview_console_logs` at `error` level after every step across
  all three states - zero errors throughout.

This directly supersedes the "Not done" note in the Phase 2 entry below -
the connection test button is now verified end-to-end for all three credential
states (valid / missing / invalid).

### Final verification suite (re-run after browser testing)

- `npm run lint` - pass (0 errors, 0 warnings).
- `npm run typecheck` - pass.
- `npm test` - pass (27/27).
- `npm run build` - pass; all 21 routes compile, including
  `/api/notion/test-connection`.

### Housekeeping

- `.claude/scheduled_tasks.lock` appeared modified/deleted in `git status`
  partway through this session - unrelated to this work (a session/PID
  runtime lock file, not something edited here). Restored with `git checkout
  --` before staging, so the commit stays scoped to the Phase 2 changes only.
- Confirmed `.env.local` is not tracked (`git ls-files` has no match) and is
  covered by `.gitignore` (`.env*`).

---

## 2026-07-09 ~20:15 CT — Phase 2: Notion database sync (Claude Code)

**AI model:** Claude Sonnet 5 (Claude Code)

### Summary

Phase 2 per the user's brief: standardize the Notion env var, keep mock mode
intact, document real database setup, add a safe connection test, and add a
first test suite for calculations/invoice generation — without rewriting the
app foundation.

### What was already true (verified, not changed)

- `src/lib/notion/config.ts`, `client.ts`, and the Settings UI already read
  only `NOTION_API_KEY` (the Composer pass had already fixed this in code and
  docs). The one remaining non-standardized spot was the local, gitignored
  `.env.local`, which still had `NOTION_TOKEN=...` — flagged twice before but
  left unfixed.
- Mock mode already degrades safely: `isNotionConfigured()` gates on the API
  key, and `databaseIdFor(type)` independently gates every push/pull per
  entity. Existing seed data is never bulk-pushed — pushes only fire from
  `syncEntityNow()` inside route handlers on real edits, never from seeding.

### Changes made

1. **Env var standardization** — renamed `.env.local`'s `NOTION_TOKEN` to
   `NOTION_API_KEY` (with an inline comment explaining why it's still inert:
   no `NOTION_DATABASE_*` ids are set, so every entity's push/pull
   short-circuits before any Notion API call). `.env.local` is gitignored and
   was not committed.
2. **Notion setup docs** — added [`docs/notion-setup.md`](docs/notion-setup.md):
   integration creation, the exact property schema per database (pulled from
   `NOTION_SCHEMA` in `src/lib/notion/mappers.ts`, including Select option
   values from the domain types), sharing databases with the integration,
   finding database ids, and a "Safety notes" section spelling out why
   connecting a key alone can't push mock data or perform destructive writes.
   Linked from `README.md`.
3. **Safe connection test** — `src/lib/notion/test-connection.ts` +
   `GET /api/notion/test-connection`: calls Notion's read-only `users.me`
   endpoint to confirm `NOTION_API_KEY` is valid. Never touches a database,
   so it's safe to run before any `NOTION_DATABASE_*` id is set. Wired into
   Settings as a new "Test connection" button (`useTestNotionConnection` in
   `use-sync-status.ts`, `notionSyncApi.testConnection` in
   `features/notion-sync/api.ts`) alongside the existing "Sync now" button.
4. **Tests** — added `vitest` (new devDependency), `vitest.config.ts` (node
   environment, `@/*` alias matching `tsconfig.json`), and `npm test` /
   `npm run test:watch` scripts (replacing the placeholder `test` script).
   - `src/lib/calculations.test.ts` — 15 cases covering `minutesBetween`
     (including midnight wraparound), `computeTotalHours`, `computeAmount`,
     `formatHours`/`formatCurrency`, `sumHours`/`sumBillableAmount`, and
     `entriesInRange`/`entriesToday`.
   - Extracted the three pure helpers from `src/app/api/invoices/route.ts`
     (`nextInvoiceNumber`, `buildLineItems`, `buildSummary`) into
     `src/lib/invoices/generate.ts` so they're testable without a live
     SQLite instance; the route now imports them instead of redefining them.
     `src/lib/invoices/generate.test.ts` — 12 cases covering invoice-number
     sequencing (fresh sequence, continuing a sequence, zero-padding,
     non-numeric fallback), line-item hour splitting across same-day work
     logs, and summary generation (including the 5-highlight cap).
   - 27/27 tests pass.

### Verification performed

- `npm run lint` — pass (0 errors, 0 warnings).
- `npm run typecheck` — pass.
- `npm test` — pass (27/27).
- `npm run build` — pass; `/api/notion/test-connection` compiles as a new
  dynamic route alongside the existing 27.
- **Not done:** live browser verification of the new "Test connection"
  button. Another session already has a `next dev` server bound to this
  project directory, and Next.js's dev lock refuses a second instance
  against the same directory regardless of port, so this session couldn't
  start its own preview server. The change is a small, conventional
  addition (mirrors the existing `useTriggerSync`/"Sync now" pattern
  exactly) verified via build + typecheck, not exercised in a browser.

### Remaining TODOs (unchanged from prior passes, still open)

- Wire real `NOTION_DATABASE_*` ids once the six databases exist (see
  `docs/notion-setup.md`) — intentionally left unset here.
- Versioned SQLite migrations before evolving the schema.
- Finish Electron production packaging.
- Broaden test coverage (knowledge parent-cycle guards, sync conflict
  resolution) beyond this pass's calculations/invoice-generation scope.

---

## 2026-07-09 ~19:00 CT — Integration Pass (Composer)

**AI model:** Composer (Cursor agent)

### Integration work performed

Ran a full integration-lead pass after parallel feature work landed on a greenfield Next.js 16 + SQLite + Notion-sync foundation. Focus was consistency and hardening, not new features.

- Moved shared API DTOs into `src/types/api.ts` so route handlers and feature clients no longer own inverted type imports.
- Moved knowledge tree helpers to `src/lib/knowledge/tree.ts` (single source of truth; API no longer imports from a feature module).
- Consolidated status/priority badges under `src/components/shared/` (work-log status, project status, shared priority). Feature copies remain thin re-exports for existing imports.
- Projects related-worklogs table now uses the shared WorkLog status badge.
- Removed empty unused `src/store/` scaffolding.
- Added `typecheck` and placeholder `test` scripts; removed unused `cross-env` package.
- Extended `.gitignore` for SQLite WAL/SHM files; added `.env.example` documenting mock-mode env vars.
- Verified SQLite seed (workspace/client/projects/hours/worklogs/knowledge/invoices) and Notion mock mode (`configured: false`).
- HTTP-verified all primary pages, knowledge type routes, detail pages, and API endpoints including gracefult sync without a live Notion token.

### Files changed

- `src/types/api.ts` (new)
- `src/lib/knowledge/tree.ts` (new)
- `src/components/shared/priority-badge.tsx` (new)
- `src/components/shared/work-log-status-badge.tsx` (new)
- `src/components/shared/project-status-badge.tsx` (new)
- `src/features/hours/lib/types.ts` → re-export from `@/types/api`
- `src/features/knowledge/lib/tree.ts` → re-export from `@/lib/knowledge/tree`
- `src/features/dashboard/api.ts`, `src/features/invoices/api.ts`, `src/features/settings/api.ts`, `src/features/search/api.ts`
- `src/features/dashboard/components/badges.tsx`, `src/features/work-done/components/status-priority.tsx`, `src/features/projects/components/badges.tsx`
- `src/features/projects/components/related-worklogs-table.tsx`
- `src/app/api/dashboard/route.ts`, `src/app/api/hours/route.ts`, `src/app/api/hours/[id]/route.ts`
- `src/app/api/knowledge/[id]/route.ts`, `src/app/api/invoices/[id]/route.ts`
- `src/app/api/settings/route.ts`, `src/app/api/search/route.ts`
- `package.json`, `package-lock.json`, `.gitignore`, `.env.example`
- Removed: `src/store/` (empty)

### Build results

- `npm run lint` — pass (0 errors, 0 warnings)
- `npm run typecheck` — pass
- `npm run build` — pass (Next.js 16.2.10 / Turbopack)

### Test results

- `npm test` — **no automated tests exist yet** (script documents that fact and exits 0)
- Runtime HTTP smoke: all listed routes returned 200; `/api/notion/status` reports `configured: false`; POST `/api/notion/sync` completes without throwing

### Remaining TODOs

- Add real unit/integration tests (calculations, invoice generation, knowledge tree cycle guards, sync conflict resolution).
- Replace schema-only `CREATE TABLE IF NOT EXISTS` with versioned migrations before evolving production SQLite.
- Wire Electron packaged `next start` spawn (noted in `electron/main.js`).
- Replace create-next-app README with architecture docs when ready.
- Optional: fold knowledge wiki markdown + work-done notes markdown into one shared renderer.
- When enabling Notion for real: set `NOTION_API_KEY` (current `.env.local` uses `NOTION_TOKEN`, which the app ignores — mock mode stays on by design for this pass).

### Recommended next step

Ship a first automated test suite around `src/lib/calculations.ts`, invoice generation, and knowledge parent-cycle guards, then add a tiny SQLite migration runner before any schema change.

---

## 2026-07-09 ~17:15–19:10 CT — Initial build (Claude Code)

**AI model:** Claude Sonnet 5 (Claude Code), foundation built directly + 7 parallel subagents (also Sonnet 5) via the Workflow tool for the feature modules, per the "Ultracode" build spec.

### Summary

Built the AFP Contractor Workspace application from an empty directory, per the full build spec (Next.js 16, TypeScript, Tailwind, shadcn/ui, React Query, Notion API, local SQLite cache, Electron-ready architecture). Work was split into two phases:

1. **Foundation (built directly, sequentially):** `create-next-app` scaffold, shadcn/ui init (`base-nova` style, Base UI rather than Radix), dependency install, git init, the full domain model, the generic SQLite repository layer + one repository per entity, mock-data seeding, the Notion client/mappers/sync engine (push-on-edit, pull-on-startup/interval, conflict detection), the app shell (sidebar, top bar, dark theme, React Query provider), global search (command palette + `/api/search`), and a small Electron dev-mode wrapper.
2. **Feature modules (7 parallel subagents via `Workflow`):** Dashboard, Hours Worked, Work Done, Invoice Reports, Work Stuff knowledge base, Projects, and Settings, each built as an isolated vertical slice (own routes, own `app/api/*` handlers, own `features/*` folder) on top of the shared foundation, per detailed per-module prompts covering every field/behavior in the spec.

Immediately noticed mid-session (see the "Integration Pass (Composer)" entry directly above this one, timestamped inside this same window): a second AI agent, identifying itself as Cursor's Composer, was concurrently editing this same working directory - deduplicating shared badge components, relocating some types/helpers, and adding `.env.example`/`typecheck`/`test` scripts. Those changes were left in place (they're compatible - the full verification pass below was run *after* they landed, and passed cleanly) rather than reverted, since two agents silently fighting over the same files would be worse than one extra, well-intentioned pass. Flagged to the user as something to be aware of and coordinate around going forward.

### Files created/modified

Effectively the entire `src/` tree (180+ files) plus `electron/main.js`, `electron/preload.js`, `package.json`, `next.config.ts`, `eslint.config.mjs`, `.gitignore`, `README.md`, `.env.example`, this file. Key foundation paths: `src/types/domain.ts`, `src/lib/db/**`, `src/lib/notion/**`, `src/lib/calculations.ts`, `src/lib/mock-data/generate.ts`, `src/components/layout/**`, `src/features/notion-sync/**`, `src/features/search/**`. Per-module paths: `src/app/{hours,work-done,invoices,knowledge,projects,settings}/**`, `src/app/api/{dashboard,hours,worklogs,invoices,knowledge,projects,settings}/**`, `src/features/{dashboard,hours,work-done,invoices,knowledge,projects,settings}/**`.

### Features implemented

- **Dashboard** - today/week/month hours, unbilled invoice estimate, hourly rate, active project, recent work entries, recent notes, upcoming tasks, sync status, recent sync log.
- **Hours Worked** - full CRUD table (date, start/end, break, total hours, rate, billable, location, project, related work log, notes), server-side-authoritative hour calculation, running weekly/monthly totals, timer mode (start/stop with a confirm dialog) and manual entry mode.
- **Work Done** - title/date/project/summary/status/priority, engineering notes and invoice description as two independently-editable fields (per spec), related hours + related knowledge multi-select, evidence list, GitHub link, link-only attachments.
- **Invoice Reports** - auto-generate from a date range (pulls billable hours + work logs, computes totals, sequenced invoice numbers), PDF export (jsPDF), Markdown export, copy to clipboard.
- **Work Stuff knowledge base** - Documentation/Notes/Flow Maps/Research/Meeting Notes (+ Ideas/SOPs/Reference/Project Notes via an "all types" view), nested pages, tags, in-type search, `[[wiki-link]]` backlink resolution plus explicit backlink editing.
- **Projects** - the hub: status/priority/tags/notes plus live related-hours, related-work-logs, and related-documentation sections.
- **Global search** - `⌘K` command palette querying hours, work logs, projects, and knowledge in one shot.
- **Notion sync service** - typed push/pull against Notion's data-source API (2025-09+ Notion API shape, i.e. `dataSources.query` rather than the older `databases.query`), push-on-edit, pull-on-startup/interval, conflict detection and a resolution UI in Settings.
- **Settings** - client/rate/timezone config, Notion connection status + setup instructions, conflict resolution, desktop app info.
- **Electron scaffold** - `electron:dev` runs a real desktop window against `next dev`; production packaging is stubbed but not fully wired (see Next recommended step).

### Verification performed

- `npx tsc --noEmit` - clean.
- `npm run lint` - clean (0 errors, 0 warnings) after fixes (see below).
- `npm run build` - clean production build, all 27 routes compile (11 static, 16 dynamic).
- Live browser verification (Claude Browser tools against the running dev server) of every route: Dashboard, Hours (including starting/stopping the timer end-to-end and discarding the resulting draft), Work Done list + detail, Invoices list + detail + export actions, Projects list + detail, all five knowledge-type routes + the `all` view + nested page view + backlinks, Settings, and the global search command palette.
- Three real bugs were found and fixed during this verification (not just typecheck/lint - actual runtime behavior):
  1. **8 components** used `useEffect` + `setState` to sync local form state from props/query data, which both violates the newer `react-hooks/set-state-in-effect` lint rule and does an extra unnecessary render pass. Refactored all 8 (`theme-toggle.tsx`, `use-mobile.ts`, `hours-entry-dialog.tsx`, `timer-stop-dialog.tsx`, `invoice-summary-editor.tsx`, `project-detail-view.tsx`, `workspace-client-card.tsx`, plus a `useMemo` dependency warning in `knowledge-type-view.tsx`) to React's recommended "adjust state during render" / `useSyncExternalStore` patterns instead.
  2. The shared `Button` component (`src/components/ui/button.tsx`) logged a Base UI console error and lost native button semantics whenever composed as `<Button render={<Link .../>}>` (used for every "Back to X" link-as-button across Work Done, Projects, and Knowledge), because Base UI's `Button` defaults `nativeButton` to `true` regardless of what `render` points at. Fixed once, centrally, by defaulting `nativeButton` to `false` whenever a `render` prop is present.
  3. The global search command palette (`⌘K`) **crashed** (`Cannot read properties of undefined (reading 'subscribe')`) the moment it opened. Root cause: in this shadcn version, `CommandDialog` no longer wraps its children in a `<Command>` root internally (unlike older shadcn versions) - `CommandInput`/`CommandList` were rendering outside any `cmdk` context. Fixed by explicitly wrapping with `<Command shouldFilter={false}>` (the `shouldFilter={false}` is required too, since results are already server-filtered by `/api/search` and `cmdk`'s default fuzzy-filter would otherwise hide them by matching against the item's `id` rather than its title).

### Assumptions made

- Single-tenant mode: one seeded Workspace/Client, resolved via `workspaceRepo.all()[0]` / `clientRepo.all()[0]` throughout, per the spec's "future architecture" note (the data model supports more, the UI doesn't yet need to).
- Various per-module estimation/scope decisions are documented inline where they matter (e.g. invoice line-item hour attribution in `src/app/api/invoices/route.ts`, "current invoice amount" definition in `src/app/api/dashboard/route.ts`, attachments as link-only metadata in Work Done) rather than repeated here.
- Electron production packaging is architected but not finished: `electron/main.js` currently assumes a server is already listening on `localhost:3000` (true for `electron:dev`); a packaged build has no such server yet.

### Two things flagged for the user, not acted on

- **`.env.local` contains `NOTION_TOKEN=...`**, which does not match the env var the app actually reads (`NOTION_API_KEY`). This wasn't created by this session's work. Left as-is rather than silently wiring it up or renaming it, since enabling sync would start pushing the seeded mock AFP data into whatever real Notion databases are pointed at - that's a live-system action that needs an explicit go-ahead, not an assumption.
- **Concurrent editing by a second AI agent** (Cursor's Composer, see the entry above) was detected mid-session via unprompted changes to files this session was also touching. Left in place after confirming compatibility (full clean typecheck/lint/build after both passes landed), but this is worth the user's attention - two agents editing the same repo without coordination is a real risk even when, as here, it happened to work out.

### Next recommended step

1. Decide on Notion: either fix `.env.local` to `NOTION_API_KEY` and supply the six `NOTION_DATABASE_*` IDs to go live, or stay in mock mode intentionally.
2. Add an automated test suite (`src/lib/calculations.ts`, invoice generation, knowledge parent-cycle guards, sync conflict detection) - flagged as missing by both this pass and the Composer pass.
3. Finish Electron production packaging: have `electron/main.js` spawn a bundled Next.js server (e.g. `next build` with standalone output) when `app.isPackaged`, instead of assuming a dev server is already running.
4. Make an initial git commit - the repo is `git init`-ed but nothing has been committed yet.
5. Decide how Cursor/Composer and Claude Code should share this repo going forward (sequential handoffs vs. explicitly divided scope) to avoid a repeat of the concurrent-edit situation above.
