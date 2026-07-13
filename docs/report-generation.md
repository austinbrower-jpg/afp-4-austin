# Report Generation

The report composition system at `/reports` previews and exports client-facing invoices and work reports without changing source Hours Worked, Work Done, Knowledge, or Project records. In Notion mode it reads current rows directly through the production provider; it never requires the general sync engine.

## Report types

### Simple Invoice

- Contractor/business and client billing identity
- Invoice number, invoice date, billing period, due date, and terms
- Brief summary
- Project totals
- Total exact billable time, hourly rate(s), and amount due
- Optional invoice notes

### Detailed Invoice

Includes everything in the Simple Invoice plus each approved billable session (date, start/end, exact duration, project, draft client-visible description, rate, amount), daily subtotals, and project subtotals.

### Detailed Work Log Report

- Report identity, "Prepared for" (client) and "Prepared by" (business name), period, and executive summary
- Completed Work — daily client-visible Work Done entries with deliverables, testing/verification, client-visible blockers, follow-ups, and evidence
- Screenshots — placeholder section reserved for a future attachment workflow
- Evidence Links — consolidated list of every evidence link across included work items
- Work Log — a raw session-level time table (date, time, project, duration) independent of the narrative Completed Work section
- Related client-visible Knowledge summaries and source links
- Related time per work entry
- Hours by day and Project Summary
- Time Summary — total billable and non-billable time
- Professional footer with the invoice footer text and business name

## Read-only and immutable behavior

`src/lib/reports/engine.ts` is pure. It accepts a report-only dataset projection, local report settings, and builder input, then returns a sanitized `ReportDocument`.

- Preview and export require no server write.
- Draft description edits live only in copied builder state.
- Reloading the builder restores the source description.
- Source objects are never mutated; automated tests compare them before and after composition.
- `ReportDocument` has no `internalNotes` property, so Markdown, HTML, PDF input, clipboard, and JSON serialization cannot expose it.
- **Save Invoice to Notion** (Phase 13) is a separate explicit action in Report Builder. Preview, print, PDF, Markdown, JSON, and clipboard never save. Saving requires read-only preflight, reconciliation, typed confirmation (`SAVE AFP INVOICE`), and `NOTION_INVOICE_SAVE_ENABLED=true`. See [invoice-locking.md](./invoice-locking.md).

## Privacy rules

Work Done is eligible only when:

1. `Client Visible` is exactly `true`.
2. An invoice also has `Include in Invoice` exactly `true`.
3. A work report also has `Include in Work Report` exactly `true`.

Knowledge is eligible only when `Client Visible` and `Include in Work Report` are both exactly `true`, and a non-empty `Report Summary` exists. Missing flags default to excluded. The builder shows each excluded record and its reason before export.

Hours require a related approved Work Done record and a non-empty client-visible description. Non-billable hours are excluded from invoices but included in work reports when related to approved client-visible work.

Local mock compatibility is intentionally narrow: the existing domain already defines `invoiceDescription` as client-facing, so a populated local/mock value is projected as the visibility opt-in. Cached Notion rows do not receive that fallback; until the proposed fields exist and are mapped, missing flags remain excluded.

**Superseded** Hours (migration key prefix `afp-history-v2-superseded-` or Billing Status = Superseded) remain visible in the Hours list but are excluded from dashboard totals, invoices, and work reports.

## Explicit relation matching (Phase 11)

Report Builder resolves Hours → Work Done in this order:

1. **Explicit** — Hours `Related Work Done` relation
2. **Reciprocal** — Work Done `Related Hours` pointing back
3. **Legacy fallback** — same date + same project (single candidate only)
4. **Ambiguous** — multiple candidates → excluded
5. **Missing** — no safe match

Each excluded Hours row shows the match source label and precise include/exclude reason in the builder panel.

## Exact-minute billing

Billing never uses persisted `totalHours` rounding:

```text
exactMinutes = elapsed clock minutes - break minutes
lineAmount = roundToCents(exactMinutes / 60 × hourlyRate)
invoiceTotal = sum(lineAmount)
```

