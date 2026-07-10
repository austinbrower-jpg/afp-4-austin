import { NextResponse } from "next/server";
import { getNotionClient } from "@/lib/notion/client";
import { getNotionConfig, databaseIdFor } from "@/lib/notion/config";
import { verifyNotionDatabases } from "@/lib/notion/verify-databases";
import { runPreflight, toNotionWriteClient } from "@/lib/notion/migration/one-time-import";

/**
 * Read-only: re-derives everything the Phase 6 import would need to check
 * before writing, without writing anything. Safe to call repeatedly. See
 * src/lib/notion/migration/one-time-import.ts's runPreflight().
 */
export async function GET() {
  try {
    const config = getNotionConfig();
    const notion = toNotionWriteClient(getNotionClient());
    const mapping = await verifyNotionDatabases();

    const report = await runPreflight({
      notion,
      syncEnabled: config.syncEnabled,
      mapping: { ready: mapping.ready },
      databaseIds: {
        client: databaseIdFor("client", config),
        project: databaseIdFor("project", config),
        hours: databaseIdFor("hours", config),
        worklog: databaseIdFor("worklog", config),
      },
    });

    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error running import preflight";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
