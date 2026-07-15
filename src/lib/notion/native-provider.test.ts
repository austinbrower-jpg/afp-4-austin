import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Client as NotionClient } from "@notionhq/client";
import { NativeNotionProvider } from "./native-provider";
import type { HoursEntry, Project } from "@/types/domain";

const title = (value: string) => ({ title: [{ plain_text: value }] });
const text = (value: string) => ({ rich_text: [{ plain_text: value }] });
const date = (value: string) => ({ date: { start: value } });
const childPageBlock = (id: string, pageTitle: string) => ({ object: "block", id, type: "child_page", has_children: true, child_page: { title: pageTitle } });
const paragraphBlock = (value: string) => ({ object: "block", id: `p-${value.slice(0, 8)}`, type: "paragraph", has_children: false, paragraph: { rich_text: [{ plain_text: value }] } });
const headingBlock = (value: string) => ({ object: "block", id: `h-${value.slice(0, 8)}`, type: "heading_2", has_children: false, heading_2: { rich_text: [{ plain_text: value }] } });

function mockNotion(options: {
  clients?: unknown[];
  hours?: unknown[];
  worklogs?: unknown[];
  knowledge?: unknown[];
  queryError?: Error;
} = {}) {
  const clientPage = { object: "page", id: "client-page", properties: { Name: title("Anytime Fuel Pros"), Status: { select: { name: "active" } }, "Default Hourly Rate": { number: 30 }, Color: text("#6366f1"), Timezone: text("America/Chicago"), Notes: text("") } };
  const queries: Record<string, unknown[]> = {
    "clients-source": options.clients ?? [clientPage],
    "hours-source": options.hours ?? [],
    "projects-source": [],
    "worklogs-source": options.worklogs ?? [],
    "knowledge-source": options.knowledge ?? [],
    "invoices-source": [],
  };
  const notion = {
    databases: { retrieve: vi.fn(async ({ database_id }: { database_id: string }) => ({ data_sources: [{ id: `${database_id}-source` }] })) },
    dataSources: {
      query: vi.fn(async ({ data_source_id }: { data_source_id: string }) => {
        if (options.queryError) throw options.queryError;
        return { results: queries[data_source_id] ?? [], has_more: false, next_cursor: null };
      }),
      retrieve: vi.fn(async ({ data_source_id }: { data_source_id: string }) => ({ properties: data_source_id === "hours-source" ? {
        Date: { type: "title" }, "Start Time": { type: "rich_text" }, "End Time": { type: "rich_text" },
        "Break (min)": { type: "number" }, "Total Hours": { type: "number" }, "Hourly Rate": { type: "number" },
        Billable: { type: "checkbox" }, Location: { type: "rich_text" }, Notes: { type: "rich_text" }, Project: { type: "relation" },
      } : {
        Name: { type: "title" }, Status: { type: "select" }, Priority: { type: "select" },
        Description: { type: "rich_text" }, Tags: { type: "multi_select" }, Color: { type: "rich_text" },
      } })),
    },
    blocks: { children: { list: vi.fn(async () => ({ results: [], has_more: false, next_cursor: null })) } },
    pages: {
      create: vi.fn(async ({ properties }: { properties: Record<string, unknown> }) => ({ object: "page", id: "created-page", url: "https://notion.so/created-page", properties })),
      update: vi.fn(async ({ page_id, properties }: { page_id: string; properties: Record<string, unknown> }) => ({ object: "page", id: page_id, url: `https://notion.so/${page_id}`, properties })),
    },
  };
  return notion;
}

const databases = { client: "clients", project: "projects", hours: "hours", worklog: "worklogs", knowledge: "knowledge", invoice: "invoices" };

beforeEach(() => {
  process.env.NOTION_API_KEY = "secret";
  process.env.NOTION_DATABASE_CLIENTS = "clients";
  process.env.NOTION_DATABASE_PROJECTS = "projects";
  process.env.NOTION_DATABASE_HOURS = "hours";
  process.env.NOTION_DATABASE_WORKLOGS = "worklogs";
  process.env.NOTION_DATABASE_KNOWLEDGE = "knowledge";
  process.env.NOTION_DATABASE_INVOICES = "invoices";
  process.env.NOTION_SYNC_ENABLED = "false";
});

