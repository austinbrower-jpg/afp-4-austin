import { NextResponse } from "next/server";
import { buildMigrationDryRun } from "@/lib/notion/migration/dry-run";
import { getAppDataSource } from "@/lib/data/runtime";
import { EMPTY_SNAPSHOT } from "@/lib/notion/migration/types";

/**
 * Phase 5 historical-migration dry run: read-only preview of what a real
 * migration would create from the AFP-Work Notion source pages. Makes no
 * Notion API call at all (the source content is a transcribed, versioned
 * fixture - see src/lib/notion/migration/source-data.ts) and no SQLite
 * write - loadExistingRecordsSnapshot() only reads, for duplicate
 * detection. Safe to call repeatedly regardless of NOTION_SYNC_ENABLED.
 */
export async function GET() {
  try {
    const snapshot = getAppDataSource() === "notion"
      ? EMPTY_SNAPSHOT
      : (await import("@/lib/notion/migration/read-existing")).loadExistingRecordsSnapshot();
    const result = buildMigrationDryRun(snapshot);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error building migration preview";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
