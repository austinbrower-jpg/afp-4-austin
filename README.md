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
npm test                # vitest run — calculations, invoices, migrations, reports
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
| Report Builder | `/reports` | Read-only Simple Invoice, Detailed Invoice, and Detailed Work Log Report previews with privacy diagnostics and PDF / HTML / Markdown / clipboard / JSON exports |
| Projects | `/projects`, `/projects/[id]` | The hub connecting hours, work logs, and documentation per project |
| Documentation / Notes / Flow Maps / Research / Meeting Notes | `/knowledge/[type]`, `/knowledge/page/[id]` | Nested knowledge base pages, tags, in-app search, `[[wiki-link]]` backlinks |
| Settings | `/settings` | Client/hourly-rate config, local contractor/report defaults, Notion connection status, sync conflicts, desktop app info |

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
    reports/               # pure filtering, privacy, billing, composition, serializers
  types/domain.ts        # the entity contracts everything else is built on
electron/                 # Electron main/preload processes
```

Every module (Dashboard, Hours, Work Done, Invoices, Reports, Knowledge, Projects, Settings) follows the same shape: a Next.js route reads from the SQLite-backed repository layer directly (Server Components) or through its own `app/api/<module>` route handlers, a typed fetch boundary, React Query hooks where needed, and presentational components.

## Report generation

The dedicated [Report Builder](http://localhost:3000/reports) composes three client-facing formats without saving or changing any source records:

- **Simple Invoice** — contractor/client identity, billing period, project totals, exact billable time, rate, amount due, and notes.
- **Detailed Invoice** — the Simple Invoice plus every approved billable session, exact duration, client-visible description, daily subtotals, and project subtotals.
- **Detailed Work Log Report** — executive summary, daily client-visible Work Done, related knowledge, deliverables, testing, blockers/follow-ups, evidence, and billable/non-billable time breakdowns.

Exports include PDF, standalone print-friendly HTML, Markdown download, Markdown clipboard copy, and a deterministic JSON audit snapshot. Billing uses exact elapsed minutes: `exactMinutes / 60 × hourlyRate`, rounding only each final line amount to cents. The approved July 8–9 historical preview therefore reconciles to **$311.00**.

The builder never mixes sources. It labels and isolates:

- **Notion data** — cached rows that have a Notion page id; missing proposed visibility flags default to excluded.
- **Historical preview data** — the approved deterministic July 8–9 preview, available without running the historical import.
- **Local mock data** — SQLite development rows. A populated legacy `invoiceDescription` is treated as the local/mock opt-in because that field is already explicitly client-facing.

Report settings in Settings are stored only in the local `report_settings` repository and have no Notion ids or sync path. The future **Save report metadata to Invoice Reports** action is visible but disabled as **Not enabled yet**. See [`docs/report-generation.md`](docs/report-generation.md) for the privacy model, source behavior, schema proposal, and export details.

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
| `NOTION_SYNC_ENABLED` | no (default `false`) | Master switch for real push/pull. Database ids alone only enable the read-only schema check below — this must also be `true` before anything is written to or imported from Notion. |

Each Notion database is expected to have specific column names matching what's pushed/pulled — see the `NOTION_SCHEMA` map in [`src/lib/notion/mappers.ts`](src/lib/notion/mappers.ts) for the exact property names per entity (e.g. the Hours database needs `Date`, `Start Time`, `End Time`, `Break (min)`, `Total Hours`, `Hourly Rate`, `Billable`, `Location`, `Notes`). Either match your existing AFP-Work database columns to that list, or edit the map to match your columns — the two just need to agree. Sync is only enabled per-entity once `NOTION_API_KEY`, that entity's database ID, and `NOTION_SYNC_ENABLED=true` are all set; any subset of databases can be configured independently.

You only need to set the ones you're ready to connect — sync is per-entity and partial configuration is fine.

**Setting up Notion from scratch?** See [`docs/notion-setup.md`](docs/notion-setup.md) for step-by-step instructions on creating the integration and all six databases with the exact property schema each one needs. **Connecting existing Notion pages that already have content?** Read [`docs/notion-migration-plan.md`](docs/notion-migration-plan.md) first — it explains exactly what is and isn't touched at each step.

Once `NOTION_API_KEY` is set, use the **Test connection** button on the Notion Connection card in Settings (or `GET /api/notion/test-connection`) to verify the key works. That check only calls Notion's read-only `users.me` endpoint — it never queries or writes to a database, so it's safe to run before any `NOTION_DATABASE_*` id is configured. Once database ids are set, use **Verify databases** on the Notion Database Mapping card (or `GET /api/notion/verify-databases`) to check each one is accessible and its schema matches — also fully read-only, and independent of `NOTION_SYNC_ENABLED`.

## Desktop app

The app is architected to run inside Electron (`electron/main.js`, `electron/preload.js`):

- `npm run electron:dev` — runs `next dev` and an Electron window together (the window loads `http://localhost:3000`, since the SQLite cache and Notion sync need a real Node server, not a static export).
- `npm run electron:build` — runs `next build` then `electron-builder` using the packaging config in `package.json`'s `"build"` field.

Packaging a fully distributable binary still needs one more step beyond this scaffold: the packaged app has no bundled server to point at, so `electron/main.js`'s production path (currently `waitForServer` + `loadURL` against `localhost:3000`) needs to spawn a bundled Next.js server (e.g. `next build --experimental-build-mode=standalone` output) instead of assuming `next dev` is already running. That's called out as the next recommended step in `DevUpdates.md`.

## Development log

See [`DevUpdates.md`](DevUpdates.md) — an append-only log of what was built, when, and what's next.
