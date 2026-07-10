import { describe, expect, it } from "vitest";
import {
  MIGRATION_KEY_PROPERTY_NAME,
  PROJECT_RELATION_PROPERTY_NAME,
  buildClientProperties,
  buildHoursProperties,
  buildProjectProperties,
  buildWorkLogProperties,
  buildWorkLogSummaryText,
  hasMigrationKeyProperty,
  hasProjectRelationProperty,
  migrationKeyPropertyPatch,
  projectRelationPropertyPatch,
} from "@/lib/notion/migration/write-schema";
import type {
  ProposedClientRecord,
  ProposedHoursRecord,
  ProposedProjectRecord,
  ProposedWorkLogRecord,
} from "@/lib/notion/migration/types";

describe("hasMigrationKeyProperty / hasProjectRelationProperty", () => {
  it("detects a present rich_text Migration Key property", () => {
    expect(hasMigrationKeyProperty({ "Migration Key": { type: "rich_text" } })).toBe(true);
  });

  it("returns false when Migration Key is missing", () => {
    expect(hasMigrationKeyProperty({ Name: { type: "title" } })).toBe(false);
    expect(hasMigrationKeyProperty(null)).toBe(false);
    expect(hasMigrationKeyProperty(undefined)).toBe(false);
  });

  it("returns false when a property of that name exists but has the wrong type", () => {
    expect(hasMigrationKeyProperty({ "Migration Key": { type: "select" } })).toBe(false);
  });

  it("detects a present relation Project property", () => {
    expect(hasProjectRelationProperty({ Project: { type: "relation" } })).toBe(true);
  });

  it("returns false when Project relation is missing or wrong-typed", () => {
    expect(hasProjectRelationProperty({ Project: { type: "select" } })).toBe(false);
    expect(hasProjectRelationProperty({})).toBe(false);
  });
});

describe("schema patches are additive-only shapes", () => {
  it("migrationKeyPropertyPatch adds exactly one rich_text property", () => {
    const patch = migrationKeyPropertyPatch();
    expect(Object.keys(patch)).toEqual([MIGRATION_KEY_PROPERTY_NAME]);
    expect(patch[MIGRATION_KEY_PROPERTY_NAME]).toEqual({ type: "rich_text", rich_text: {} });
  });

  it("projectRelationPropertyPatch adds exactly one relation property pointed at the given data source", () => {
    const patch = projectRelationPropertyPatch("ds-projects-123");
    expect(Object.keys(patch)).toEqual([PROJECT_RELATION_PROPERTY_NAME]);
    expect(patch[PROJECT_RELATION_PROPERTY_NAME]).toMatchObject({
      type: "relation",
      relation: { data_source_id: "ds-projects-123" },
    });
  });
});

function clientRecord(overrides: Partial<ProposedClientRecord> = {}): ProposedClientRecord {
  return {
    name: "Anytime Fuel Pros",
    status: "active",
    defaultHourlyRate: 30,
    timezone: "America/Chicago",
    notes: "note",
    ...overrides,
  };
}

function projectRecord(overrides: Partial<ProposedProjectRecord> = {}): ProposedProjectRecord {
  return {
    key: "bolReviewV2",
    name: "BOL Review Process V2",
    status: "active",
    priority: "medium",
    description: "desc",
    tags: ["a"],
    ...overrides,
  };
}

function hoursRecord(overrides: Partial<ProposedHoursRecord> = {}): ProposedHoursRecord {
  return {
    date: "2026-07-08",
    startTime: "11:00",
    endTime: "13:00",
    breakMinutes: 0,
    totalHours: 2,
    hourlyRate: 30,
    billable: true,
    location: "Office / onsite",
    notes: "notes",
    clientName: "Anytime Fuel Pros",
    projectKey: "bolReviewV2",
    expectedAmount: 60,
    referenceAppRoundedHours: 2,
    referenceAppRoundedAmount: 60,
    workstream: "AFP work",
    status: "Confirmed",
    ...overrides,
  };
}

