import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { sumBillableAmount } from "@/lib/calculations";
import type { AppDataProvider, EntityStore, PersistenceResult } from "@/lib/data/provider-types";
import type { Client, HoursEntry, Workspace } from "@/types/domain";

const providerMocks = vi.hoisted(() => ({ getDataProvider: vi.fn() }));

vi.mock("@/lib/data/provider", () => ({
  getDataProvider: providerMocks.getDataProvider,
}));

import { GET, POST } from "./route";

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

function hoursEntry(overrides: Partial<HoursEntry> = {}): HoursEntry {
  return {
    id: "hours-page",
    workspaceId: workspace.id,
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
    notionPageId: "hours-page",
    notionDatabaseId: "hours",
    notionUrl: "https://notion.so/hours-page",
    syncStatus: "synced",
    lastSyncedAt: null,
    notionLastEditedTime: null,
    createdAt: "2026-07-10T17:44:00.000Z",
    updatedAt: "2026-07-10T17:44:00.000Z",
    ...overrides,
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

function providerWith(options: {
  mode: "mock" | "notion";
  clients?: Client[];
  hours?: HoursEntry[];
}) {
  const hoursRows = options.hours ?? [];
  const hoursCreate = vi.fn(async (entity: HoursEntry): Promise<PersistenceResult<HoursEntry>> => {
    const saved = hoursEntry({ ...entity, id: "hours-page" });
    return {
      entity: saved,
      mode: options.mode,
      notionPageId: options.mode === "notion" ? saved.id : null,
      notionUrl: options.mode === "notion" ? saved.notionUrl ?? null : null,
      duplicatePrevented: false,
    };
  });
  const hoursStore = readOnlyStore(hoursRows);
  hoursStore.create = hoursCreate;
  const provider = {
    mode: options.mode,
    workspace: vi.fn(async () => workspace),
    clients: readOnlyStore(options.clients ?? []),
    projects: readOnlyStore([]),
    hours: hoursStore,
    workLogs: readOnlyStore([]),
    knowledge: readOnlyStore([]),
    invoices: readOnlyStore([]),
  } as unknown as AppDataProvider;
  return { provider, hoursCreate };
}

const smokeInput = {
  date: "2026-07-10",
  startTime: "12:44",
  endTime: "12:45",
  breakMinutes: 0,
  hourlyRate: 30,
  billable: false,
  location: "Remote",
  projectId: null,
  relatedWorkLogId: null,
  notes: "PRODUCTION SMOKE TEST - SAFE TO REMOVE MANUALLY",
  source: "manual",
};

beforeEach(() => providerMocks.getDataProvider.mockReset());

describe("Hours route activation policy", () => {
  it("creates a one-minute non-billable Notion entry without a Client row", async () => {
    const { provider, hoursCreate } = providerWith({ mode: "notion" });
    providerMocks.getDataProvider.mockResolvedValue(provider);

    const response = await POST(new NextRequest("http://localhost/api/hours", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(smokeInput),
    }));
    const body = await response.json() as HoursEntry;

    expect(response.status).toBe(201);
    expect(hoursCreate).toHaveBeenCalledTimes(1);
    expect(hoursCreate.mock.calls[0][0]).toMatchObject({
      clientId: "",
      projectId: null,
      relatedWorkLogId: null,
      totalHours: 1 / 60,
      billable: false,
    });
    expect(body.totalHours * 60).toBeCloseTo(1);
    expect(sumBillableAmount([body])).toBe(0);
  });

  it("reads back all Notion Hours when the Clients database is empty", async () => {
    const saved = hoursEntry();
    const { provider } = providerWith({ mode: "notion", hours: [saved] });
    providerMocks.getDataProvider.mockResolvedValue(provider);

    const response = await GET(new NextRequest("http://localhost/api/hours"));
    const body = await response.json() as HoursEntry[];

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({ id: saved.id, clientId: "", notes: saved.notes });
  });

  it("uses lightweight Work Done rows for relation labels", async () => {
    const saved = hoursEntry();
    const { provider } = providerWith({ mode: "notion", hours: [saved] });
    const workLogsForSummary = vi.fn(async () => []);
    provider.workLogsForSummary = workLogsForSummary;
    providerMocks.getDataProvider.mockResolvedValue(provider);

    const response = await GET(new NextRequest("http://localhost/api/hours"));

    expect(response.status).toBe(200);
    expect(workLogsForSummary).toHaveBeenCalledTimes(1);
    expect(provider.workLogs.list).not.toHaveBeenCalled();
  });

  it("continues to require a Client in mock mode", async () => {
    const { provider, hoursCreate } = providerWith({ mode: "mock" });
    providerMocks.getDataProvider.mockResolvedValue(provider);

    const response = await POST(new NextRequest("http://localhost/api/hours", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(smokeInput),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "No workspace/client configured." });
    expect(hoursCreate).not.toHaveBeenCalled();
  });
});
