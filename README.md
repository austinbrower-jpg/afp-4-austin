# AFP Workspace

A private contractor workspace for Hours Worked, Work Done, projects, knowledge, and invoice/work-report generation. The browser app can run with seeded local data or use Notion as its production source of truth.

## Runtime modes

The data source is selected once on the server through `APP_DATA_SOURCE`:

| Mode | Storage | Intended use |
|---|---|---|
| `mock` | Local SQLite seed/database | Local development, tests, optional fallback |
| `notion` | Six Notion databases | Daily use and Vercel |

Vercel production refuses `mock`. Notion mode requires all Notion credentials, never imports SQLite, and does not silently fall back. The active source and a manual refresh control appear in the UI. Responses use `no-store`, and client queries refetch on focus.

Copy `.env.example` to `.env.local`, then start the app:

```bash
npm install
APP_DATA_SOURCE=mock npm run dev
```

For live read-only verification, fill in the seven Notion variables and run `APP_DATA_SOURCE=notion NOTION_SYNC_ENABLED=false npm run dev`. Do not submit a Save to Notion form unless a targeted write is intended.

## Notion-native architecture

`src/lib/data/provider.ts` selects a typed provider for Clients, Projects, Hours Worked, Work Done, Knowledge, and Invoice Reports. UI and report logic consume shared domain models rather than storage-specific shapes.

- The mock provider dynamically imports SQLite only after `mock` is selected.
- The Notion provider resolves database data sources, maps properties centrally, caches only request-local client lookups, and returns row-level validation warnings for malformed data.
- Live page/API reads query Notion directly and never mix mock rows.
- Clients and Knowledge are read-only in Notion mode.
- Dedicated Hours, Work Done, and Projects POST/PATCH routes perform schema validation and targeted writes.
- Invoice metadata can be saved only through the explicit **Save Invoice to Notion** flow in Report Builder after read-only preflight and typed confirmation. Live save requires `NOTION_INVOICE_SAVE_ENABLED=true`. See [invoice-locking.md](docs/invoice-locking.md).
- Notion deletes/archives are not supported.

The legacy general sync engine is not used. `NOTION_SYNC_ENABLED` must remain `false`; setting it to `true` fails runtime validation. Historical import endpoints remain separate and are never called during normal operation.

## Daily workflow

The timer runs in browser storage. Stopping it creates a local draft with exact start/end timestamps. Manual entries are drafts too. Nothing is written until **Save to Notion** is selected. Billing uses elapsed minutes minus breaks and rounds only the final line amount.

Work Done drafts include privacy controls, invoice/detailed descriptions, internal notes, and evidence links. Internal notes have no client-facing report field and are excluded by the report serializers. Saved records expose their Notion page link.

## Reports

`/reports` generates Simple Invoice, Detailed Invoice, and Detailed Work Log Report outputs from the selected provider. In Notion mode the rows are current Notion data; source records remain immutable while preview text is edited. Report Builder supports explicit relation matching (Hours ↔ Work Done), superseded-row exclusion, and a read-only July 8–10 corrected dataset reconciling to **987 billable minutes**, **120 non-billable minutes**, and **$493.50**.

Phase 11 adds a read-only relation backfill preview at `/settings/relation-backfill-preview` and documents an additive relational schema proposal (not applied live). See [docs/notion-relational-model.md](docs/notion-relational-model.md).

See [docs/report-generation.md](docs/report-generation.md).

## Safety and deployment

All Notion secrets stay in server-only modules. `/api/health` reports safe configuration state without returning credentials. Production requires either:

- Vercel Deployment Protection, recorded with `VERCEL_DEPLOYMENT_PROTECTION=true`; or
- shared Basic Auth using `APP_ACCESS_USERNAME` and `APP_ACCESS_PASSWORD`.

Basic Auth is intentionally simple single-user protection, not account management or per-action authorization. Use a strong unique password and Vercel HTTPS.

Deployment instructions, environment variables, preview checks, and rollback are in [docs/vercel-deployment.md](docs/vercel-deployment.md). Runtime behavior and both-Mac setup are in [docs/notion-production-mode.md](docs/notion-production-mode.md).

## Commands

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run dev
```

## Feature routes

| Route | Purpose |
|---|---|
| `/` | Dashboard and runtime status |
| `/hours` | Timer, manual drafts, and saved hours |
| `/work-done` | Work Done list, create, and detail editing |
| `/projects` | Project list and targeted project editing |
| `/knowledge/*` | Read-only live knowledge in Notion mode |
| `/invoices` | Invoice Report metadata |
| `/reports` | Invoice and work-report preview/export |
| `/settings` | Runtime status, schema preview, read-only verification |
| `/settings/relation-backfill-preview` | Read-only July 8–10 explicit relation backfill preview |
| `/api/health` | Unauthenticated secret-safe health status |

The Electron scaffold and historical migration tooling remain available for local development. They are not part of the Vercel production persistence path.

## Phase 15 production hardening

Phase 15 adds a read-only Invoice Dashboard at `/invoices/dashboard`, financial reporting models, richer invoice search helpers, invoice timelines, a future PDF storage abstraction, centralized API error formatting, and Notion adapter helper utilities. These additions are code-only and do not enable live Notion writes or production deployment.
