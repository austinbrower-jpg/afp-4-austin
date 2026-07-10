# Migration plan: connecting existing Notion pages (not performed yet)

This documents how to safely connect the app's six databases to your real
Notion workspace, given the pages you already have:

```
AFP-Work
├── Invoice Details
│   ├── Hours Worked        -> "hours" entity (NOTION_DATABASE_HOURS)
│   ├── Work Done            -> "worklog" entity (NOTION_DATABASE_WORKLOGS)
│   └── Invoice Reports      -> "invoice" entity (NOTION_DATABASE_INVOICES)
└── Work Stuff               -> "knowledge" entity (NOTION_DATABASE_KNOWLEDGE)
    ├── Power Automate Flow Map
    └── AFP Command Center / Internal Sales & Operations Hub Plan
```

No pages listed above map to the **client** or **project** entities
(`NOTION_DATABASE_CLIENTS` / `NOTION_DATABASE_PROJECTS`) - those two likely
need brand-new databases created from scratch per
[`docs/notion-setup.md`](notion-setup.md), since nothing in your existing
tree corresponds to them.

**Nothing in this plan has been executed.** It is a plan to review and
approve, not a log of actions taken. No Notion page has been read, written,
moved, or deleted as part of writing this document.

## Ground rules (non-negotiable)

