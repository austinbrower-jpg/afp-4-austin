import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { AppDataProvider, EntityStore, PersistenceResult } from "@/lib/data/provider-types";
import type { Client, HoursEntry, InvoiceReport, WorkLog, Workspace } from "@/types/domain";

const providerMocks = vi.hoisted(() => ({ getDataProvider: vi.fn() }));

vi.mock("@/lib/data/provider", () => ({
  getDataProvider: providerMocks.getDataProvider,
}));

import { POST } from "./route";

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
    relatedWorkLogId: "work-page",
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

function workLog(): WorkLog {
  return {
    id: "work-page",
    workspaceId: workspace.id,
    clientId: client.id,
    projectId: "bol",
    title: "July 10 work",
    date: "2026-07-10",
    summary: "Summary",
    detailedNotes: "",
    invoiceDescription: "Client-facing description",
    status: "done",
    priority: "high",
    relatedHoursIds: ["hours-page", "superseded"],
    relatedKnowledgeIds: [],
    evidence: [],
    githubLink: null,
    attachments: [],
    detailedWorkDescription: "Detailed Work Description",
    internalNotes: "INTERNAL ONLY",
    clientVisible: true,
    includeInInvoice: true,
    includeInWorkReport: true,
    evidenceLinks: [],
    notionPageId: "work-page",
    notionDatabaseId: "worklogs",
    notionUrl: "https://notion.so/work-page",
    syncStatus: "synced",
    lastSyncedAt: null,
    notionLastEditedTime: null,
    createdAt: "2026-07-10T00:00:00.000Z",
    updatedAt: "2026-07-10T00:00:00.000Z",
  };
}

function readOnlyStore<T extends { id: string }>(rows: T[]): EntityStore<T> {
  return {
    list: vi.fn(async () => rows),
    findById: vi.fn(async (id) => rows.find((row) => row.id === id) ?? null),
    create: vi.fn(async () => { throw new Error("unexpected create"); }),
    update: vi.fn(async () => { throw new Error("unexpected update"); }),
    remove: vi.fn(async () => { throw new Error("unexpected remove"); }),
  };
}

function providerWith(hours: HoursEntry[], workLogs: WorkLog[] = [workLog()], invoices: InvoiceReport[] = []) {
  const invoicesStore = readOnlyStore(invoices);
  invoicesStore.create = vi.fn(async (entity: InvoiceReport): Promise<PersistenceResult<InvoiceReport>> => ({
    entity,
    mode: "notion",
    notionPageId: "invoice-page",
    notionUrl: "https://notion.so/invoice-page",
    duplicatePrevented: false,
  }));
  const provider = {
    mode: "notion",
    workspace: vi.fn(async () => workspace),
    clients: readOnlyStore([client]),
    projects: readOnlyStore([
      { id: "bol", workspaceId: workspace.id, clientId: client.id, name: "BOL Review Process V2", description: "", status: "active", priority: "high", color: "#6366f1", tags: [], notes: "", notionPageId: "bol", notionDatabaseId: "projects", notionUrl: null, syncStatus: "synced", lastSyncedAt: null, notionLastEditedTime: null, createdAt: "2026-07-10T00:00:00.000Z", updatedAt: "2026-07-10T00:00:00.000Z" },
    ]),
    hours: readOnlyStore(hours),
    workLogs: readOnlyStore(workLogs),
    knowledge: readOnlyStore([]),
    invoices: invoicesStore,
  } as unknown as AppDataProvider;
  return { provider };
}

beforeEach(() => {
  providerMocks.getDataProvider.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Invoices route", () => {
  it("excludes superseded hours from invoice totals and saved line items", async () => {
    const { provider } = providerWith([
      hoursEntry({
        id: "superseded",
        startTime: "08:00",
        endTime: "09:00",
        externalId: "afp-history-v2-superseded-hours-2026-07-10-0800-0900",
      }),
      hoursEntry({
        id: "operational",
        startTime: "09:00",
        endTime: "10:00",
        externalId: "afp-history-v2-hours-2026-07-10-0900-1000-billable-bol-review-process-v2-v2",
      }),
    ]);
    providerMocks.getDataProvider.mockResolvedValue(provider);

    const response = await POST(new NextRequest("http://localhost/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodStart: "2026-07-10", periodEnd: "2026-07-10", previewConfirmed: true }),
    }));
    const body = await response.json() as InvoiceReport;

    expect(response.status).toBe(201);
    expect(body.totalHours).toBe(1);
    expect(body.totalAmount).toBe(30);
    expect(body.hoursEntryIds).toEqual(["operational"]);
    expect(body.lineItems).toHaveLength(1);
    expect(body.lineItems[0].hours).toBe(1);
  });
});
