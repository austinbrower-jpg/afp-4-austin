import { describe, expect, it } from "vitest";
import {
  inspectRelationalSchema,
  missingRelationalPatches,
  propertyPatch,
  allRelationalPropertiesReady,
  selectOptionsValid,
} from "./relational-schema-setup";

const dataSourceIds = {
  client: "ds-client",
  project: "ds-project",
  hours: "ds-hours",
  worklog: "ds-worklog",
  invoice: "ds-invoice",
};

describe("relational schema setup", () => {
  it("builds additive property patches only for missing fields", () => {
    const propertiesByDatabase = {
      Clients: {},
      Projects: {},
      "Hours Worked": { "Session ID": { type: "rich_text" } },
      "Work Done": {},
      "Invoice Reports": { Status: { type: "select", select: { options: [{ name: "draft" }] } } },
    } as Record<string, Record<string, unknown>>;

    const inspection = inspectRelationalSchema(propertiesByDatabase, dataSourceIds);
    expect(inspection.properties.find((p) => p.database === "Hours Worked" && p.name === "Session ID")?.present).toBe(true);
    expect(inspection.properties.find((p) => p.database === "Invoice Reports" && p.name === "Status")?.skipReason).toContain("not modified");

    const patches = missingRelationalPatches(inspection);
    expect(patches.some((p) => p.property === "Session ID")).toBe(false);
    expect(patches.some((p) => p.property === "Status")).toBe(false);
    expect(patches.some((p) => p.property === "Billing Status")).toBe(true);
  });

  it("creates dual_property relations with reciprocal names", () => {
    const patch = propertyPatch(
      {
        name: "Related Work Done",
        type: "relation",
        target: "Work Done",
        reciprocal: "Related Hours",
      },
      dataSourceIds,
    );
    expect(patch).toEqual({
      "Related Work Done": {
        type: "relation",
        relation: {
          data_source_id: "ds-worklog",
          type: "dual_property",
          dual_property: { synced_property_name: "Related Hours" },
        },
      },
    });
  });

  it("validates select options when all are present", () => {
    const propertiesByDatabase = {
      Clients: {},
      Projects: {},
      "Hours Worked": {
        "Billing Status": {
          type: "select",
          select: {
            options: [
              { name: "Draft" },
              { name: "Reviewed" },
              { name: "Ready to Invoice" },
              { name: "Invoiced" },
              { name: "Paid" },
              { name: "Superseded" },
            ],
          },
        },
      },
      "Work Done": {},
      "Invoice Reports": {},
    } as Record<string, Record<string, unknown>>;

    const inspection = inspectRelationalSchema(propertiesByDatabase, dataSourceIds);
    expect(selectOptionsValid(inspection)).toBe(true);
    expect(allRelationalPropertiesReady(inspection)).toBe(false);
  });
});
