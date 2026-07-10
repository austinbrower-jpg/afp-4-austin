import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { getSyncStatusSummary } from "@/lib/notion/sync-engine";

export async function GET() {
  initDb();
  return NextResponse.json(getSyncStatusSummary());
}
