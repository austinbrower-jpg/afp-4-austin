import { NextResponse } from "next/server";
import {
  PHASE11_RELATIONAL_SCHEMA_PROPOSAL,
  PROPOSED_NOTION_SCHEMA_CHANGES,
  relationalSchemaChecks,
} from "@/lib/notion/schema-requirements";
import { validateSchemaProposal } from "@/lib/notion/relational-schema-proposal";
import { verifyNotionDatabases } from "@/lib/notion/verify-databases";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Read-only Phase 8/11 schema preview. This route has no mutation method. */
export async function GET() {
  const verification = await verifyNotionDatabases();
  const actualByDatabase: Record<string, Record<string, { type: string }>> = {};
  for (const db of verification.databases) {
    const label = db.label;
    if (!label) continue;
    const props: Record<string, { type: string }> = {};
    for (const check of db.properties) {
      if (check.actualType) props[check.notionName] = { type: check.actualType };
      else if (check.status === "ok") props[check.notionName] = { type: check.expectedType };
    }
    actualByDatabase[label] = props;
  }
  const relationalChecks = relationalSchemaChecks(actualByDatabase);
  const proposalValidation = validateSchemaProposal();
  return NextResponse.json(
    {
      applySupported: false,
      changes: PROPOSED_NOTION_SCHEMA_CHANGES,
      relationalProposal: PHASE11_RELATIONAL_SCHEMA_PROPOSAL,
      relationalChecks,
      proposalValidation,
      hoursDuplicateProtection: "Existing Migration Key is preserved; new saves use an exact date/start/end/project duplicate check, so no new Hours property is proposed.",
      verification,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
