# Report Generation

Phase 7 adds a read-only report composition system at `/reports`. It does not save report records, modify Hours Worked / Work Done / Knowledge records, apply Notion schema changes, or require two-way Notion sync.

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
- “Save report metadata to Invoice Reports” is disabled and labeled **Not enabled yet**.

## Privacy rules

Work Done is eligible only when:

1. `Client Visible` is exactly `true`.
2. An invoice also has `Include in Invoice` exactly `true`.
3. A work report also has `Include in Work Report` exactly `true`.

Knowledge is eligible only when `Client Visible` and `Include in Work Report` are both exactly `true`, and a non-empty `Report Summary` exists. Missing flags default to excluded. The builder shows each excluded record and its reason before export.

Hours require a related approved Work Done record and a non-empty client-visible description. Non-billable hours are excluded from invoices but included in work reports when related to approved client-visible work.

Local mock compatibility is intentionally narrow: the existing domain already defines `invoiceDescription` as client-facing, so a populated local/mock value is projected as the visibility opt-in. Cached Notion rows do not receive that fallback; until the proposed fields exist and are mapped, missing flags remain excluded.

## Exact-minute billing

Billing never uses persisted `totalHours` rounding:

```text
exactMinutes = elapsed clock minutes - break minutes
lineAmount = roundToCents(exactMinutes / 60 × hourlyRate)
invoiceTotal = sum(lineAmount)
```

Overnight sessions are supported. The approved historical preview produces 622 billable minutes (10h 22m) and exactly **$311.00**.

## Data-source selection

The read-only `GET /api/report-builder` projection returns three independent datasets and never merges them:

| UI label | Contents |
|---|---|
| Notion data | SQLite cache rows with a non-null Notion page id |
| Historical preview data | Approved deterministic July 8–9 source transcription |
| Local mock data | SQLite rows without a Notion page id |

Notion is recommended when cached Notion hours exist; otherwise the approved historical preview is recommended. Empty sources and periods render a useful empty state.

## Local report settings

Settings stores contractor name, business name, email, phone, address, default rate/terms/notes, optional logo path, and client billing identity in the local-only `report_settings` SQLite table. The table has no sync metadata and is never passed to the Notion sync engine.

## Export formats

- **PDF** — jsPDF letter layout, repeating branded header, safe wrapping, page breaks, and page `n of total` footer.
- **Print HTML** — standalone letter-size HTML with repeating table headers, print page-break controls, and a Print / save PDF button.
- **HTML download** — the same standalone print document.
- **Markdown** — client-facing report content only.
- **Clipboard** — copies the Markdown representation.
- **JSON** — deterministic sanitized `ReportDocument` audit snapshot; internal notes are absent and titles of privacy-excluded records are redacted.

## Proposed Notion fields (documented, not applied)

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

The typed proposal is also recorded in `src/lib/reports/schema-proposal.ts` for validation and future migration work. Phase 7 does not call a Notion schema update API.
