import { describe, expect, it } from "vitest";
import { hoursToNotionProperties } from "./mappers";
import type { HoursEntry } from "@/types/domain";

describe("hoursToNotionProperties", () => {
  it("writes the date as the title and omits null optional relations", () => {
    const entry: HoursEntry = {
      id: "draft",
      workspaceId: "notion-production",
      clientId: "",
      projectId: null,
      date: "2026-07-10",
      startTime: "12:44",
      endTime: "12:45",
      breakMinutes: 0,
      totalHours: 1 / 60,
      hourlyRate: 30,
      billable: false,
      location: "Remote",
      relatedWorkLogId: null,
      notes: "PRODUCTION SMOKE TEST - SAFE TO REMOVE MANUALLY",
      source: "manual",
      notionPageId: null,
      notionDatabaseId: null,
      notionUrl: null,
      syncStatus: "local-only",
      lastSyncedAt: null,
      notionLastEditedTime: null,
      createdAt: "2026-07-10T17:44:00.000Z",
      updatedAt: "2026-07-10T17:44:00.000Z",
    };

    const properties = hoursToNotionProperties(entry);

    expect(properties.Date).toEqual({
      title: [{ type: "text", text: { content: "2026-07-10" } }],
    });
    expect(properties).not.toHaveProperty("Project");
    expect(properties).not.toHaveProperty("Related Work Log");
    expect(Object.values(properties)).not.toContain(null);
  });
});
