import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatLastSyncedLabel, refreshNotionData } from "./notion-refresh";

function makeQueryClient() {
  return {
    refetchQueries: vi.fn(async () => undefined),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Notion refresh helper", () => {
  it("refetches the hours, dashboard, and runtime status query scopes", async () => {
    const queryClient = makeQueryClient();

    const refreshedAt = await refreshNotionData(queryClient as never);

    expect(refreshedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(queryClient.refetchQueries).toHaveBeenCalledTimes(3);
    expect(queryClient.refetchQueries).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ queryKey: ["hours"], exact: false, type: "active" }),
    );
    expect(queryClient.refetchQueries).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ queryKey: ["dashboard", "summary"], exact: false, type: "active" }),
    );
    expect(queryClient.refetchQueries).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ queryKey: ["runtime-status"], exact: false, type: "active" }),
    );
  });

  it("formats a clear last-synced label", () => {
    expect(formatLastSyncedLabel(null)).toBe("Last synced: not yet refreshed");
    expect(formatLastSyncedLabel("2026-07-14T09:42:00.000Z")).toContain("Last synced:");
  });
});
