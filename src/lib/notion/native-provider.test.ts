import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Client as NotionClient } from "@notionhq/client";
import { NativeNotionProvider } from "./native-provider";
import type { HoursEntry, Project } from "@/types/domain";

const title = (value: string) => ({ title: [{ plain_text: value }] });
const text = (value: string) => ({ rich_text: [{ plain_text: value }] });

function mockNotion(options: { hours?: unknown[]; queryError?: Error } = {}) {
  const clientPage = { object: "page", id: "client-page", properties: { Name: title("Anytime Fuel Pros"), Status: { select: { name: "active" } }, "Default Hourly Rate": { number: 30 }, Color: text("#6366f1"), Timezone: text("America/Chicago"), Notes: text("") } };
  const queries: Record<string, unknown[]> = {
    "clients-source": [clientPage],
    "hours-source": options.hours ?? [],
    "projects-source": [], "worklogs-source": [], "knowledge-source": [], "invoices-source": [],
  };
  const notion = {
    databases: { retrieve: vi.fn(async ({ database_id }: { database_id: string }) => ({ data_sources: [{ id: `${database_id}-source` }] })) },
    dataSources: {
      query: vi.fn(async ({ data_source_id }: { data_source_id: string }) => {
        if (options.queryError) throw options.queryError;
        return { results: queries[data_source_id] ?? [], has_more: false, next_cursor: null };
      }),
      retrieve: vi.fn(async () => ({ properties: {
        Name: { type: "title" }, Status: { type: "select" }, Priority: { type: "select" },
        Description: { type: "rich_text" }, Tags: { type: "multi_select" }, Color: { type: "rich_text" },
      } })),
    },
    blocks: { children: { list: vi.fn(async () => ({ results: [], has_more: false, next_cursor: null })) } },
    pages: {
      create: vi.fn(),
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
});
