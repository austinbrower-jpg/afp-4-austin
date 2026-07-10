import { describe, expect, it } from "vitest";
import {
  computeAmount,
  computeTotalHours,
  entriesInRange,
  entriesToday,
  formatCurrency,
  formatHours,
  minutesBetween,
  sumBillableAmount,
  sumHours,
} from "@/lib/calculations";
import type { HoursEntry } from "@/types/domain";

function entry(overrides: Partial<HoursEntry>): HoursEntry {
  return {
    id: "hrs_1",
    workspaceId: "ws_1",
    clientId: "cli_1",
    projectId: null,
    date: "2026-07-01",
    startTime: "09:00",
    endTime: "17:00",
    breakMinutes: 30,
    totalHours: 7.5,
    hourlyRate: 100,
    billable: true,
    location: "",
    relatedWorkLogId: null,
    notes: "",
    source: "manual",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    notionPageId: null,
    notionDatabaseId: null,
    syncStatus: "local-only",
    lastSyncedAt: null,
    notionLastEditedTime: null,
    ...overrides,
  };
}

describe("minutesBetween", () => {
  it("computes minutes within the same day", () => {
    expect(minutesBetween("09:00", "17:00")).toBe(480);
  });

  it("wraps past midnight when end is before start", () => {
    expect(minutesBetween("22:00", "02:00")).toBe(240);
  });

  it("returns 0 for identical start and end", () => {
    expect(minutesBetween("09:00", "09:00")).toBe(0);
  });
});

describe("computeTotalHours", () => {
  it("subtracts break minutes and converts to hours", () => {
    expect(computeTotalHours("09:00", "17:00", 30)).toBeCloseTo(7.5);
  });

  it("never returns a negative total", () => {
    expect(computeTotalHours("09:00", "09:15", 60)).toBe(0);
  });

  it("treats a missing break as zero", () => {
    expect(computeTotalHours("09:00", "10:00", 0)).toBeCloseTo(1);
  });

  it("rounds to the nearest hundredth", () => {
    expect(computeTotalHours("09:00", "09:20", 0)).toBeCloseTo(0.33);
  });
});

describe("computeAmount", () => {
  it("multiplies hours by rate and rounds to cents", () => {
    expect(computeAmount(7.5, 100)).toBe(750);
    expect(computeAmount(1 / 3, 90)).toBe(30);
  });
});

describe("formatHours / formatCurrency", () => {
  it("formats hours with two decimal places and a trailing h", () => {
    expect(formatHours(7.5)).toBe("7.50h");
  });

  it("formats currency as USD by default", () => {
    expect(formatCurrency(1234.5)).toBe("$1,234.50");
  });
});

describe("sumHours / sumBillableAmount", () => {
  const entries = [
    entry({ id: "a", totalHours: 4, hourlyRate: 100, billable: true }),
    entry({ id: "b", totalHours: 3.25, hourlyRate: 100, billable: true }),
    entry({ id: "c", totalHours: 5, hourlyRate: 200, billable: false }),
  ];

  it("sums total hours across all entries regardless of billable status", () => {
    expect(sumHours(entries)).toBeCloseTo(12.25);
  });

  it("sums billable amount only for billable entries", () => {
    expect(sumBillableAmount(entries)).toBeCloseTo(725);
  });

  it("returns 0 for an empty list", () => {
    expect(sumHours([])).toBe(0);
    expect(sumBillableAmount([])).toBe(0);
  });
});

describe("entriesInRange / entriesToday", () => {
  const entries = [
    entry({ id: "a", date: "2026-06-30" }),
    entry({ id: "b", date: "2026-07-01" }),
    entry({ id: "c", date: "2026-07-05" }),
  ];

  it("filters entries within an inclusive date range", () => {
    const result = entriesInRange(
      entries,
      new Date("2026-07-01T00:00:00Z"),
      new Date("2026-07-05T23:59:59Z"),
    );
    expect(result.map((e) => e.id)).toEqual(["b", "c"]);
  });

  it("filters entries matching a given day", () => {
    const result = entriesToday(entries, new Date("2026-07-01T12:00:00Z"));
    expect(result.map((e) => e.id)).toEqual(["b"]);
  });
});
