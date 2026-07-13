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

- Report identity, client, period, and executive summary
- Daily client-visible Work Done entries
- Deliverables, testing/verification, client-visible blockers, follow-ups, and evidence
- Related client-visible Knowledge summaries and source links
- Related time per work entry
- Hours by day and project
- Total billable and non-billable time

## Read-only and immutable behavior

`src/lib/reports/engine.ts` is pure. It accepts a report-only dataset projection, local report settings, and builder input, then returns a sanitized `ReportDocument`.

- Preview and export require no server write.
- Draft description edits live only in copied builder state.
- Reloading the builder restores the source description.
- Source objects are never mutated; automated tests compare them before and after composition.
- `ReportDocument` has no `internalNotes` property, so Markdown, HTML, PDF input, clipboard, and JSON serialization cannot expose it.
- “Save invoice metadata to Notion” is available only for a Notion-backed invoice after at least one export. It creates only an Invoice Reports metadata page after a second explicit click and does not write draft descriptions to source records.

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

## Local report settings

Mock mode stores contractor name, business name, email, phone, address, default rate/terms/notes, optional logo path, and client billing identity in the local-only `report_settings` SQLite table. In Notion mode these values come from server-side `REPORT_*` environment variables and the Settings form is read-only, so Vercel has no local persistence dependency.

## Export formats

- **PDF** — jsPDF letter layout, repeating branded header, safe wrapping, page breaks, and page `n of total` footer.
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
