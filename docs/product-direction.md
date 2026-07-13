# Product Direction: Battle Bound Branding Client Reporting Portal

## What changed

Through Phase 15, this application was effectively a second place to edit contractor operational data (hours, work logs, projects, clients, knowledge) alongside Notion. Phase 16 repositions it:

> Notion is the permanent source of truth. This web application is Battle Bound Branding's professional reporting and invoicing portal for client work.

The application should feel like a polished internal dashboard that reads operational data and produces professional client deliverables — not a duplicate data-entry surface.

## Source of truth boundary

| Data | Source of truth | This app's role |
|---|---|---|
| Hours | Notion | Read; local drafts before Save to Notion |
| Work Done | Notion | Read; local drafts before Save to Notion |
| Projects | Notion | Read; local drafts only (no Notion write route for project edits) |
| Clients | Notion | Read-only |
| Knowledge | Notion | Read-only in Notion mode |
| Invoice metadata | Notion | Read; explicit gated Save Invoice to Notion flow only (unchanged from Phase 13) |

Pages that still expose editing (Hours, Work Done, Projects) show a "Notion is the source of truth" banner in Notion mode and link to the live Notion record via `notionUrl` when one exists. These edit surfaces were kept rather than removed, because Phase 13's Hours/Work Done timer-and-draft workflow is the mechanism that feeds the invoice/report builder — removing it outright would break invoice generation, not just "duplicate editing." Consistent with the Phase 16 brief's instruction to avoid new editing interfaces "unless they are clearly temporary draft fields," these are exactly that: temporary drafts, now labeled as such, that either get promoted to Notion via the existing Save to Notion / Save Invoice to Notion flows or stay purely local.

## Branding

Settings' "Business Branding & Report Settings" card is the single place branding defaults are managed:

- Business Name (defaults to **Battle Bound Branding LLC**)
- Business Logo (URL or path — see "Known limitations" below)
- Business Address
- Business Email
- Business Phone
- Website
- Invoice Footer
- Payment Instructions

These values flow into `ReportSettings` → `ReportDocument.contractor` (`src/lib/reports/engine.ts`) and are applied consistently across the live preview, PDF, print HTML, HTML download, and Markdown export for both the Report Builder and the standalone Invoice export action. No new environment variables were introduced; in Notion mode, `website`, `invoiceFooter`, and `paymentInstructions` are not environment-configurable and always use the Battle Bound Branding defaults, exactly like every other Phase 16 change in this repo.

## Star feature: Invoice Builder

The Report Builder (`/reports`) is the star feature. Its existing single-page flow already covers the required workflow — choose client, choose date range, review included sessions, review included work logs, preview invoice, export, optional Save to Notion — so Phase 16 added a step-orientation strip and prominent business branding rather than rewriting it into a literal multi-page wizard. The underlying gated Save Invoice to Notion flow (confirmation phrase, preflight, `NOTION_INVOICE_SAVE_ENABLED`) is unchanged.

## Home Dashboard

Redesigned around invoice health rather than raw activity: Today's Hours, This Week, This Month, Ready to Invoice, Already Invoiced, Outstanding, Recent Work, Recent Invoices, Recent Projects, and Quick Actions (Generate Invoice, Generate Work Report, View Invoice Dashboard, View Time History). No editing lives on this page.

## New read-only surfaces

- `/clients` and `/clients/[id]` — did not exist before Phase 16. Client is a first-class entity in the data layer (`AppDataProvider.clients`), but had no dedicated page. These pages are fully read-only server components.
- Project detail gained a read-only Invoices section (invoices whose Hours/Work Done relations touch the project).

## Deliberately out of scope for this phase

- **Renaming baked-in identifiers.** The invoice-save confirmation phrase (`SAVE AFP INVOICE`), the historical-import confirmation phrase, the `AFP-YYYY-MM-DD-###` Session ID and `AFP-WORK-...` Work Log ID formats, and the `afp-*` migration-key prefixes are functionally load-bearing — they're tested extensively and, for the migration keys, already written into a live Notion workspace. Renaming these is a coordinated data-migration decision, not a branding pass, and was left untouched.
- **True file-upload logo storage.** `logoPath` remains a URL/path field. A `data:image` URI is embedded directly in generated PDFs; anything else displays as text-only branding. Wiring real upload storage would need the (currently unconfigured) `src/lib/pdf/storage.ts` blob adapter, which is out of scope without a storage provider decision.
- **Dedicated Time Report / Project Report PDF exports.** `GET /api/reports/financial` already computes monthly revenue, client revenue, project profitability, hours-by-project, and invoice aging deterministically; wiring a fourth and fifth branded PDF export type around that data is a reasonable next phase, not done here.
- **A unified cross-entity Work History timeline** with combined date/project/client/invoice-status filtering across Hours and Work Done. The existing Hours and Work Done list pages retain their current filtering; a single combined timeline view is a larger UX project left as a recommendation.

## Safety

No live Notion writes, no new environment variables, no invoice saves outside the existing gated `NOTION_INVOICE_SAVE_ENABLED` flow, and no production deployment were performed as part of this phase.
