# Invoice Dashboard

Phase 15 adds a read-only invoice dashboard model and `/invoices/dashboard` page. The dashboard summarizes draft, sent, paid, and void invoices; revenue this month; revenue YTD; outstanding invoice count and balance; future-ready average payment time; and total billable hours.

Client billing history is derived from the selected data provider without saving anything. Each client summary includes invoices, hours billed, work logs, total paid revenue, average hourly rate, outstanding balance, and last invoice date.

The supporting API is `GET /api/invoices/dashboard`. It performs provider reads only and uses no Notion write clients.

## Home dashboard billing cards (Phase 16)

`GET /api/dashboard` (the `/` Home Dashboard) reuses the same billing-status vocabulary as `buildClientBillingHistory` to show three additional stat cards, scoped to the primary workspace client: **Ready to Invoice** (unbilled billable hours since the last invoice period), **Already Invoiced** (count and total of `sent`/`paid` invoices), and **Outstanding** (count and total of `sent`/`draft` invoices not yet paid). The Home Dashboard also lists Recent Invoices and Recent Projects and exposes Quick Actions to Generate Invoice, Generate Work Report, View Invoice Dashboard, and View Time History. All of this remains read-only against the selected data provider.

## Clients pages (Phase 16)

`/clients` and `/clients/[id]` are new read-only server-rendered pages built on `buildClientBillingHistory`. They show, per client: projects, hours, invoices, work history, revenue (paid invoice total), outstanding balance, and last invoice date. Neither page performs any writes.
