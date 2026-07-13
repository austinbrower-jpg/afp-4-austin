# Invoice Dashboard

Phase 15 adds a read-only invoice dashboard model and `/invoices/dashboard` page. The dashboard summarizes draft, sent, paid, and void invoices; revenue this month; revenue YTD; outstanding invoice count and balance; future-ready average payment time; and total billable hours.

Client billing history is derived from the selected data provider without saving anything. Each client summary includes invoices, hours billed, work logs, total paid revenue, average hourly rate, outstanding balance, and last invoice date.

The supporting API is `GET /api/invoices/dashboard`. It performs provider reads only and uses no Notion write clients.
