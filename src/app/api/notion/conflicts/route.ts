import { NextRequest, NextResponse } from "next/server";
import { getAppDataSource } from "@/lib/data/runtime";

export async function GET() {
  if (getAppDataSource() === "notion") return NextResponse.json([]);
  const { initDb, listOpenConflicts } = await import("@/lib/db");
  initDb();
  return NextResponse.json(listOpenConflicts());
}
export async function POST(request: NextRequest) {
  if (getAppDataSource() === "notion") return NextResponse.json({ error: "Sync conflicts do not apply in Notion-native mode." }, { status: 405 });
  const { initDb, resolveConflict } = await import("@/lib/db");
  initDb();
  const body = await request.json();
  resolveConflict(body.id, body.resolution);
  return NextResponse.json({ ok: true });
}
