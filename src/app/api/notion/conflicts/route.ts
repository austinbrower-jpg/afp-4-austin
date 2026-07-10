import { NextRequest, NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { listOpenConflicts, resolveConflict } from "@/lib/db/repositories/sync";

export async function GET() {
  initDb();
  return NextResponse.json(listOpenConflicts());
}

export async function POST(request: NextRequest) {
  initDb();
  const body = await request.json();
  const { id, resolution } = body as {
    id: string;
    resolution: "kept-local" | "kept-notion" | "merged";
  };
  resolveConflict(id, resolution);
  return NextResponse.json({ ok: true });
}
