import { describe, expect, it } from "vitest";
import { PHASE11_RELATIONAL_SCHEMA_PROPOSAL, validateSchemaProposal } from "./relational-schema-proposal";

describe("relational schema proposal validation", () => {
  it("is additive only with no duplicate property names per database", () => {
    expect(validateSchemaProposal().valid).toBe(true);
    for (const db of PHASE11_RELATIONAL_SCHEMA_PROPOSAL) {
      expect(db.additiveOnly).toBe(true);
    }
  });

  it("documents relation targets and reciprocal behavior", () => {
    const hours = PHASE11_RELATIONAL_SCHEMA_PROPOSAL.find((d: { database: string }) => d.database === "Hours Worked")!;
    const clientRel = hours.properties.find((p: { type: string; name: string }) => p.type === "relation" && p.name === "Client");
    expect(clientRel?.type).toBe("relation");
    if (clientRel?.type === "relation") {
      expect(clientRel.target).toBe("Clients");
      expect(clientRel.reciprocal).toBeTruthy();
    }
  });
});
