# AFP Workspace

A desktop-first contractor workspace for tracking billable hours, documenting completed work, organizing project knowledge, and generating invoice-ready reports — built to synchronize with an existing Notion workspace (Notion remains the source of truth).

This app does not replace Notion. It's a faster, cleaner day-to-day interface on top of it.

## Tech stack

- **Next.js 16** (App Router, Turbopack, React 19)
- **TypeScript** (strict mode)
- **Tailwind CSS v4** + **shadcn/ui** (`base-nova` style, built on [Base UI](https://base-ui.com) rather than Radix)
- **TanStack Query** for client-side data fetching/caching
- **better-sqlite3** as a local cache/offline store (`data/afp-workspace.db`, gitignored)
- **@notionhq/client** for Notion synchronization
- **Electron** scaffold for a packaged desktop build (dev mode is wired up; production packaging is a documented next step, see [Desktop app](#desktop-app))

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). On first run, the app creates `data/afp-workspace.db` and seeds it with representative mock data (one workspace, one client, four projects, ~9 weeks of hours, work logs, knowledge base pages, and invoice reports) so every module is usable immediately — no Notion connection required.

Other scripts:

```bash
npm run build        # production build
npm run start         # run the production build
npm run lint           # eslint
npm run typecheck   # tsc --noEmit
npm run electron:dev    # next dev + an Electron window, together
npm run electron:build  # next build + electron-builder packaging
```

## Feature map

| Sidebar section | Route | What it does |
|---|---|---|
| Dashboard | `/` | Today/week/month hours, current invoice estimate, hourly rate, active project, recent work, recent notes, upcoming tasks, Notion sync status |
| Hours Worked | `/hours` | Database-driven time table, auto hour calculation, running weekly/monthly totals, timer mode, manual entry mode |
| Work Done | `/work-done`, `/work-done/[id]` | Work log entries with engineering notes and invoice description edited **separately**, status/priority, related hours & knowledge, evidence, attachments |
| Invoice Reports | `/invoices`, `/invoices/[id]` | Auto-generated weekly reports from logged hours + work, export to PDF / Markdown / clipboard |
| Projects | `/projects`, `/projects/[id]` | The hub connecting hours, work logs, and documentation per project |
| Documentation / Notes / Flow Maps / Research / Meeting Notes | `/knowledge/[type]`, `/knowledge/page/[id]` | Nested knowledge base pages, tags, in-app search, `[[wiki-link]]` backlinks |
| Settings | `/settings` | Client/hourly-rate config, Notion connection status, sync conflicts, desktop app info |

Global search (`⌘K` / `Ctrl+K`) searches across hours, work logs, projects, and the knowledge base at once.

## Architecture

The data model is intentionally generic rather than AFP-specific, so more contractor clients can be added later without a rebuild:

```
Workspace -> Client -> Project -> { HoursEntry, WorkLog, KnowledgePage, InvoiceReport }
```

See [`src/types/domain.ts`](src/types/domain.ts) for the full model.

```
src/
  app/                  # routes (pages) + app/api/** route handlers
  features/<name>/      # api.ts, hooks/, components/, lib/ per module
  components/
    ui/                 # shadcn/ui primitives
    layout/              # sidebar, top bar, providers, theme
  lib/
    db/                  # SQLite client, schema, generic repository, per-entity repositories
    notion/               # Notion client, database<->domain mappers, sync engine
    mock-data/            # seed data generator
    calculations.ts       # hours/currency math shared by Hours + Invoices
  types/domain.ts        # the entity contracts everything else is built on
electron/                 # Electron main/preload processes
```

Every module (Dashboard, Hours, Work Done, Invoices, Knowledge, Projects, Settings) follows the same shape: a Next.js route reads from the SQLite-backed repository layer directly (Server Components) or through its own `app/api/<module>` route handlers (client mutations), a `features/<module>/api.ts` typed fetch client, React Query hooks, and presentational components.

### Local SQLite cache

`src/lib/db` is the local cache: a generic `createRepository<T>()` factory (`src/lib/db/repository.ts`) backs one typed repository per entity (`workspaceRepo`, `clientRepo`, `projectRepo`, `hoursRepo`, `workLogRepo`, `knowledgeRepo`, `invoiceRepo`). It's what every route handler reads from and writes to; Notion sync reconciles it against the real Notion databases in the background.

### Notion synchronization

`src/lib/notion/sync-engine.ts` implements:

- **Push on edit** — every create/update in a route handler calls `syncEntityNow(entityType, id)`, which queues the change and, if Notion is configured, pushes it immediately.
- **Pull on startup + background** — `useBackgroundSync()` (mounted once in the root providers) triggers a sync when the app loads and again on an interval (`NOTION_SYNC_INTERVAL_MINUTES`, default 5).
- **Manual sync** — the "Sync now" button in the top bar and in Settings.
- **Conflict detection** — on pull, if a record changed locally *and* in Notion since the last sync, the local copy is left untouched, marked `conflict`, and recorded in a conflicts table instead of being silently overwritten. Resolve conflicts ("Keep local" / "Keep Notion") from **Settings**.

Sync status is visible in the top bar at all times and on the Dashboard.

**Without Notion configured** (the default state), all of this safely no-ops to "local-only" — the app is fully usable on mock/local data alone, per the build spec.

## Environment variables

Copy `.env.example` to `.env.local` and fill in what you have. All Notion variables are optional — omit them to run entirely on the local SQLite cache.

| Variable | Required | Description |
|---|---|---|
| `NOTION_API_KEY` | for sync | Notion internal integration token ([notion.so/my-integrations](https://notion.so/my-integrations)). Share each database below with this integration. |
| `NOTION_DATABASE_CLIENTS` | for client sync | Database ID for Clients |
| `NOTION_DATABASE_PROJECTS` | for project sync | Database ID for Projects |
| `NOTION_DATABASE_HOURS` | for hours sync | Database ID for Hours entries |
| `NOTION_DATABASE_WORKLOGS` | for work-log sync | Database ID for Work Done entries |
| `NOTION_DATABASE_KNOWLEDGE` | for knowledge sync | Database ID for Work Stuff / knowledge pages |
| `NOTION_DATABASE_INVOICES` | for invoice sync | Database ID for Invoice Reports |
| `NOTION_SYNC_INTERVAL_MINUTES` | no (default `5`) | How often background sync runs while the app is open |

Each Notion database is expected to have specific column names matching what's pushed/pulled — see the `NOTION_SCHEMA` map in [`src/lib/notion/mappers.ts`](src/lib/notion/mappers.ts) for the exact property names per entity (e.g. the Hours database needs `Date`, `Start Time`, `End Time`, `Break (min)`, `Total Hours`, `Hourly Rate`, `Billable`, `Location`, `Notes`). Either match your existing AFP-Work database columns to that list, or edit the map to match your columns — the two just need to agree. Sync is only enabled per-entity once both `NOTION_API_KEY` and that entity's database ID are set; any subset can be configured independently.

You only need to set the ones you're ready to connect — sync is per-entity and partial configuration is fine.

## Desktop app

The app is architected to run inside Electron (`electron/main.js`, `electron/preload.js`):

- `npm run electron:dev` — runs `next dev` and an Electron window together (the window loads `http://localhost:3000`, since the SQLite cache and Notion sync need a real Node server, not a static export).
- `npm run electron:build` — runs `next build` then `electron-builder` using the packaging config in `package.json`'s `"build"` field.

Packaging a fully distributable binary still needs one more step beyond this scaffold: the packaged app has no bundled server to point at, so `electron/main.js`'s production path (currently `waitForServer` + `loadURL` against `localhost:3000`) needs to spawn a bundled Next.js server (e.g. `next build --experimental-build-mode=standalone` output) instead of assuming `next dev` is already running. That's called out as the next recommended step in `DevUpdates.md`.

## Development log

See [`DevUpdates.md`](DevUpdates.md) — an append-only log of what was built, when, and what's next.
