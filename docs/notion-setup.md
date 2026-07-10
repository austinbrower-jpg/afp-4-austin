# Notion database setup

This app runs entirely on the local SQLite cache (`data/afp-workspace.db`) by
default — no Notion account is required to use it. This guide is only for
connecting it to a real Notion workspace so the sync engine
(`src/lib/notion/sync-engine.ts`) can push/pull each entity type.

Sync is **per-entity and additive**: you can connect zero, one, or all six
databases, and the app stays fully usable on local data for anything not yet
connected. Nothing here pushes the local mock/seed data into Notion — see
[Safety notes](#safety-notes) below.

Setting a database id does **not** by itself enable real sync. It only
enables the read-only schema check described in [step 6](#6-verify-the-connection-and-database-schema).
Real push/pull additionally requires `NOTION_SYNC_ENABLED=true` - see
[`docs/notion-migration-plan.md`](notion-migration-plan.md) if you're
connecting existing Notion pages that already have content you need to
preserve.

## 1. Create an internal integration

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations).
2. Create a new **internal** integration scoped to your workspace.
3. Copy the generated secret (starts with `ntn_` or `secret_`) — this is your
   `NOTION_API_KEY`.
4. Under the integration's capabilities, keep **Read content**, **Update
   content**, and **Insert content** enabled (all three are needed for sync
   to push and pull).

## 2. Create the six databases

Create one Notion database per entity type below (a page with an inline or
full-page database works). The names can be anything you like — what has to
match is the **property names and types** inside each database, since
`src/lib/notion/mappers.ts` reads/writes them by exact name.

For any database, either match your existing columns to the list below, or
edit `NOTION_SCHEMA` in `src/lib/notion/mappers.ts` to match your columns —
the two just need to agree.

### Clients — `NOTION_DATABASE_CLIENTS`

| Property | Type | Notes |
|---|---|---|
| `Name` | Title | |
| `Status` | Select | options: `active`, `paused`, `archived` |
| `Default Hourly Rate` | Number | |
| `Color` | Text | |
| `Timezone` | Text | e.g. `America/New_York` |
| `Notes` | Text | |

### Projects — `NOTION_DATABASE_PROJECTS`

| Property | Type | Notes |
|---|---|---|
| `Name` | Title | |
| `Status` | Select | options: `active`, `on-hold`, `completed`, `archived` |
| `Priority` | Select | options: `low`, `medium`, `high`, `urgent` |
| `Description` | Text | |
| `Tags` | Multi-select | |
| `Color` | Text | |

### Hours — `NOTION_DATABASE_HOURS`

| Property | Type | Notes |
|---|---|---|
| `Date` | Title | also used as the title text |
| `Start Time` | Text | `HH:mm`, 24h |
| `End Time` | Text | `HH:mm`, 24h |
| `Break (min)` | Number | |
| `Total Hours` | Number | |
| `Hourly Rate` | Number | |
| `Billable` | Checkbox | |
| `Location` | Text | |
| `Notes` | Text | |

### Work Logs ("Work Done") — `NOTION_DATABASE_WORKLOGS`

| Property | Type | Notes |
|---|---|---|
| `Title` | Title | |
| `Date` | Date | |
| `Status` | Select | options: `not-started`, `in-progress`, `blocked`, `done` |
| `Priority` | Select | options: `low`, `medium`, `high`, `urgent` |
| `Summary` | Text | |
| `Invoice Description` | Text | client-facing text, edited separately from Summary |
| `GitHub Link` | URL | optional — only pushed when set |

### Knowledge ("Work Stuff") — `NOTION_DATABASE_KNOWLEDGE`

| Property | Type | Notes |
|---|---|---|
| `Title` | Title | |
| `Type` | Select | options: `project-note`, `documentation`, `notes`, `flow-map`, `research`, `meeting-notes`, `idea`, `sop`, `reference` |
| `Tags` | Multi-select | |

### Invoices — `NOTION_DATABASE_INVOICES`

| Property | Type | Notes |
|---|---|---|
| `Invoice Number` | Title | |
| `Period Start` | Date | |
| `Period End` | Date | |
| `Hourly Rate` | Number | |
| `Total Hours` | Number | |
| `Total Amount` | Number | |
| `Status` | Select | options: `draft`, `sent`, `paid`, `void` |
| `Summary` | Text | |

## 3. Share each database with the integration

Notion integrations can only see pages/databases explicitly shared with
them. For each of the six databases: open it, use the `•••` menu →
**Connections** (or **Add connections**), and add the integration you
created in step 1.

## 4. Copy each database ID

Open each database as a full page and copy the ID out of the URL:

```
https://www.notion.so/myworkspace/<DATABASE_ID>?v=<VIEW_ID>
```

`<DATABASE_ID>` is a 32-character hex string (Notion also accepts it with
dashes inserted as a UUID — either form works).

## 5. Set environment variables

Copy `.env.example` to `.env.local` (if you haven't already) and fill in
what you're ready to connect:

```bash
NOTION_API_KEY=
NOTION_DATABASE_CLIENTS=
NOTION_DATABASE_PROJECTS=
NOTION_DATABASE_HOURS=
NOTION_DATABASE_WORKLOGS=
NOTION_DATABASE_KNOWLEDGE=
NOTION_DATABASE_INVOICES=
NOTION_SYNC_INTERVAL_MINUTES=5
NOTION_SYNC_ENABLED=false
```

The app reads `NOTION_API_KEY` — not `NOTION_TOKEN` or any other name.
Restart `npm run dev` after editing `.env.local`.

You only need to set the database ids for the entities you're ready to check;
any subset works. Leave `NOTION_SYNC_ENABLED` as `false` (or unset) until
you've reviewed [`docs/notion-migration-plan.md`](notion-migration-plan.md) -
it gates all real push/pull, independently of which database ids are set.

## 6. Verify the connection and database schema

Two separate, both read-only, checks:

- **Test connection** (Notion Connection card, or `GET
  /api/notion/test-connection`): calls Notion's read-only `users.me`
  endpoint to confirm `NOTION_API_KEY` is valid. Doesn't touch any database,
  safe before any database id is set.
- **Verify databases** (Notion Database Mapping card, or `GET
  /api/notion/verify-databases`): for each configured `NOTION_DATABASE_*`
  id, calls `databases.retrieve` + `dataSources.retrieve` (both read-only
  GETs) to confirm the integration can reach it and that its columns match
  what the app expects, reporting exactly which properties are missing or
  the wrong type. Never reads row data, never writes. Use this to validate
  schema before ever setting `NOTION_SYNC_ENABLED=true`.

Once you're ready to exchange real data (push local edits, pull existing
rows), read `docs/notion-migration-plan.md` and then set
`NOTION_SYNC_ENABLED=true`. Only then does **Sync now** actually read/write
the configured databases.

## Safety notes

- **Setting `NOTION_API_KEY` and a database id alone does not push or pull
  anything.** `NOTION_SYNC_ENABLED` (default `false`) is a separate master
  switch checked by `pushEntity`, `pullDatabase`, and `runFullSync` in
  `src/lib/notion/sync-engine.ts` - database ids being set only enables the
  read-only `verify-databases` schema check above.
- **The local mock/seed data is never bulk-pushed.** Pushes only happen when
  a route handler calls `syncEntityNow(...)` after a local create/update —
  there is no "push everything" path. Pre-existing seed rows are pushed only
  if you edit them again after connecting a database *and* enabling sync.
- **Pulls never overwrite an unsynced local edit.** If a record changed
  locally and in Notion since the last sync, `pullDatabase()` records a
  conflict instead of merging — resolve it from Settings ("Keep local" /
  "Keep Notion").
- **Notion is never deleted, moved, or archived by this app.** There is no
  delete/archive/move call anywhere in `src/lib/notion/` - only
  `pages.create`, `pages.update` (push), and read-only retrieve/query calls.
- Start with one database (e.g. Projects) connected and confirm behavior in
  Settings before connecting the rest.