describe("NativeNotionProvider", () => {
  it("settles with an empty client list when the Clients database has no rows", async () => {
    const notion = mockNotion({ clients: [] });
    const provider = new NativeNotionProvider(notion as unknown as NotionClient, databases);

    await expect(provider.clients.list()).resolves.toEqual([]);
    expect(notion.dataSources.query).toHaveBeenCalledTimes(1);
  });

  it("reads live Notion rows into shared domain models", async () => {
    const hoursPage = { object: "page", id: "hours-page", url: "https://notion.so/hours-page", properties: {
      Date: title("2026-07-10"), "Start Time": text("09:00"), "End Time": text("10:00"),
      "Break (min)": { number: 0 }, "Total Hours": { number: 1 }, "Hourly Rate": { number: 30 },
      Billable: { checkbox: true }, Location: text("Remote"), Notes: text("Done"), Project: { relation: [] },
    } };
    const notion = mockNotion({ hours: [hoursPage] });
    const provider = new NativeNotionProvider(notion as unknown as NotionClient, databases);
    const rows = await provider.hours.list();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: "hours-page", clientId: "client-page", date: "2026-07-10" });
    expect(notion.dataSources.query).toHaveBeenCalled();
  });

  it("caches lightweight Work Done and knowledge projections without crawling page bodies", async () => {
    const worklogPage = {
      object: "page",
      id: "worklog-page",
      properties: {
        Title: title("Structured work log"),
        Date: date("2026-07-15"),
        Status: { select: { name: "done" } },
        Priority: { select: { name: "medium" } },
      },
    };
    const knowledgePage = {
      object: "page",
      id: "knowledge-page",
      properties: {
        Title: title("Runbook"),
        Type: { select: { name: "documentation" } },
        Tags: { multi_select: [] },
      },
    };
    const notion = mockNotion({ worklogs: [worklogPage], knowledge: [knowledgePage] });
    const provider = new NativeNotionProvider(notion as unknown as NotionClient, databases);

    await Promise.all([provider.workLogsForSummary(), provider.knowledgeForReporting()]);
    await Promise.all([provider.workLogsForSummary(), provider.knowledgeForReporting()]);

    const queriesFor = (source: string) => notion.dataSources.query.mock.calls.filter(
      ([request]) => (request as { data_source_id: string }).data_source_id === source,
    );
    expect(queriesFor("worklogs-source")).toHaveLength(1);
    expect(queriesFor("knowledge-source")).toHaveLength(1);
    expect(notion.blocks.children.list).not.toHaveBeenCalled();
  });

  it("prevents duplicate hours without issuing a Notion create", async () => {
    const hoursPage = { object: "page", id: "existing", properties: {
      Date: title("2026-07-10"), "Start Time": text("09:00"), "End Time": text("10:00"), "Break (min)": { number: 0 },
      "Total Hours": { number: 1 }, "Hourly Rate": { number: 30 }, Billable: { checkbox: true }, Location: text(""), Notes: text(""), Project: { relation: [] },
    } };
    const notion = mockNotion({ hours: [hoursPage] });
    const provider = new NativeNotionProvider(notion as unknown as NotionClient, databases);
    const entity: HoursEntry = { id: "draft", workspaceId: "notion-production", clientId: "client-page", projectId: null, date: "2026-07-10", startTime: "09:00", endTime: "10:00", breakMinutes: 0, totalHours: 1, hourlyRate: 30, billable: true, location: "", relatedWorkLogId: null, notes: "", source: "manual", notionPageId: null, notionDatabaseId: null, syncStatus: "local-only", lastSyncedAt: null, notionLastEditedTime: null, createdAt: "2026-07-10T00:00:00Z", updatedAt: "2026-07-10T00:00:00Z" };
    await expect(provider.hours.create(entity)).rejects.toMatchObject({ code: "duplicate" });
    expect(notion.pages.create).not.toHaveBeenCalled();
  });

  it("creates Hours with the provider's empty client identity and omits null relations", async () => {
    const notion = mockNotion({ clients: [] });
    const provider = new NativeNotionProvider(notion as unknown as NotionClient, databases);
    const entity: HoursEntry = { id: "draft", workspaceId: "notion-production", clientId: "", projectId: null, date: "2026-07-10", startTime: "12:44", endTime: "12:45", breakMinutes: 0, totalHours: 1 / 60, hourlyRate: 30, billable: false, location: "Remote", relatedWorkLogId: null, notes: "PRODUCTION SMOKE TEST - SAFE TO REMOVE MANUALLY", source: "manual", notionPageId: null, notionDatabaseId: null, syncStatus: "local-only", lastSyncedAt: null, notionLastEditedTime: null, createdAt: "2026-07-10T17:44:00Z", updatedAt: "2026-07-10T17:44:00Z" };

    await provider.hours.create(entity);

    expect(notion.pages.create).toHaveBeenCalledTimes(1);
    const request = notion.pages.create.mock.calls[0][0] as { properties: Record<string, unknown> };
    expect(request.properties.Date).toEqual({ title: [{ type: "text", text: { content: "2026-07-10" } }] });
    expect(request.properties).not.toHaveProperty("Project");
    expect(request.properties).not.toHaveProperty("Related Work Log");
    expect(Object.values(request.properties)).not.toContain(null);
  });

  it("validates schema before an explicit update", async () => {
    const notion = mockNotion();
    const provider = new NativeNotionProvider(notion as unknown as NotionClient, databases);
    const project: Project = { id: "project-page", workspaceId: "notion-production", clientId: "client-page", name: "BOL Review", description: "", status: "active", priority: "medium", color: "#6366f1", tags: [], notes: "", notionPageId: "project-page", notionDatabaseId: "projects", syncStatus: "synced", lastSyncedAt: null, notionLastEditedTime: null, createdAt: "2026-07-10T00:00:00Z", updatedAt: "2026-07-10T00:00:00Z" };
    await provider.projects.update(project.id, project);
    expect(notion.dataSources.retrieve).toHaveBeenCalled();
    expect(notion.pages.update).toHaveBeenCalledTimes(1);
  });

  it("returns a useful Notion API error", async () => {
    const provider = new NativeNotionProvider(mockNotion({ queryError: new Error("rate limited") }) as unknown as NotionClient, databases);
    await expect(provider.clients.list()).rejects.toEqual(expect.objectContaining({ code: "notion-api", status: 502 }));
  });

  it("merges paginated Work Done rows with dated child pages and keeps active-session content", async () => {
    const worklogPagesPage1 = [
      {
        object: "page",
        id: "july8-db",
        url: "https://notion.so/july8-db",
        created_time: "2026-07-08T12:00:00.000Z",
        last_edited_time: "2026-07-14T23:00:00.000Z",
        properties: {
          Title: title("July 8, 2026"),
          Date: date("2026-07-08"),
          Summary: text("Stable database summary for July 8."),
          "Detailed Work Description": text("Database row details for July 8."),
          "Internal Notes": text("Database notes."),
          "Invoice Description": text("Database invoice description."),
          Status: { select: { name: "done" } },
          Priority: { select: { name: "medium" } },
          "Client Visible": { checkbox: true },
          "Include in Invoice": { checkbox: true },
          "Include in Work Report": { checkbox: true },
        },
      },
      {
        object: "page",
        id: "july9-db",
        url: "https://notion.so/july9-db",
        created_time: "2026-07-09T12:00:00.000Z",
        last_edited_time: "2026-07-14T23:00:00.000Z",
        properties: {
          Title: title("July 9, 2026"),
          Date: date("2026-07-09"),
          Summary: text("Stable database summary for July 9."),
          "Detailed Work Description": text("Database row details for July 9."),
          "Invoice Description": text("Database invoice description."),
          Status: { select: { name: "done" } },
          Priority: { select: { name: "high" } },
          "Client Visible": { checkbox: true },
          "Include in Invoice": { checkbox: true },
          "Include in Work Report": { checkbox: true },
        },
      },
    ];
    const worklogPagesPage2 = [
      {
        object: "page",
        id: "july10-db",
        url: "https://notion.so/july10-db",
        created_time: "2026-07-10T12:00:00.000Z",
        last_edited_time: "2026-07-14T23:00:00.000Z",
        properties: {
          Title: title("July 10, 2026"),
          Date: date("2026-07-10"),
          Summary: text("Stable database summary for July 10."),
          "Detailed Work Description": text("Database row details for July 10."),
          "Invoice Description": text("Database invoice description."),
          Status: { select: { name: "done" } },
          Priority: { select: { name: "high" } },
          "Client Visible": { checkbox: true },
          "Include in Invoice": { checkbox: true },
          "Include in Work Report": { checkbox: true },
        },
      },
      {
        object: "page",
        id: "july13-db",
        url: "https://notion.so/july13-db",
        created_time: "2026-07-13T12:00:00.000Z",
        last_edited_time: "2026-07-14T23:00:00.000Z",
        properties: {
          Title: title("July 13, 2026"),
          Date: date("2026-07-13"),
          Summary: text("Stable database summary for July 13."),
          "Detailed Work Description": text("Database row details for July 13."),
          "Invoice Description": text("Database invoice description."),
          Status: { select: { name: "done" } },
          Priority: { select: { name: "medium" } },
          "Client Visible": { checkbox: true },
          "Include in Invoice": { checkbox: true },
          "Include in Work Report": { checkbox: true },
        },
      },
      {
        object: "page",
        id: "july14-db",
        url: "https://notion.so/july14-db",
        created_time: "2026-07-14T12:00:00.000Z",
        last_edited_time: "2026-07-14T23:00:00.000Z",
        properties: {
          Title: title("July 14, 2026"),
          Date: date("2026-07-14"),
          Summary: text(""),
          "Detailed Work Description": text(""),
          "Internal Notes": text(""),
          "Invoice Description": text(""),
          Status: { select: { name: "not-started" } },
          Priority: { select: { name: "medium" } },
          "Client Visible": { checkbox: true },
          "Include in Invoice": { checkbox: false },
          "Include in Work Report": { checkbox: false },
          "Approval Status": { select: { name: "Approved" } },
        },
      },
    ];
    const childTitles: Record<string, string> = {
      "july8-child": "July 8, 2026",
      "july9-child": "July 9, 2026",
      "july10-child": "July 10, 2026",
      "july13-child": "July 13, 2026",
      "july14-child": "July 14, 2026",
    };
    const childBodies: Record<string, unknown[]> = {
      "july8-child": [headingBlock("Invoice Description"), paragraphBlock("Child page description for July 8.")],
      "july9-child": [headingBlock("Invoice Description"), paragraphBlock("Child page description for July 9.")],
      "july10-child": [headingBlock("Invoice Description"), paragraphBlock("Child page description for July 10.")],
      "july13-child": [headingBlock("Invoice Description"), paragraphBlock("Child page description for July 13.")],
      "july14-child": [
        headingBlock("Work Performed"),
        paragraphBlock("Current Session: Still active; final duration and amount will be calculated when clocked out."),
        headingBlock("Invoice Description"),
        paragraphBlock("Reviewed and improved the AFP BOL Review workbook and continued documentation work."),
        headingBlock("Notes / Evidence"),
        paragraphBlock("Evidence note for July 14."),
      ],
    };
    const notion = {
      databases: { retrieve: vi.fn(async () => ({ data_sources: [{ id: "worklogs-source" }] })) },
      dataSources: {
        query: vi.fn(async ({ start_cursor }: { start_cursor?: string }) => {
          if (start_cursor === "cursor-2") return { results: worklogPagesPage2, has_more: false, next_cursor: null };
          return { results: worklogPagesPage1, has_more: true, next_cursor: "cursor-2" };
        }),
        retrieve: vi.fn(async () => ({ properties: { Title: { type: "title" }, Date: { type: "date" }, Summary: { type: "rich_text" }, "Detailed Work Description": { type: "rich_text" }, "Internal Notes": { type: "rich_text" }, "Invoice Description": { type: "rich_text" }, Status: { type: "select" }, Priority: { type: "select" }, "Client Visible": { type: "checkbox" }, "Include in Invoice": { type: "checkbox" }, "Include in Work Report": { type: "checkbox" }, "Approval Status": { type: "select" } } })),
      },
      search: vi.fn(async () => ({ results: [{ object: "page", id: "work-done-root", properties: { title: title("Work Done") } }], has_more: false, next_cursor: null })),
      blocks: {
        children: {
          list: vi.fn(async ({ block_id }: { block_id: string }) => {
            if (block_id === "work-done-root") {
              return {
                results: [
                  childPageBlock("july8-child", "July 8, 2026"),
                  childPageBlock("july9-child", "July 9, 2026"),
                  childPageBlock("july10-child", "July 10, 2026"),
                  childPageBlock("july13-child", "July 13, 2026"),
                  childPageBlock("july14-child", "July 14, 2026"),
                ],
                has_more: false,
                next_cursor: null,
              };
            }
            if (block_id === "july14-child") {
              return { results: childBodies["july14-child"], has_more: false, next_cursor: null };
            }
            return { results: childBodies[block_id] ?? [], has_more: false, next_cursor: null };
          }),
        },
      },
      pages: {
        retrieve: vi.fn(async ({ page_id }: { page_id: string }) => ({
          object: "page",
          id: page_id,
          url: `https://notion.so/${page_id}`,
          created_time: `${childTitles[page_id] ? childTitles[page_id].startsWith("July 14") ? "2026-07-14T12:00:00.000Z" : "2026-07-10T12:00:00.000Z" : "2026-07-10T12:00:00.000Z"}`,
          last_edited_time: "2026-07-14T23:00:00.000Z",
          properties: { title: title(childTitles[page_id] ?? page_id) },
        })),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    const provider = new NativeNotionProvider(notion as unknown as NotionClient, databases);

    const rows = await provider.workLogs.list();

    expect(rows).toHaveLength(5);
    expect(rows.map((row) => row.date)).toEqual(["2026-07-14", "2026-07-13", "2026-07-10", "2026-07-09", "2026-07-08"]);
    const july14 = rows.find((row) => row.date === "2026-07-14");
    expect(july14).toBeTruthy();
    expect(july14?.summary).toContain("Reviewed and improved");
    expect(july14?.status).toBe("in-progress");
    expect(july14?.id).toBe("july14-db");
    expect(rows.filter((row) => row.date === "2026-07-13")).toHaveLength(1);
    expect(notion.pages.retrieve).not.toHaveBeenCalled();
  });

  it("deduplicates concurrent hours reads but never caches a completed hours result", async () => {
    const notion = mockNotion();
    const provider = new NativeNotionProvider(notion as unknown as NotionClient, databases);

    await Promise.all([provider.hours.list(), provider.hours.list()]);
    await provider.hours.list();

    const hoursQueries = notion.dataSources.query.mock.calls.filter(
      ([request]) => (request as { data_source_id: string }).data_source_id === "hours-source",
    );
    expect(hoursQueries).toHaveLength(2);
  });

  it("skips malformed child pages without dropping valid siblings", async () => {
    const notion = {
      databases: { retrieve: vi.fn(async () => ({ data_sources: [{ id: "worklogs-source" }] })) },
      dataSources: {
        query: vi.fn(async () => ({ results: [], has_more: false, next_cursor: null })),
        retrieve: vi.fn(async () => ({ properties: { Title: { type: "title" }, Date: { type: "date" } } })),
      },
      search: vi.fn(async () => ({ results: [{ object: "page", id: "work-done-root", properties: { title: title("Work Done") } }], has_more: false, next_cursor: null })),
      blocks: {
        children: {
          list: vi.fn(async ({ block_id }: { block_id: string }) => {
            if (block_id === "work-done-root") {
              return {
                results: [
                  childPageBlock("good-child", "July 12, 2026"),
                  childPageBlock("bad-child", "July 11, 2026"),
                ],
                has_more: false,
                next_cursor: null,
              };
            }
            if (block_id === "bad-child") throw new Error("malformed child page");
            return {
              results: [headingBlock("Invoice Description"), paragraphBlock(`Child page body for ${block_id}`)],
              has_more: false,
              next_cursor: null,
            };
          }),
        },
      },
      pages: {
        retrieve: vi.fn(async ({ page_id }: { page_id: string }) => ({
          object: "page",
          id: page_id,
          url: `https://notion.so/${page_id}`,
          created_time: "2026-07-12T12:00:00.000Z",
          last_edited_time: "2026-07-12T12:00:00.000Z",
          properties: { title: title(page_id === "good-child" ? "July 12, 2026" : "July 11, 2026") },
        })),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    const provider = new NativeNotionProvider(notion as unknown as NotionClient, databases);

    const rows = await provider.workLogs.list();

    expect(rows.some((row) => row.date === "2026-07-12")).toBe(true);
    expect(rows.some((row) => row.date === "2026-07-11")).toBe(true);
    expect(rows.find((row) => row.date === "2026-07-12")?.summary).toContain("Child page body");
  });
});