Overnight sessions are supported. The corrected July 8–10 operational dataset produces **987 billable minutes**, **120 non-billable minutes**, and exactly **$493.50** at $30/hr (quarantine row excluded).

## Data-source selection

`GET /api/report-builder` returns mode-appropriate independent datasets and never merges them:

| UI label | Contents |
|---|---|
| Notion data | Current Clients, Projects, Hours, Work Done, Knowledge, and Invoice Reports queried directly from Notion |
| Historical preview data | Approved deterministic July 8–9 source transcription |
| July 8–10 corrected dataset | Operational July 8–10 preview with explicit relations and quarantine row |
| Local mock data | SQLite development rows, available only when `APP_DATA_SOURCE=mock` |

Notion mode never loads or mixes local mock rows. The deterministic historical preview remains separately selectable for reconciliation and is never imported. Empty sources and periods render a useful empty state.

## Local report settings and branding (Phase 16)

Mock mode stores contractor name, business name, email, phone, address, website, default rate/terms/notes, logo path, invoice footer, payment instructions, and client billing identity in the local-only `report_settings` SQLite table, editable from the Settings page's "Business Branding & Report Settings" card. These values become the defaults for every export (PDF, print HTML, Markdown, HTML, and the live preview) — the business name defaults to **Battle Bound Branding LLC**.

In Notion mode most of these values come from server-side `REPORT_*` environment variables and the Settings form is read-only; `website`, `invoiceFooter`, and `paymentInstructions` are not environment-configurable (no new env vars were introduced for Phase 16) and instead always use the Battle Bound Branding defaults in Notion mode, so Vercel has no local persistence dependency.

## Export formats

- **PDF** — jsPDF letter layout, repeating branded header (embeds the business logo when `logoPath` is a `data:image` URI), safe wrapping, page breaks, a branded footer with the invoice footer text, and page `n of total`.
- **Print HTML** — standalone letter-size HTML with repeating table headers, print page-break controls, and a Print / save PDF button.
- **HTML download** — the same standalone print document.
- **Markdown** — client-facing report content only.
- **Clipboard** — copies the Markdown representation.
- **JSON** — deterministic sanitized `ReportDocument` audit snapshot; internal notes are absent and titles of privacy-excluded records are redacted.

## Proposed Notion fields (previewed, not applied)

### Work Done

| Field | Proposed type |
|---|---|
| Client Visible | checkbox |
| Include in Invoice | checkbox |
| Include in Work Report | checkbox |
| Detailed Work Description | rich text |
| Internal Notes | rich text |
| Evidence Links | rich text or URL |
| Related Hours | relation to Hours Worked, if safely supported |

### Knowledge / Work Stuff

| Field | Proposed type |
|---|---|
| Client Visible | checkbox |
| Include in Work Report | checkbox |
| Report Summary | rich text |
| Project | relation to Projects |
| Source Page | URL |

The exact Phase 8 additive preview is recorded in `src/lib/notion/schema-requirements.ts`, shown in Settings, and returned with live read-only verification by `GET /api/notion/schema-preview`. Related Hours remains deferred. No schema update API is implemented or called.

Phase 11 adds a fuller relational proposal in `src/lib/notion/relational-schema-proposal.ts` (Session ID, Client/Invoice relations, Billing Status, Approval Status, etc.). See [notion-relational-model.md](./notion-relational-model.md). `GET /api/notion/relation-backfill-preview` returns a read-only July 8–10 backfill preview with no writes.

## Invoice locking and explicit save (Phase 13)

Phase 13 wires explicit invoice save, Hours locking, and duplicate-billing prevention. Live writes are gated by `NOTION_INVOICE_SAVE_ENABLED=false` (default).

- `POST /api/invoices/save-preflight` — read-only preflight (`writesPerformed=false`)
- `POST /api/invoices/save` — gated explicit save with confirmation phrase
- `GET /api/invoices/[id]/preview` — immutable saved-invoice preview from Included relations only

See [invoice-locking.md](./invoice-locking.md).