- Existing pages are never deleted, moved, or overwritten by anything in
  this app. There is no delete/archive/move code path against Notion at
  all (see [Whether any Notion write path is active](#whether-any-notion-write-path-is-active-right-now)
  below).
- Real sync (push or pull) stays off by default via `NOTION_SYNC_ENABLED`
  (defaults to unset/false) - see `src/lib/notion/config.ts` and the guards
  added to `pushEntity`/`pullDatabase`/`runFullSync` in
  `src/lib/notion/sync-engine.ts`. Setting a `NOTION_DATABASE_*` id alone
  only enables the new **read-only schema check** (Settings > "Notion
  Database Mapping"), which calls `databases.retrieve` and
  `dataSources.retrieve` - both read-only GET endpoints that return schema
  metadata only, never row content.
- The pre-existing SQLite mock/seed data (~9 weeks of fictional hours/work
  logs from the initial build) is never bulk-pushed. Pushes only happen via
  `syncEntityNow()` after a real local edit through a route handler; the
  seed data was inserted directly into SQLite and was never queued.

## Step 1 — point env vars at your real databases (read-only mapping only)

In `.env.local` (gitignored, never committed), add the database ids for
whichever of the six databases already exist:

```
NOTION_DATABASE_HOURS=<Hours Worked database id>
NOTION_DATABASE_WORKLOGS=<Work Done database id>
NOTION_DATABASE_INVOICES=<Invoice Reports database id>
NOTION_DATABASE_KNOWLEDGE=<Work Stuff database id, if it is one - see note below>
```

Leave `NOTION_SYNC_ENABLED` unset (or `false`). At this point nothing has
changed from Notion's perspective - the app still only reads schema
metadata when you click "Verify databases".

**Note on "Work Stuff":** the app's `knowledge` entity expects
`NOTION_DATABASE_KNOWLEDGE` to point at a Notion *database* (title, type
select, tags multi-select columns), whose rows are individual knowledge
pages. If "Work Stuff" is a plain page with sub-pages (not a database), the
verification check will report it as inaccessible/misconfigured rather than
guessing - that's expected, and tells you whether "Power Automate Flow Map"
and "AFP Command Center..." need to become rows in a new database instead.

## Step 2 — run the read-only verification

Open **Settings** and click **Verify databases** on the "Notion Database
Mapping" card (or `GET /api/notion/verify-databases`). For each configured
database it reports:

- **Accessible** - could the integration retrieve it at all? (Did you share
  the database with your integration? See `docs/notion-setup.md` step 3.)
- **Database name** - confirms you pointed the env var at the database you
  think you did.
- **Schema valid** - do all the columns the app expects exist, with the
  right type?
- **Missing / incorrect properties** - the exact column names and types
  that don't match yet.

This makes zero writes and reads no row content - only column/schema
metadata.

## Step 3 — reconcile schema differences (still no data migration)

For every property reported missing or the wrong type, you have two
non-destructive options:

1. **Add/adjust the column in Notion.** Adding a new column to an existing
   database never touches existing rows' other data. Renaming a column
   Notion keeps the existing values - only the header text changes.
2. **Edit `NOTION_SCHEMA` in `src/lib/notion/mappers.ts`** to match the
   column names your database already uses instead. Zero Notion writes -
   a code-only change.

Re-run "Verify databases" until "Schema valid" is yes for every database
you intend to use. Nothing is imported yet.

## Step 4 — importing the July 8 / July 9 entries (requires your explicit go-ahead)

Once schema-valid, importing existing Notion rows into the local SQLite
cache happens via the existing pull path (`pullDatabase()` in
`sync-engine.ts`), which only runs once `NOTION_SYNC_ENABLED=true`:

- `pullDatabase()` queries the data source (`dataSources.query` - read-only
  against Notion) and, for every page not already linked to a local row
  (matched by `notionPageId`), **inserts** a new local SQLite row. It never
  deletes, moves, or edits the Notion page itself.
- If a local row already exists for that Notion page, it only updates the
  *local* copy - still zero writes back to Notion during a pull.
- This is why pulling your July 8/9 "Hours Worked" and "Work Done" entries
  is safe to Notion: the entries in Notion are only ever read, never
  modified, during this step.

**What is not yet safe without more care:** once `NOTION_SYNC_ENABLED=true`,
any *local* edit to a record after that point pushes to Notion
(`pushEntity()` → `pages.update` if the row has a `notionPageId`, or
`pages.create` for a genuinely new local row). Two things to do before
flipping the switch:

1. Confirm you actually want push enabled yet, or whether you'd rather stay
   pull-only for a while. The current code does not support a "pull-only"
   mode - `NOTION_SYNC_ENABLED` gates both directions together. If you want
   pull without push, say so and that's a small, targeted follow-up (a
   second flag, or gating push separately) rather than something to bolt on
   silently here.
2. **Don't edit the pre-existing fictional seed rows** in local SQLite after
   enabling sync. They have no `notionPageId`, so editing one would create a
   *new* page in your real Notion database via `pages.create` - not
   overwrite anything existing, but it would add fictional demo data
   ("Acme"-style placeholder content) into your real workspace. Safest path:
   review/clear the local seed data for Hours and Work Done before going
   live, or simply avoid touching old seed rows once `NOTION_SYNC_ENABLED`
   is on.

### Approval checklist before setting `NOTION_SYNC_ENABLED=true`

- [ ] "Verify databases" shows **Read-only mapping ready** for every
      database you intend to sync.
- [ ] You've reviewed step 4's push behavior above and are comfortable with
      it, or have asked for pull-only gating first.
- [ ] You've decided what to do about the existing seed/mock rows in local
      SQLite for Hours and Work Done (clear them, or leave them
      permanently un-edited).

This migration has **not** been run. Nothing above happens until you
explicitly say to proceed and `NOTION_SYNC_ENABLED` is set to `true`.

## Phase 5 — dry-run preview (built, no writes)

Before Step 4 above is ever run for real, Settings → **Historical Migration
Dry Run** (`/settings/migration-preview`, backed by `GET
/api/notion/migration-preview`) shows exactly what that step would create:
proposed client, projects, hours rows, and work-log rows, each with its
source provenance, plus a from-scratch recalculation of totals (billable/
non-billable hours, invoice amount, per-day, per-session) against what the
Hours Worked/Work Done pages currently state about themselves.

This preview makes **zero Notion API calls** (the source content is a
transcribed, versioned fixture in `src/lib/notion/migration/source-data.ts`,
not a live fetch) and **zero SQLite writes** (only reads, for duplicate
detection - see `src/lib/notion/migration/read-existing.ts`). It is safe to
run anytime, regardless of `NOTION_SYNC_ENABLED`, and produces the same
output every time until the source fixture or local duplicate-candidate
records change.

### Approval checklist before enabling a one-time write mode

A real (one-time) write migration has **not** been built yet - this phase
intentionally stops at preview. Before anyone builds and runs that write
path, the following must all be true:

- [ ] **Every proposed hours row has been reviewed individually** (Settings
      → Historical Migration Dry Run → Proposed hours table) - date, start/
      end, hours, rate, billable status, location, and notes for all 5
      historical sessions (1 non-billable onsite + 4 billable).
- [ ] **Every project assignment has been reviewed**, including the rows the
      dry run deliberately left unassigned (`hrs-2026-07-08-s1`,
      `hrs-2026-07-08-s3` - generic/unmatched workstream text) and the one
      flagged as an ambiguous multi-project match
      (`hrs-2026-07-09-s1` - matches both BOL Review Process V2 and AFP
      Command Center / Sales & Operations Hub, primary pick is BOL Review
      Process V2). Confirm the intended project for each before a write
      migration is built.
- [ ] **Totals have been approved**, specifically the reconciled discrepancy
      between the app's existing hour-rounding convention and the source
      page's own exact-minute math ($311.10 app-convention vs. $311.00
      exact-minute/source-stated, traced entirely to the July 8 2:05-5:00 PM
      session). Decide which figure a real migration should store before it
      is built, rather than defaulting silently.
