import { NextResponse } from "next/server";
import { verifyNotionDatabases } from "@/lib/notion/verify-databases";

/**
 * Read-only: retrieves each configured database's schema (databases.retrieve
 * + dataSources.retrieve) and checks it against what the app expects. Never
 * queries row data and never writes anything.
 */
export async function GET() {
  return NextResponse.json(await verifyNotionDatabases());
}