function workLogRecord(overrides: Partial<ProposedWorkLogRecord> = {}): ProposedWorkLogRecord {
  return {
    title: "July 9, 2026",
    date: "2026-07-09",
    status: "done",
    priority: "medium",
    summary: "Summary text.",
    detailedSourceReference: "https://example.com",
    invoiceDescription: "Invoice text.",
    clientName: "Anytime Fuel Pros",
    projectKey: "bolReviewV2",
    relatedProjectKeys: ["commandCenter", "powerAutomateDocs"],
    relatedProjectsNote: "Primary project: BOL Review Process V2. Also touched others.",
    relatedHoursSyntheticIds: ["hrs-1"],
    ...overrides,
  };
}

describe("buildClientProperties / buildProjectProperties", () => {
  it("embeds the migration key as a rich_text property", () => {
    const props = buildClientProperties(clientRecord(), "afp-client-v1");
    expect(props[MIGRATION_KEY_PROPERTY_NAME]).toEqual({
      rich_text: [{ type: "text", text: { content: "afp-client-v1" } }],
    });
  });

  it("writes the client name as the title", () => {
    const props = buildClientProperties(clientRecord({ name: "Anytime Fuel Pros" }), "k");
    expect(props.Name).toEqual({ title: [{ type: "text", text: { content: "Anytime Fuel Pros" } }] });
  });

  it("embeds the migration key on projects too", () => {
    const props = buildProjectProperties(projectRecord(), "afp-project-bol-review-process-v2-v1");
    expect(props[MIGRATION_KEY_PROPERTY_NAME]).toBeDefined();
  });
});

describe("buildHoursProperties - relation resolution", () => {
  it("includes a Project relation when a project page id is provided", () => {
    const props = buildHoursProperties(hoursRecord(), "k", "page-project-123");
    expect(props[PROJECT_RELATION_PROPERTY_NAME]).toEqual({ relation: [{ id: "page-project-123" }] });
  });

  it("omits the Project relation entirely when no project page id is provided", () => {
    const props = buildHoursProperties(hoursRecord({ projectKey: null }), "k", null);
    expect(props[PROJECT_RELATION_PROPERTY_NAME]).toBeUndefined();
  });

  it("writes exact hours and amount as-is (no re-rounding)", () => {
    const props = buildHoursProperties(hoursRecord({ totalHours: 2.9166666667, expectedAmount: 87.5 }), "k", null);
    expect(props["Total Hours"]).toEqual({ number: 2.9166666667 });
    expect(props["Hourly Rate"]).toEqual({ number: 30 });
  });
});

describe("buildWorkLogProperties / buildWorkLogSummaryText", () => {
  it("appends relatedProjectsNote to the Notion Summary property when present", () => {
    const record = workLogRecord();
    const text = buildWorkLogSummaryText(record);
    expect(text).toContain(record.summary);
    expect(text).toContain(record.relatedProjectsNote);
  });

  it("leaves the summary untouched when there is no related-projects note", () => {
    const record = workLogRecord({ relatedProjectsNote: "" });
    expect(buildWorkLogSummaryText(record)).toBe(record.summary);
  });

  it("includes the Project relation for the primary project when a page id is given", () => {
    const props = buildWorkLogProperties(workLogRecord(), "k", "page-project-456");
    expect(props[PROJECT_RELATION_PROPERTY_NAME]).toEqual({ relation: [{ id: "page-project-456" }] });
  });

  it("writes the invoice description verbatim (not the appended summary)", () => {
    const record = workLogRecord({ invoiceDescription: "Client-facing text." });
    const props = buildWorkLogProperties(record, "k", null);
    expect(props["Invoice Description"]).toEqual({
      rich_text: [{ type: "text", text: { content: "Client-facing text." } }],
    });
  });
});
