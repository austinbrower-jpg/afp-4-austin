# Reporting

Phase 15 introduces read-only reporting helpers and `GET /api/reports/financial`.

Reports currently modeled:

- Monthly revenue report from paid invoices.
- Client revenue report with paid revenue and outstanding balance.
- Project profitability report from billable project hours and rates.
- Hours by project split into billable and non-billable hours.
- Invoice aging report for draft and sent invoices.

These reports are deterministic projections over existing provider data. They do not upload PDFs, mutate Notion, save invoice metadata, or call production write APIs.
