import { NextRequest, NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { runFullSync, getSyncStatusSummary } from "@/lib/notion/sync-engine";
import type { SyncLogEntry } from "@/types/domain";

export async function POST(request: NextRequest) {
  initDb();
  const body = await request.json().catch(() => ({}));
  const trigger: SyncLogEntry["trigger"] =
    body?.trigger === "startup" || body?.trigger === "background" || body?.trigger === "on-edit"
      ? body.trigger
      : "manual";

  const result = await runFullSync(trigger);
  return NextResponse.json({ result, status: getSyncStatusSummary() });
}

export async function GET() {
  initDb();
  return NextResponse.json(getSyncStatusSummary());
}
