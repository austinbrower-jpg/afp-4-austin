import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDataProvider: vi.fn(),
}));

vi.mock("@/lib/data/provider", () => ({
  getDataProvider: mocks.getDataProvider,
}));

import { GET } from "./route";

beforeEach(() => {
  mocks.getDataProvider.mockReset();
});

describe("GET /api/invoices/dashboard", () => {
  it("returns a valid native Notion dashboard payload", async () => {
    mocks.getDataProvider.mockResolvedValue({
      mode: "notion",
      clients: { list: vi.fn(async () => []) },
      invoices: { list: vi.fn(async () => []) },
      hours: { list: vi.fn(async () => []) },
      workLogs: { list: vi.fn(async () => []) },
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      summary: {
        byStatus: { draft: 0, sent: 0, paid: 0, void: 0 },
        totalBillableHours: 0,
      },
      clients: [],
    });
  });

  it("returns a safe error payload when the required source fails", async () => {
    mocks.getDataProvider.mockRejectedValue(new Error("private upstream detail"));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Invoice Dashboard data could not be loaded.");
    expect(JSON.stringify(body)).not.toContain("private upstream detail");
  });
});
