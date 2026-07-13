# Notion-Native Production Mode

## Source-of-truth boundary

Set `APP_DATA_SOURCE=notion` to make Notion the only application datastore. The runtime provider supplies Clients, Projects, Hours Worked, Work Done, Knowledge, and Invoice Reports. Dashboard, lists, details, search, and Report Builder all use that provider.

Notion mode does not initialize, read, or write SQLite. The SQLite module is loaded only by the mock provider after `APP_DATA_SOURCE=mock` is selected. Automated boundary tests enforce this import separation.

All live reads are dynamic/no-store. The global refresh button invalidates client queries, and window focus triggers another fetch. Mapping failures produce safe API errors; malformed rows are returned with validation warnings where possible.

## Controlled writes

The legacy sync engine is disabled and is not a dependency of Notion-native writes. Keep `NOTION_SYNC_ENABLED=false`.

| Entity | Read | Create | Update | Delete/archive |
|---|---:|---:|---:|---:|
| Clients | yes | no | no | no |
| Projects | yes | explicit | explicit | no |
| Hours Worked | yes | explicit | explicit | no |
| Work Done | yes | explicit | explicit | no |
| Knowledge | yes, including page blocks | no | no | no |
| Invoice Reports | yes | explicit save (gated) | metadata update | no |

POST/PATCH handlers validate request bodies, verify the configured target database schema, update only one target page, and return the page id and URL. Hours creation checks an exact date/start/end/project identity before creating a page. Invoice number duplicates are rejected. Notion errors are converted to useful 4xx/5xx responses without exposing the API key.

The app contains no Notion schema-write action. `GET /api/notion/schema-preview` returns the exact additive proposal plus a read-only current-schema verification. `GET /api/notion/verify-databases` also retrieves schemas only.

## Draft behavior

- A running timer and its stopped draft are stored in the browser.
- Stopping preserves exact ISO timestamps and creates no Notion page.
- Closing the stopped-timer dialog retains the draft; discard is explicit.
- A successful save clears the draft and returns the Notion link.
- Work Done form state stays in the browser until submit.
- Report draft descriptions operate on copied builder input and never patch Hours, Work Done, Knowledge, or Project pages.

Client-facing report inclusion is deny-by-default: `Client Visible` and the matching include flag must be true. Clearing Client Visible also clears both include toggles. Internal Notes are absent from the client report model and serializers.

## Required and proposed schema

Exact existing requirements are defined in `src/lib/notion/schema-requirements.ts` and shown by Settings verification. Phase 8 proposes these additive fields but does not apply them:

- Work Done: Client Visible (checkbox), Include in Invoice (checkbox), Include in Work Report (checkbox), Detailed Work Description (rich text), Internal Notes (rich text), Evidence Links (rich text).
- Knowledge: Client Visible (checkbox), Include in Work Report (checkbox), Report Summary (rich text), Project (Projects relation), Source Page (URL).
- Related Hours is previewed as deferred until its relation target can be confirmed safely.
- No new Hours field is required. Existing Migration Key data is untouched; duplicate prevention uses the saved row identity. The existing Project relation remains required.

Until required write fields are present with the expected types, targeted writes fail before calling Notion page create/update. Reads remain tolerant and surface missing-property warnings.

## Phase 11 relational model (proposal only)

Phase 11 designs explicit Notion relations for Hours Worked, Work Done, Invoice Reports, and Projects. The additive proposal lives in `src/lib/notion/relational-schema-proposal.ts` and is verified read-only by `GET /api/notion/schema-preview` and Settings.

- **Session ID** (`AFP-YYYY-MM-DD-###`) and **Work Log ID** (`AFP-WORK-YYYY-MM-DD-###`) helpers assign stable identities without altering Migration Key values.
- **Superseded** rows (`afp-history-v2-superseded-*` migration keys or Billing Status = Superseded) remain visible in Hours but are excluded from dashboard, invoice, and report totals.
- **Report Builder** matches Hours to Work Done in order: explicit relation → reciprocal relation → legacy date+project fallback; ambiguous and date-only multi-candidate matches are rejected.
- **Invoice locking** (Phase 13): explicit save sets Billing Status = Invoiced and links invoice relations; duplicate billing is blocked at preflight. Live save is gated by `NOTION_INVOICE_SAVE_ENABLED=false` (default). See [invoice-locking.md](./invoice-locking.md).
- **`GET /api/notion/relation-backfill-preview`** returns a read-only July 8–10 backfill preview. No Notion writes occur.

See [notion-relational-model.md](./notion-relational-model.md).

## Local use on both Macs

On the MacBook Air and Mac mini:

1. Check out the same application revision.
2. Install dependencies with `npm install`.
3. Create a separate ignored `.env.local` containing `APP_DATA_SOURCE=notion`, the same Notion integration/database values, and `NOTION_SYNC_ENABLED=false`.
4. Optionally configure the same Basic Auth username/password.
5. Run `npm run dev` and confirm `/api/health` reports `dataSource: notion` and `sqliteAllowed: false`.

Do not copy the SQLite database between machines. Both instances see consistent data because every saved production record goes through Notion. `.env.local` must never be committed or shared through source control.

For mock-only development, set `APP_DATA_SOURCE=mock`; Notion credentials are not required and no Notion calls occur.

## Historical import compatibility

The one-time import tooling remains build/test compatible, but normal notion mode never invokes it. Migration Key and Notion page ids continue to map into the shared domain. A future import requires its own approval and procedure; do not enable the general sync engine to run it.
