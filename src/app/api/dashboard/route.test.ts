import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { AppDataProvider } from "@/lib/data/provider-types";
import type { Client, HoursEntry, InvoiceReport, KnowledgePage, Project, WorkLog, Workspace } from "@/types/domain";

const providerMocks = vi.hoisted(() => ({ getDataProvider: vi.fn() }));

vi.mock("@/lib/data/provider", () => ({
  getDataProvider: providerMocks.getDataProvider,
}));

import { GET } from "./route";

const workspace: Workspace = {
  id: "notion-production",
  name: "AFP Notion Workspace",
  slug: "notion-production",
  notionWorkspaceName: "AFP-Work",
  notionPageId: null,
  notionDatabaseId: null,
  notionUrl: null,
  syncStatus: "synced",
  lastSyncedAt: null,
  notionLastEditedTime: null,
  createdAt: "1970-01-01T00:00:00.000Z",
  updatedAt: "1970-01-01T00:00:00.000Z",
};

const client: Client = {
  id: "client-page",
  workspaceId: workspace.id,
  name: "Anytime Fuel Pros",
  color: "#6366f1",
  status: "active",
  defaultHourlyRate: 30,
  timezone: "America/Chicago",
  notes: "",
  notionPageId: "client-page",
  notionDatabaseId: "clients",
  notionUrl: "https://notion.so/client-page",
  syncStatus: "synced",
  lastSyncedAt: null,
  notionLastEditedTime: null,
  createdAt: "2026-07-10T00:00:00.000Z",
  updatedAt: "2026-07-10T00:00:00.000Z",
};

function hoursEntry(overrides: Partial<HoursEntry> = {}): HoursEntry {
  return {
    id: "hours-page",
    workspaceId: workspace.id,
    clientId: client.id,
    projectId: "bol",
    date: "2026-07-10",
    startTime: "09:00",
    endTime: "10:00",
    breakMinutes: 0,
    totalHours: 1,
    hourlyRate: 30,
    billable: true,
    location: "Remote",
    relatedWorkLogId: null,
    notes: "",
    source: "manual",
    externalId: null,
    notionPageId: "hours-page",
    notionDatabaseId: "hours",
    notionUrl: "https://notion.so/hours-page",
    syncStatus: "synced",
    lastSyncedAt: null,
    notionLastEditedTime: null,
    createdAt: "2026-07-10T00:00:00.000Z",
    updatedAt: "2026-07-10T00:00:00.000Z",
    ...overrides,
  };
}

function readOnlyStore<T extends { id: string }>(rows: T[]) {
  return {
    list: vi.fn(async () => rows),
    findById: vi.fn(async (id) => rows.find((row) => row.id === id) ?? null),
    create: vi.fn(async () => { throw new Error("unexpected create"); }),
    update: vi.fn(async () => { throw new Error("unexpected update"); }),
    remove: vi.fn(async () => { throw new Error("unexpected remove"); }),
  };
}

function providerWith(hours: HoursEntry[], invoices: InvoiceReport[] = []) {
  const provider = {
    mode: "notion",
    workspace: vi.fn(async () => workspace),
    clients: readOnlyStore([client]),
    projects: readOnlyStore<Project>([
      { id: "bol", workspaceId: workspace.id, clientId: client.id, name: "BOL Review Process V2", description: "", status: "active", priority: "high", color: "#6366f1", tags: [], notes: "", notionPageId: "bol", notionDatabaseId: "projects", notionUrl: null, syncStatus: "synced", lastSyncedAt: null, notionLastEditedTime: null, createdAt: "2026-07-10T00:00:00.000Z", updatedAt: "2026-07-10T00:00:00.000Z" },
      { id: "docs", workspaceId: workspace.id, clientId: client.id, name: "Power Automate Documentation", description: "", status: "active", priority: "medium", color: "#6366f1", tags: [], notes: "", notionPageId: "docs", notionDatabaseId: "projects", notionUrl: null, syncStatus: "synced", lastSyncedAt: null, notionLastEditedTime: null, createdAt: "2026-07-10T00:00:00.000Z", updatedAt: "2026-07-10T00:00:00.000Z" },
    ]),
    hours: readOnlyStore(hours),
    workLogs: readOnlyStore<WorkLog>([]),
    knowledge: readOnlyStore<KnowledgePage>([]),
    invoices: readOnlyStore(invoices),
  } as unknown as AppDataProvider;
  return provider;
}

beforeEach(() => {
  providerMocks.getDataProvider.mockReset();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-10T12:00:00-05:00"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Dashboard route", () => {
  it("excludes superseded hours from totals and active-project selection", async () => {
    providerMocks.getDataProvider.mockResolvedValue(providerWith([
      hoursEntry({
        id: "superseded",
        projectId: "docs",
        startTime: "08:00",
        endTime: "09:00",
        externalId: "afp-history-v2-superseded-hours-2026-07-10-0800-0900",
      }),
      hoursEntry({
        id: "operational-billable",
        projectId: "bol",
        startTime: "09:00",
        endTime: "10:00",
        externalId: "afp-history-v2-hours-2026-07-10-0900-1000-billable-bol-review-process-v2-v2",
      }),
      hoursEntry({
        id: "operational-nonbillable",
        projectId: null,
        billable: false,
        startTime: "10:00",
        endTime: "11:00",
        externalId: null,
      }),
    ]));

    const response = await GET();
    const body = await response.json() as {
      today: { hours: number };
      week: { hours: number };
      month: { hours: number };
      currentInvoiceAmount: number;
      activeProject: { name: string } | null;
    };

    expect(response.status).toBe(200);
    expect(body.today.hours).toBe(2);
    expect(body.week.hours).toBe(2);
    expect(body.month.hours).toBe(2);
    expect(body.currentInvoiceAmount).toBe(30);
    expect(body.activeProject?.name).toBe("BOL Review Process V2");
  });
});
