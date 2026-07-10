import { describe, expect, it } from "vitest";
import {
  NOTION_PROPERTY_REQUIREMENTS,
  NOTION_DATABASE_ENV_VARS,
  validateProperties,
  isSchemaValid,
  invalidProperties,
  detectDatabaseConfiguration,
  isDatabaseReady,
  isMappingReady,
  type PropertyRequirement,
} from "@/lib/notion/schema-requirements";
import type { SyncEntityType } from "@/types/domain";

const HOURS_REQUIREMENTS: PropertyRequirement[] = [
  { field: "title", notionName: "Date", expectedType: "title" },
  { field: "billable", notionName: "Billable", expectedType: "checkbox" },
];

describe("NOTION_PROPERTY_REQUIREMENTS", () => {
  it("defines requirements for exactly the six entity types the sync engine knows about", () => {
    const types: SyncEntityType[] = [
      "client",
      "project",
      "hours",
      "worklog",
      "knowledge",
      "invoice",
    ];
    expect(Object.keys(NOTION_PROPERTY_REQUIREMENTS).sort()).toEqual([...types].sort());
  });

  it("gives every entity at least one title-type requirement (Notion requires exactly one title column)", () => {
    for (const type of Object.keys(NOTION_PROPERTY_REQUIREMENTS) as SyncEntityType[]) {
      const titleReqs = NOTION_PROPERTY_REQUIREMENTS[type].filter((r) => r.expectedType === "title");
      expect(titleReqs.length).toBe(1);
    }
  });

  it("has a matching env var entry for every entity type", () => {
    for (const type of Object.keys(NOTION_PROPERTY_REQUIREMENTS) as SyncEntityType[]) {
      expect(NOTION_DATABASE_ENV_VARS[type]).toBeDefined();
      expect(NOTION_DATABASE_ENV_VARS[type].envVar).toMatch(/^NOTION_DATABASE_/);
    }
  });
});

describe("validateProperties", () => {
  it("marks every property ok when actual properties match name and type", () => {
    const actual = {
      Date: { type: "title" },
      Billable: { type: "checkbox" },
    };
    const results = validateProperties(actual, HOURS_REQUIREMENTS);
    expect(results.every((r) => r.status === "ok")).toBe(true);
  });

  it("marks a property missing when the Notion column doesn't exist", () => {
    const actual = { Date: { type: "title" } };
    const results = validateProperties(actual, HOURS_REQUIREMENTS);
    const billable = results.find((r) => r.field === "billable");
    expect(billable?.status).toBe("missing");
    expect(billable?.actualType).toBeUndefined();
  });

  it("marks a property wrong-type when the column exists with a different type", () => {
    const actual = {
      Date: { type: "title" },
      Billable: { type: "number" },
    };
    const results = validateProperties(actual, HOURS_REQUIREMENTS);
    const billable = results.find((r) => r.field === "billable");
    expect(billable?.status).toBe("wrong-type");
    expect(billable?.actualType).toBe("number");
  });

  it("treats a malformed/absent properties object as every property missing", () => {
    expect(validateProperties(null, HOURS_REQUIREMENTS).every((r) => r.status === "missing")).toBe(true);
    expect(validateProperties(undefined, HOURS_REQUIREMENTS).every((r) => r.status === "missing")).toBe(true);
    expect(validateProperties({}, HOURS_REQUIREMENTS).every((r) => r.status === "missing")).toBe(true);
  });

  it("ignores extra Notion columns not in the requirements list", () => {
    const actual = {
      Date: { type: "title" },
      Billable: { type: "checkbox" },
      "Some Other Column": { type: "rich_text" },
    };
    const results = validateProperties(actual, HOURS_REQUIREMENTS);
    expect(results).toHaveLength(HOURS_REQUIREMENTS.length);
  });
});

describe("isSchemaValid", () => {
  it("is true only when every property is ok", () => {
    expect(isSchemaValid([{ field: "a", notionName: "A", expectedType: "title", status: "ok" }])).toBe(true);
  });

  it("is false when any property is missing or wrong-type", () => {
    expect(
      isSchemaValid([
        { field: "a", notionName: "A", expectedType: "title", status: "ok" },
        { field: "b", notionName: "B", expectedType: "number", status: "missing" },
      ]),
    ).toBe(false);
  });

  it("is false for an empty result set (nothing was actually checked)", () => {
    expect(isSchemaValid([])).toBe(false);
  });
});

describe("invalidProperties", () => {
  it("returns only the properties that are missing or the wrong type", () => {
    const results = validateProperties(
      { Date: { type: "title" }, Billable: { type: "number" } },
      HOURS_REQUIREMENTS,
    );
    const invalid = invalidProperties(results);
    expect(invalid).toHaveLength(1);
    expect(invalid[0].field).toBe("billable");
  });
});

describe("detectDatabaseConfiguration", () => {
  it("reports both configured when api key and database id are present", () => {
    expect(detectDatabaseConfiguration({ apiKey: "ntn_x", databaseId: "db_1" })).toEqual({
      apiKeyConfigured: true,
      databaseConfigured: true,
    });
  });

  it("reports database not configured when the id is missing", () => {
    expect(detectDatabaseConfiguration({ apiKey: "ntn_x", databaseId: null })).toEqual({
      apiKeyConfigured: true,
      databaseConfigured: false,
    });
  });

  it("reports neither configured when both are absent (mock mode)", () => {
    expect(detectDatabaseConfiguration({ apiKey: null, databaseId: null })).toEqual({
      apiKeyConfigured: false,
      databaseConfigured: false,
    });
  });
});

describe("isDatabaseReady", () => {
  it("is true only when configured, accessible, and schema-valid", () => {
    expect(isDatabaseReady({ configured: true, accessible: true, schemaValid: true })).toBe(true);
  });

  it("is false when not configured, even if other fields look fine", () => {
    expect(isDatabaseReady({ configured: false, accessible: true, schemaValid: true })).toBe(false);
  });

  it("is false when accessible or schemaValid is null (not yet checked)", () => {
    expect(isDatabaseReady({ configured: true, accessible: null, schemaValid: true })).toBe(false);
    expect(isDatabaseReady({ configured: true, accessible: true, schemaValid: null })).toBe(false);
  });

  it("is false when accessible is false (inaccessible database)", () => {
    expect(isDatabaseReady({ configured: true, accessible: false, schemaValid: null })).toBe(false);
  });
});

describe("isMappingReady", () => {
  const ready = { configured: true, accessible: true as const, schemaValid: true as const };
  const notReady = { configured: false, accessible: null, schemaValid: null };

  it("is true only when the api key is configured and every database is ready", () => {
    expect(isMappingReady(true, [ready, ready])).toBe(true);
  });

  it("is false when the api key itself is missing, even if databases look ready", () => {
    expect(isMappingReady(false, [ready, ready])).toBe(false);
  });

  it("is false when any single database isn't ready", () => {
    expect(isMappingReady(true, [ready, notReady])).toBe(false);
  });

  it("is false for an empty database list (nothing configured yet - mock mode)", () => {
    expect(isMappingReady(true, [])).toBe(false);
  });
});
