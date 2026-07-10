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
