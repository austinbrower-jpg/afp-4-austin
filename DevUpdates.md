# Dev Updates

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
