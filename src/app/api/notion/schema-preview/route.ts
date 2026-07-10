import { NextResponse } from "next/server";
import { PROPOSED_NOTION_SCHEMA_CHANGES } from "@/lib/notion/schema-requirements";
import { verifyNotionDatabases } from "@/lib/notion/verify-databases";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Read-only Phase 8 schema preview. This route has no mutation method. */
export async function GET() {
  const verification = await verifyNotionDatabases();
  return NextResponse.json(
    {
      applySupported: false,
      changes: PROPOSED_NOTION_SCHEMA_CHANGES,
      hoursDuplicateProtection: "Existing Migration Key is preserved; new saves use an exact date/start/end/project duplicate check, so no new Hours property is proposed.",
      verification,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