- [ ] **Duplicate protection is confirmed active**: the dry run's
      `skipped`/`action: "skip-existing"` fields (keyed on client name;
      project name; client+date+start+end for hours; client+date+title for
      work logs) have been checked against the current local SQLite state
      immediately before any write migration runs, so re-running it can't
      create duplicate rows.
- [ ] **The stale-header and multi-block warnings have been read and
      accepted**: the July 9 page's own header text ("Started at 9:00 AM",
      "Not finalized yet") is stale relative to its own later "End-of-Day
      Shift Update" section (9:12 AM-2:00 PM, closed) - the dry run already
      treats the closed figures as authoritative - and the July 9 work log's
      invoice description is a concatenation of three separate "Invoice-
      Ready" blocks from the source page.
- [ ] **Explicit user approval to build and run a one-time write mode**,
      naming which proposed records to include/exclude/edit, before any code
      that calls `pages.create`, `pushEntity`, or SQLite `insert`/`update`
      for this historical data is written. `NOTION_SYNC_ENABLED` must also
      still be turned on deliberately per the Step 4 checklist above - the
      dry-run approval above is in addition to that, not a replacement for
      it.

Until every box above is checked and the user has explicitly said to
proceed, no write migration exists in this codebase to run.

## Phase 6 — one-time historical import (built; not yet executed)

A write path now exists, but it is deliberately narrow: it only creates the
five approved historical record types below, never touches
`NOTION_SYNC_ENABLED`, and cannot run without a typed confirmation phrase.
See `src/lib/notion/migration/one-time-import.ts` (the service - injectable
Notion client, fully unit-tested with a mock in
`one-time-import.test.ts`, zero real network access from tests) and the two
routes it's wired to: `GET /api/notion/migration-import/preflight`
(read-only) and `POST /api/notion/migration-import` (the one write call in
this feature). UI: Settings → **Historical Notion Import**
(`/settings/migration-import`).

### Why this is separate from the general sync engine

`src/lib/notion/sync-engine.ts`'s `pushEntity`/`pullDatabase`/`runFullSync`
are gated by `NOTION_SYNC_ENABLED` and operate on whatever local SQLite rows
exist at call time - general-purpose, ongoing, bidirectional. This import is
none of those things: it is scoped to exactly 11 specific historical
records (from the Phase 5 dry run), runs once (idempotently - see rerun
behavior below), and refuses to run at all while `NOTION_SYNC_ENABLED=true`
(see "Preflight rules" below) so the two write paths can never interleave.
It shares no code with `sync-engine.ts` or `mappers.ts` - see
`src/lib/notion/migration/write-schema.ts`'s own property builders.

### One-time import procedure

1. Open Settings → **Historical Notion Import**.
2. **Step 1 (read-only)** loads automatically: live preflight checks, the
   exact records/counts/totals this run would create, and a Notion-side
   duplicate scan (matched by Migration Key - see below). Nothing is
   written. Re-run anytime with **Re-check**.
3. If any check fails, fix it (see "Preflight rules") and re-check. The
   confirmation step (4) stays locked until every check passes.
4. **Step 2**: type the exact phrase `IMPORT AFP JULY 8-9` into the
   confirmation field. The **Import now** button stays disabled until the
   typed text matches exactly - there is no checkbox alternative and no way
   to submit with an empty or partial phrase.
5. Click **Import now**. The server re-runs every preflight check itself
   (never trusts the client) before writing anything, then writes in order:
   client → projects → hours → work logs (see "Write order" below).
6. Review the **Results** panel: created records (with Notion links),
   skipped duplicates, any failures, reconciled totals, run id, and
   timestamps.

### Duplicate-key strategy

