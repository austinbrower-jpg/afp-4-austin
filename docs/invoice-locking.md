# Invoice Locking and Explicit Save (Phase 13)

Phase 13 completes the invoice workflow: a reviewed invoice can be explicitly saved to Notion, included Hours are locked against duplicate billing, and immutable invoice history is preserved.

**Live writes remain gated.** Set `NOTION_INVOICE_SAVE_ENABLED=true` only after reviewing the read-only preflight report. `NOTION_SYNC_ENABLED` must remain `false`.

## Explicit save flow

1. Build and preview an invoice in Report Builder (`/reports`).
2. Run **Save preflight** — read-only; `writesPerformed=false`.
3. Review duplicate-billing diagnostics, included Hours/Work Done counts, and reconciled totals.
4. Type the confirmation phrase: `SAVE AFP INVOICE`.
5. Click **Save Invoice to Notion** (only when `NOTION_INVOICE_SAVE_ENABLED=true`).

Preview, print, PDF, Markdown, JSON, and clipboard actions never save.

### Save gating

Save is disabled until:

- A preview exists with at least one billable Hours row
- Client is selected
- Invoice number is present
- Date range is valid
- Totals reconcile
- No duplicate-billing conflicts
- Confirmation phrase matches exactly

## Status mapping (live legacy values)

The live Notion `Status` select is **not mutated** in Phase 13. Application behavior:

| Status | Behavior |
|--------|----------|
| `draft` | Invoice metadata saved; included Hours linked and marked **Invoiced**; editable via explicit update flow |
| `sent` | Locked from ordinary edits |
| `paid` | Fully locked |
| `void` | Invoice remains historical; included Hours may become eligible again only through an explicit reviewed unlock flow (**not implemented in Phase 13**) |

Void invoices do **not** automatically unlock Hours for re-billing.

## Lock behavior

On explicit save (write order):

1. **Preflight** — duplicate billing, lifecycle, and reconciliation checks
2. **Create or resolve** Invoice Report (idempotent by invoice number)
3. **Link** Included Hours and Included Work Done on the Invoice Report
4. **Update Hours** — `Billing Status = Invoiced`, `Invoice Report` relation
5. **Update Work Done** — `Invoice Report` relation only (visibility/approval unchanged)
6. **Final verification**

Each Hours row is verified before update:

- Not **Superseded**
- Not already linked to another non-void invoice
- Billing Status not **Invoiced** or **Paid** (unless idempotent retry on same invoice)

## Duplicate billing prevention

Save is blocked when any included Hours row has:

| Condition | Message |
|-----------|---------|
| Billing Status = Invoiced | Already invoiced on AFP-YYYY-### |
| Billing Status = Paid | Paid on AFP-YYYY-### |
| Superseded | Superseded historical record |
| Invoice Report → non-void invoice | Conflicting invoice relation |
| Session ID on another non-void invoice | Session ID already appears on … |
| Missing Session ID | Missing Session ID |
| Missing approved Work Done relation | Missing approved Work Done relation |

Rows are never silently excluded without a visible reason in preflight diagnostics.

## Idempotent retry

Re-running save with the same invoice number:

- Detects the existing Invoice Report
- Skips `pages.create`
- Skips Hours/Work Done updates that are already correct
- Returns success or a safe conflict result — no duplicate Invoice Report row

## Partial failure recovery

On failure, the apply path:

- Stops immediately (no blind retries)
- Reports exactly which steps succeeded
- Reports remaining Hours/Work Done updates
- Does **not** delete or roll back automatically
- Provides a safe rerun path that skips already-correct writes

The Report Builder save panel shows partial-failure state and recovery summary.

## Existing invoice immutability

When opening a saved Invoice Report (`/invoices/[id]`):

- Preview loads **only** its Included Hours and Included Work Done
- Saved totals (hours, amount, rate) are shown as an immutable snapshot
- Live source rows are compared; drift warnings appear if recomposed totals differ
- The invoice is never mutated automatically

API: `GET /api/invoices/[id]/preview` — read-only, `writesPerformed=false`.

## Manual unlock (future work)

Voiding an invoice does not automatically restore Hours to billable status. A future explicit unlock flow will:

- Require review and typed confirmation
- Clear or replace Invoice Report relations
- Reset Billing Status through a controlled update path

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `NOTION_INVOICE_SAVE_ENABLED` | `false` | Gate live invoice save + Hours locking |
| `NOTION_SYNC_ENABLED` | `false` | Must remain false; save refuses if true |

## API routes

| Route | Method | Writes |
|-------|--------|--------|
| `/api/invoices/save-preflight` | POST | No |
| `/api/invoices/save` | POST | Yes (gated) |
| `/api/invoices/[id]/preview` | GET | No |

## Key modules

- `src/lib/invoices/invoice-save.ts` — preflight, gating, confirmation phrase
- `src/lib/invoices/invoice-save-apply.ts` — targeted `pages.create` / `pages.update`
- `src/lib/invoices/invoice-locking.ts` — lock plan (pure)
- `src/lib/invoices/invoice-status.ts` — legacy status mapping
- `src/lib/invoices/invoice-saved-view.ts` — immutable saved-invoice preview
- `src/features/reports/components/invoice-save-panel.tsx` — Report Builder UI

## Phase 15 timeline and dashboard hardening

Invoices now have a read-only timeline model covering Created, Saved, Sent, Viewed (future-ready), Paid, and Voided events. The timeline is derived from existing invoice metadata and does not persist lifecycle events or mutate Notion.
