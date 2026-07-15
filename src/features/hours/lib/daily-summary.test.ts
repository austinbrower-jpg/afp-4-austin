/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest";
import { aggregateHoursByDay } from "./daily-summary";
import type { HoursEntryWithRelations } from "./types";

function entry(
  id: string,
  date: string,
  startTime: string,
  endTime: string,
  overrides: Partial<HoursEntryWithRelations> = {},
): HoursEntryWithRelations {
  return {
    id,
    workspaceId: "ws",
    clientId: "client",
    projectId: "project",
    date,
    startTime,
    endTime,
    breakMinutes: 0,
    totalHours: 0,
    hourlyRate: 30,
    billable: true,
    location: "Remote",
    relatedWorkLogId: null,
    notes: "",
    source: "manual",
    notionPageId: null,
    notionDatabaseId: null,
    syncStatus: "synced",
    lastSyncedAt: null,
    notionLastEditedTime: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    projectName: "Project",
    workLogTitle: null,
    ...overrides,
  };
}

describe("aggregateHoursByDay", () => {
  it("sums same-day entries, keeps days separate, and sorts newest first", () => {
    const result = aggregateHoursByDay([
      entry("one", "2026-07-10", "09:00", "11:00"),
      entry("two", "2026-07-10", "13:00", "14:15"),
      entry("three", "2026-07-12", "08:00", "09:30"),
    ]);

    expect(result.map((day) => day.date)).toEqual(["2026-07-12", "2026-07-10"]);
    expect(result[1]).toMatchObject({ totalHours: 3.25, entryCount: 2, projectCount: 1 });
  });

  it("attributes a cross-midnight entry to its source local calendar date", () => {
    expect(aggregateHoursByDay([entry("overnight", "2026-07-11", "23:30", "01:00")]))
      .toEqual([{ date: "2026-07-11", totalHours: 1.5, entryCount: 1, projectCount: 1 }]);
  });

  it("uses the source total for valid native rows with localized display times", () => {
    expect(aggregateHoursByDay([
      entry("localized", "2026-07-14", "4:02 PM", "7:45 PM", { totalHours: 3.72 }),
    ])).toEqual([{ date: "2026-07-14", totalHours: 3.72, entryCount: 1, projectCount: 1 }]);
  });

  it("does not double-count duplicate ids", () => {
    const duplicate = entry("same", "2026-07-10", "09:00", "10:00");
    expect(aggregateHoursByDay([duplicate, { ...duplicate }])[0].totalHours).toBe(1);
  });

  it("returns an empty result for empty data", () => {
    expect(aggregateHoursByDay([])).toEqual([]);
  });

  it("ignores invalid and superseded records safely", () => {
    const invalid = entry("invalid", "not-a-date", "bad", "10:00") as any;
    const superseded = entry("superseded", "2026-07-10", "09:00", "10:00", {
      billingStatus: "superseded",
    });
    expect(aggregateHoursByDay([invalid, superseded])).toEqual([]);
  });
});
