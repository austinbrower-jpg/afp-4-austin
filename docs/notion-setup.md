# Notion database setup

This app runs entirely on the local SQLite cache (`data/afp-workspace.db`) by
default — no Notion account is required to use it. This guide is only for
connecting it to a real Notion workspace so the sync engine
(`src/lib/notion/sync-engine.ts`) can push/pull each entity type.

Sync is **per-entity and additive**: you can connect zero, one, or all six
databases, and the app stays fully usable on local data for anything not yet
connected. Nothing here pushes the local mock/seed data into Notion — see
[Safety notes](#safety-notes) below.

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
```

The app reads `NOTION_API_KEY` — not `NOTION_TOKEN` or any other name.
Restart `npm run dev` after editing `.env.local`.

You only need to set the database ids for the entities you're ready to sync;
any subset works, and sync is disabled per-entity when its id is missing
(`isNotionConfigured()` / `databaseIdFor()` in `src/lib/notion/config.ts`).

## 6. Verify the connection

Open **Settings** in the app and use the **Test connection** button on the
Notion Connection card (or `GET /api/notion/test-connection`). This calls
Notion's read-only `users.me` endpoint to confirm `NOTION_API_KEY` is valid —
it does not query or write to any database, so it's safe to run before any
database id is set. Once you're ready to exchange real data, use **Sync
now**, which does read/write the configured databases.

## Safety notes

- **Setting `NOTION_API_KEY` alone does not push anything.** Every push/pull
  in `src/lib/notion/sync-engine.ts` first checks `databaseIdFor(type)` and
  no-ops per entity type when that entity's database id isn't set.
- **The local mock/seed data is never bulk-pushed.** Pushes only happen when
  a route handler calls `syncEntityNow(...)` after a local create/update —
  there is no "push everything" path. Pre-existing seed rows are pushed only
  if you edit them again after connecting a database.
- **Pulls never overwrite an unsynced local edit.** If a record changed
  locally and in Notion since the last sync, `pullDatabase()` records a
  conflict instead of merging — resolve it from Settings ("Keep local" /
  "Keep Notion").
- Start with one database (e.g. Projects) connected and confirm behavior in
  Settings before connecting the rest.
