import { NextResponse } from "next/server";
import { testNotionConnection } from "@/lib/notion/test-connection";

/** Read-only: verifies NOTION_API_KEY works without touching any database. */
export async function GET() {
  return NextResponse.json(await testNotionConnection());
}
