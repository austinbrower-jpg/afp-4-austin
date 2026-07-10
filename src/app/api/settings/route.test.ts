import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppDataProvider } from "@/lib/data/provider-types";
import { DataProviderError } from "@/lib/data/provider-types";
import type { Client, Workspace } from "@/types/domain";

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

function providerWithClients(rows: Client[]) {
  return {
    mode: "notion",
    workspace: vi.fn(async () => workspace),
    clients: { list: vi.fn(async () => rows) },
  } as unknown as AppDataProvider;
}

beforeEach(() => providerMocks.getDataProvider.mockReset());

describe("Settings route", () => {
  it("returns a successful null client when the Notion Clients database is empty", async () => {
    providerMocks.getDataProvider.mockResolvedValue(providerWithClients([]));

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ workspace, client: null });
  });

  it("returns the configured Notion client", async () => {
    providerMocks.getDataProvider.mockResolvedValue(providerWithClients([client]));

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ workspace, client });
  });

  it("returns an explicit error when the Notion client lookup fails", async () => {
    const provider = providerWithClients([]);
    vi.mocked(provider.clients.list).mockRejectedValue(
      new DataProviderError("Notion read (client) failed: rate limited", "notion-api", 502),
    );
    providerMocks.getDataProvider.mockResolvedValue(provider);

    const response = await GET();

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      error: "Notion read (client) failed: rate limited",
      code: "notion-api",
    });
  });
});
