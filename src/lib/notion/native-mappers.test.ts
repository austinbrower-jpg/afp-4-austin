import { describe, expect, it } from "vitest";
import { mapNotionHours, mapNotionWorkLog, type NotionPageLike } from "./native-mappers";

const text = (value: string) => ({ rich_text: [{ plain_text: value }] });
const title = (value: string) => ({ title: [{ plain_text: value }] });

describe("Notion native mapping", () => {
  it("maps an Hours page and preserves project relations", () => {
    const page: NotionPageLike = {
      id: "hours-page",
      url: "https://notion.so/hours-page",
      created_time: "2026-07-10T10:00:00.000Z",
      last_edited_time: "2026-07-10T11:00:00.000Z",
      properties: {
        Date: title("2026-07-10"),
        "Start Time": text("09:12"),
        "End Time": text("14:00"),
        "Break (min)": { number: 0 },
        "Total Hours": { number: 4.8 },
        "Hourly Rate": { number: 30 },
        Billable: { checkbox: true },
        Location: text("Remote"),
        Notes: text("Completed workflow testing"),
        Project: { relation: [{ id: "project-page" }] },
        "Migration Key": text("afp-hours-key"),
      },
    };
    const hours = mapNotionHours(page, { clientId: "client-page", databaseId: "hours-db" });
    expect(hours.id).toBe("hours-page");
    expect(hours.projectId).toBe("project-page");
    expect(hours.date).toBe("2026-07-10");
    expect(hours.notionUrl).toBe("https://notion.so/hours-page");
    expect(hours.externalId).toBe("afp-hours-key");
  });

  it("maps proposed Work Done privacy fields", () => {
    const page: NotionPageLike = {
      id: "work-page",
      properties: {
        Title: title("Verified BOL routing"),
        Date: { date: { start: "2026-07-10" } },
        Status: { select: { name: "done" } },
        Priority: { select: { name: "high" } },
        Summary: text("Safe summary"),
        "Invoice Description": text("Client invoice text"),
        Project: { relation: [{ id: "project-page" }] },
        "Client Visible": { checkbox: true },
        "Include in Invoice": { checkbox: true },
        "Include in Work Report": { checkbox: true },
        "Detailed Work Description": text("Detailed client-safe work"),
        "Internal Notes": text("Private engineering details"),
        "Evidence Links": text("https://example.com/evidence"),
        "Related Hours": { relation: [{ id: "hours-page" }] },
      },
    };
    const work = mapNotionWorkLog(page, { clientId: "client-page" });
    expect(work.clientVisible).toBe(true);
    expect(work.includeInInvoice).toBe(true);
    expect(work.internalNotes).toBe("Private engineering details");
    expect(work.relatedHoursIds).toEqual(["hours-page"]);
  });

  it("handles malformed rows with defaults and warnings instead of throwing", () => {
    const page: NotionPageLike = { id: "broken", properties: {} };
    const hours = mapNotionHours(page, { clientId: "client-page" });
    expect(hours.date).toBe("1970-01-01");
    expect(hours.startTime).toBe("00:00");
    expect(hours.validationWarnings?.length).toBeGreaterThan(0);
  });
});
