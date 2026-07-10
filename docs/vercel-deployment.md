# Vercel Deployment

## Required configuration

Add these server-side environment variables to Preview and Production:

```text
APP_DATA_SOURCE=notion
NOTION_API_KEY
NOTION_DATABASE_CLIENTS
NOTION_DATABASE_PROJECTS
NOTION_DATABASE_HOURS
NOTION_DATABASE_WORKLOGS
NOTION_DATABASE_KNOWLEDGE
NOTION_DATABASE_INVOICES
NOTION_SYNC_ENABLED=false
```

Do not prefix any Notion value with `NEXT_PUBLIC_`. Optional `REPORT_*` variables are listed in `.env.example` and supply immutable deployment report identity because production report settings do not use SQLite.

## Access protection

Choose one before production:

1. Enable Vercel Deployment Protection for the project/environment, then set `VERCEL_DEPLOYMENT_PROTECTION=true` as a configuration attestation.
2. Set a strong `APP_ACCESS_PASSWORD` and optional `APP_ACCESS_USERNAME` (default `austin`) to enable the app's server-side Basic Auth proxy.

The attestation variable does not enable the Vercel product by itself; verify the dashboard setting. Basic Auth is a shared single-user gate with no session revocation, role model, or audit identity. It is suitable only for this private app over HTTPS. `/api/health` is intentionally excluded so deployment health can be checked; it returns no secrets or database ids.

Vercel production build validation rejects mock mode, missing Notion variables, enabled general sync, or missing declared access protection. Preview uses the same Notion configuration so read-only behavior can be tested before promotion.

## Deploy and verify a preview

```bash
npm run lint
npm run typecheck
npm test
npm run build
npx vercel
```

With the protected preview open:

1. Check `/api/health`: Notion configured, SQLite false, sync false.
2. Load Dashboard, Hours, Work Done, Projects, Knowledge, Invoice Reports, and Report Builder.
3. Confirm real Notion rows or correct empty states and no mock seed rows.
4. Use Settings database verification; it is read-only.
5. Create a timer/work-log draft but do not submit it.
6. Check browser/server logs for Notion, filesystem, and hydration errors.
7. Confirm unauthenticated access is challenged or blocked by Vercel protection.

Do not click Save to Notion during read-only preview verification. Do not call the historical import or general sync endpoints.

After approval, promote the exact verified deployment through Vercel rather than rebuilding a different revision.

## Runtime and persistence

All production routes use the Node.js runtime where specified. The Notion SDK and server-only provider run in Vercel functions. Production imports no SQLite provider and expects no writable filesystem, durable local cache, or cross-request process state.

## Rollback

1. Promote the previous known-good Vercel deployment or use Vercel's rollback control.
2. Leave Notion schemas and source rows unchanged; deployment rollback does not require a data migration.
3. Keep `NOTION_SYNC_ENABLED=false`.
4. If credentials may be involved, revoke/rotate the Notion integration token and Basic Auth password, then update Vercel secrets.
5. Verify the rollback health endpoint and protected read-only pages.

Because the app never deletes/archives and schema application is outside this phase, rollback is an application deployment change. Any explicitly saved targeted rows remain ordinary Notion records and should be handled manually rather than automatically reversed.
