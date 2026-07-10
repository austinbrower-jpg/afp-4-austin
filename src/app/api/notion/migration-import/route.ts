import { NextRequest, NextResponse } from "next/server";
import { getNotionClient } from "@/lib/notion/client";
import { getNotionConfig, databaseIdFor } from "@/lib/notion/config";
import { verifyNotionDatabases } from "@/lib/notion/verify-databases";
import { runImport, toNotionWriteClient } from "@/lib/notion/migration/one-time-import";

/**
 * POST-only, narrowly scoped one-time write endpoint for the Phase 6
 * historical import. Requires the exact confirmation phrase in the request
 * body; re-runs the full preflight suite live (never trusts a client-side
 * "I already checked" claim) before writing anything. Never depends on
 * NOTION_SYNC_ENABLED - see one-time-import.ts's "sync-disabled" preflight
 * check, which actively refuses to run while it's true. Creates only the
 * approved historical client/projects/hours/work-log records; no
 * update/delete/archive call exists anywhere in the code path this route
 * calls into.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const confirmationPhrase = typeof body?.confirmationPhrase === "string" ? body.confirmationPhrase : null;

    const config = getNotionConfig();
    const notion = toNotionWriteClient(getNotionClient());
    const mapping = await verifyNotionDatabases();

    const result = await runImport({
      notion,
      confirmationPhrase,
      syncEnabled: config.syncEnabled,
      mapping: { ready: mapping.ready },
      databaseIds: {
        client: databaseIdFor("client", config),
        project: databaseIdFor("project", config),
        hours: databaseIdFor("hours", config),
        worklog: databaseIdFor("worklog", config),
      },
    });

    // Always 200: the response body's confirmationAccepted/ok fields carry
    // the actual outcome (rejected confirmation, failed preflight, partial
    // failure, or success) as structured data for the UI to render - a
    // rejected/invalid confirmation is an expected, well-formed result of
    // calling this endpoint, not a malformed-request error.
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error running the historical import";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
