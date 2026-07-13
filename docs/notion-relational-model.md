# Notion Relational Model (Phase 11 Proposal)

This document describes the **additive-only** relational schema proposal for AFP Workspace. Nothing in this document is applied to live Notion automatically.

## Design principles

- Additive only — no renames, deletions, or type changes to existing properties
- Migration Key values are preserved; Session ID and Work Log ID are separate stable identities
- Explicit relations replace date/project inference as the primary matching strategy
- Legacy date+project fallback remains for transitional rows but rejects ambiguous matches

## Proposed properties by database

### Hours Worked

| Property | Type | Relation target | Reciprocal |
|---|---|---|---|
| Session ID | rich_text | — | — |
| Client | relation | Clients | Hours Worked (on Clients) |
| Related Work Done | relation | Work Done | Related Hours |
| Invoice Report | relation | Invoice Reports | Included Hours |
| Billing Status | select | Draft, Reviewed, Ready to Invoice, Invoiced, Paid, **Superseded** | — |

### Work Done

| Property | Type | Relation target | Reciprocal |
|---|---|---|---|
| Work Log ID | rich_text | — | — |
| Client | relation | Clients | Work Done |
| Related Hours | relation | Hours Worked | Related Work Done |
| Invoice Report | relation | Invoice Reports | Included Work Done |
| Approval Status | select | Draft, Needs Review, Approved, Sent to Client, Archived | — |

### Invoice Reports

| Property | Type | Relation target | Reciprocal |
|---|---|---|---|
| Client | relation | Clients | Invoice Reports |
| Included Hours | relation | Hours Worked | Invoice Report |
| Included Work Done | relation | Work Done | Invoice Report |
| Invoice Date | date | — | — |
| Due Date | date | — | — |
| Payment Terms | rich_text | — | — |
| Sent Date | date | — | — |
| Paid Date | date | — | — |
| PDF URL | url | — | — |
| Status | select | Draft, Generated, Sent, Paid, Overdue, Cancelled | — |

### Projects

| Property | Type | Relation target | Reciprocal |
|---|---|---|---|
| Client | relation | Clients | Projects |

## Stable identities

### Session ID

Format: `AFP-YYYY-MM-DD-###`

- Immutable once assigned
- Deterministic for historical backfill (sorted by start time within each date)
- Collision-safe for new records on the same date
- Does not replace Migration Key

### Work Log ID

Format: `AFP-WORK-YYYY-MM-DD-###`

Same rules as Session ID, scoped to Work Done rows.

## Quarantine / superseded rows

A Hours row is **superseded** when:

1. Migration Key starts with `afp-history-v2-superseded-`, or
2. Billing Status = Superseded

Superseded rows:

- Remain visible in Hours with a **Superseded / Do Not Bill** badge
- Are excluded from dashboard, weekly/monthly, invoice, and work report totals
- Appear in diagnostics as `Superseded historical record`
- Are never deleted automatically

## Report Builder matching

1. Hours → Related Work Done (Explicit)
2. Work Done → Related Hours (Reciprocal)
3. Legacy date + project (single candidate only)
4. Reject ambiguous fallback matches
5. Never match date-only when multiple Work Done candidates exist on the same date

## Invoice locking (read-only architecture)

Implemented in `src/lib/invoices/invoice-locking.ts`:

- Invoice relations to Client, Hours, and Work Done are planned before explicit save
- Hours Billing Status becomes **Invoiced** only during explicit save (not preview/export)
- Hours already tied to another non-cancelled invoice are refused
- Partial failures are reported per row; retries are idempotent

## Backfill preview

`GET /api/notion/relation-backfill-preview` (read-only) proposes relations for the corrected July 8–10 dataset:

| Operational Hours | |
|---|---|
| Jul 8 09:00–11:00 | non-billable, no project |
| Jul 8 11:00–13:00 | billable, BOL Review Process V2 |
| Jul 8 14:00–17:49 | billable, Power Automate Documentation |
| Jul 9 09:12–14:00 | billable, BOL Review Process V2 |
| Jul 10 08:40–14:30 | billable, BOL Review Process V2 |

Quarantine row: Jul 8 17:10–17:49 (`afp-history-v2-superseded-*`)

Expected totals (operational): 987 billable min, 120 non-billable min, $493.50

## Verification

- `GET /api/notion/schema-preview` — relational proposal + live property checks
- `GET /api/notion/verify-databases` — existing six-database contract (unchanged)
- Settings → Relation Backfill Preview — UI for July 8–10 proposal

## Source files

| Module | Purpose |
|---|---|
| `src/lib/notion/relational-schema-proposal.ts` | Additive schema design |
| `src/lib/notion/identity/session-id.ts` | Session ID helpers |
| `src/lib/notion/identity/work-log-id.ts` | Work Log ID helpers |
| `src/lib/notion/quarantine.ts` | Superseded detection |
| `src/lib/reports/relation-matching.ts` | Explicit matching order |
| `src/lib/invoices/invoice-locking.ts` | Invoice lock plan (no live writes) |
| `src/lib/notion/relation-backfill/preview.ts` | July 8–10 backfill preview |
