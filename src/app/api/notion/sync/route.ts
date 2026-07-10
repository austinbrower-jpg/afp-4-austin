import { NextRequest, NextResponse } from "next/server";
import { getAppDataSource } from "@/lib/data/runtime";

export async function POST(request: NextRequest) {
  if (getAppDataSource() === "notion") return NextResponse.json({ error: "General sync is disabled in Notion-native mode." }, { status: 405 });
  const { initDb } = await import("@/lib/db");
  const { runFullSync, getSyncStatusSummary } = await import("@/lib/notion/sync-engine");
  const body = await request.json().catch(() => ({}));
  initDb();
  const result = await runFullSync(body?.trigger === "background" ? "background" : body?.trigger === "startup" ? "startup" : "manual");
  return NextResponse.json({ result, status: getSyncStatusSummary() });
}
export async function GET() {
  if (getAppDataSource() === "notion") return NextResponse.json({ configured: true, syncEnabled: false, configuredDatabases: [], missingDatabases: [], lastSync: null, queueLength: 0, openConflicts: 0, syncIntervalMinutes: 0 });
  const { initDb } = await import("@/lib/db");
  const { getSyncStatusSummary } = await import("@/lib/notion/sync-engine");
  initDb();
  return NextResponse.json(getSyncStatusSummary());
}