Every record this import can create carries a deterministic, versioned
`Migration Key` (rich_text property, added additively - see "Schema
changes" below) - the sole source of truth for "does this already exist in
Notion", never inferred from matching on name/date text. Computed by
`src/lib/notion/migration/write-keys.ts`:

| Entity | Key formula | Example |
|---|---|---|
| Client | fixed | `afp-client-v1` |
| Project | slug of project name | `afp-project-bol-review-process-v2-v1` |
| Hours | date + start + end + billable + project | `afp-hours-2026-07-08-1100-1300-billable-bolReviewV2-v1` |
| Work log | date + slug of title | `afp-worklog-2026-07-08-july-8-2026-v1` |

Before writing anything, the import queries each relevant database
(read-only `dataSources.query`, filtered by these exact keys) for existing
matches. A match is **skipped**, not recreated, regardless of whether it
came from a prior full run, a prior partial run, or was created by hand.
This is what makes reruns safe (see below) - duplicate protection is keyed
off live Notion state, not local assumptions.

### Schema changes (additive only)

Two properties are added, only where missing (checked read-only first via
`dataSources.retrieve`, added via `dataSources.update` only if absent -
never renamed, removed, or reconfigured if already present):

| Property | Type | Added to | Purpose |
|---|---|---|---|
| `Migration Key` | `rich_text` | Clients, Projects, Hours Worked, Work Done | Duplicate-detection key (above) |
| `Project` | `relation` → Projects data source | Hours Worked, Work Done | Links each hours/work-log row to its project page. `NOTION_SCHEMA.hours.project` / `NOTION_SCHEMA.worklog.project` in `mappers.ts` already reserved this exact name for the general sync engine but never populated it - this migration is the first to actually write it. |

Both are additive-only column changes: per the same guarantee already
documented above for the general sync engine, adding a new column never
touches any existing row's other data. Knowledge and Invoice Reports
databases are untouched - out of scope for this migration.

### Write order & relation resolution

1. **Client** (`Anytime Fuel Pros`)
2. **Projects** (BOL Review Process V2, AFP Command Center / Sales &
   Operations Hub, Power Automate Documentation, in that fixed order)
3. **Hours** (5 rows) - each row's `Project` relation points at the
   Notion page id resolved in step 2 (newly created this run, or an
   existing page matched by migration key)
4. **Work logs** (2 rows) - same relation resolution; July 9's `Summary`
   property additionally has its `relatedProjectsNote` appended (preserving
   the Command Center / Power Automate Documentation cross-reference in
   text, since the schema only supports one `Project` relation per row)

### Partial-failure recovery

The import **stops immediately** on the first failed `pages.create` call -
it does not skip ahead, retry, or continue into later steps once one has
failed. The response always reports exactly what was created, skipped, and
failed before the stop.

**To recover: just run the import again.** No manual cleanup is needed:

1. Fix whatever caused the failure (check the `failed[].error` message -
   e.g. a transient Notion API error, a rate limit, a permissions issue).
2. Open Settings → Historical Notion Import again (or click **Re-check**).
3. Confirm with the phrase again.
4. The rerun's live duplicate scan finds every record actually created by
   the previous attempt (via Migration Key) and skips them; it only
   attempts the records that are still missing. This is true whether the
   previous run got partway through and failed, or completed successfully
   and you're just double-checking.

No rollback of already-created Notion pages is ever attempted - partial
progress from a failed run is left in place (it's valid, correctly-formed
data) and simply completed by the next run, not undone.

### Verification checklist (before approving a real run)

- [ ] Preflight shows **Ready** with all 10 checks passing, checked live
      immediately before the report you're reviewing.
- [ ] Proposed counts read exactly **1 client, 3 projects, 5 hours, 2 work
      logs**.
- [ ] Totals read exactly **10.37 billable hours, 2.00 non-billable hours,
      $311.00**.
- [ ] The duplicate scan result is understood - either "no existing
      matches" (fresh run) or a specific, expected set of already-created
      records (an intentional rerun).
- [ ] `NOTION_SYNC_ENABLED` is confirmed `false` (the `sync-disabled`
      preflight check reports this explicitly and blocks the run otherwise
      - by design, so this write path and general sync can never
      interleave).
- [ ] The two additive schema changes above (Migration Key, Project
      relation) are understood and accepted.
- [ ] Explicit user go-ahead has been given in the chat reviewing this
      exact preflight report - the tool's own confirmation phrase is a
      safeguard against accidental clicks, not a substitute for that
      approval.

### Exact records this import creates

See the Phase 5 section above for the full table (client, 3 projects, 5
hours rows, 2 work logs, and the approved project assignments / billing
convention). This phase does not change what gets imported - only how it
gets written, with duplicate protection.

### Status

Built and tested (mocked Notion client only - see
`one-time-import.test.ts`). **Not yet executed against the real
workspace.** Awaiting explicit approval of the live preflight report before
the real import is run.

---

## Phase 7 report visibility proposal (not applied)

The read-only Report Builder defines the future visibility contract without changing any live Notion database. See [`report-generation.md`](report-generation.md) for full behavior.

Proposed Work Done additions: `Client Visible` (checkbox), `Include in Invoice` (checkbox), `Include in Work Report` (checkbox), `Detailed Work Description` (rich text), `Internal Notes` (rich text), `Evidence Links` (rich text or URL), and `Related Hours` (relation to Hours Worked if safe).

Proposed Knowledge additions: `Client Visible` (checkbox), `Include in Work Report` (checkbox), `Report Summary` (rich text), `Project` (relation to Projects), and `Source Page` (URL).

Until those fields are approved, applied, and mapped into the shared repository projection, cached Notion records with missing visibility flags are excluded by default. Phase 7 performs no Notion schema update, report save, historical import, or general sync enablement. `NOTION_SYNC_ENABLED` remains `false`.
