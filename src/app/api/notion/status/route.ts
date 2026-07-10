import { NextResponse } from "next/server";
import { getAppDataSource } from "@/lib/data/runtime";
import { getNotionConfig } from "@/lib/notion/config";

export const dynamic = "force-dynamic";

export async function GET() {
  if (getAppDataSource() === "notion") {
    const config = getNotionConfig();
    const configuredDatabases = Object.entries(config.databases).filter(([, id]) => Boolean(id)).map(([type]) => type);
    return NextResponse.json({ configured: Boolean(config.apiKey), syncEnabled: false, configuredDatabases, missingDatabases: Object.entries(config.databases).filter(([, id]) => !id).map(([type]) => type), lastSync: null, queueLength: 0, openConflicts: 0, syncIntervalMinutes: config.syncIntervalMinutes });
  }
  const { initDb } = await import("@/lib/db");
  const { getSyncStatusSummary } = await import("@/lib/notion/sync-engine");
  initDb();
  return NextResponse.json(getSyncStatusSummary());
}
