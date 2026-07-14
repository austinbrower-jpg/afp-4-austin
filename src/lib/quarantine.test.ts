import { describe, expect, it } from "vitest";
import { sumBillableAmount, sumHours } from "@/lib/calculations";
import {
  isSupersededMigrationKey,
  QUARANTINE_BADGE_LABEL,
  QUARANTINE_DIAGNOSTIC_REASON,
} from "./quarantine";
import type { HoursEntry } from "@/types/domain";

function entry(overrides: Partial<HoursEntry> = {}): HoursEntry {
  return {
    id: "hrs_1",
    workspaceId: "ws_1",
    clientId: "cli_1",
    projectId: "proj_1",
    date: "2026-07-08",
    startTime: "17:10",
    endTime: "17:49",
    breakMinutes: 0,
    totalHours: 39 / 60,
    hourlyRate: 30,
    billable: true,
    location: "Office / onsite",
    relatedWorkLogId: null,
    notes: "Original audit note",
    source: "manual",
    externalId: null,
    notionPageId: null,
    notionDatabaseId: null,
    syncStatus: "local-only",
    lastSyncedAt: null,
    notionLastEditedTime: null,
    createdAt: "2026-07-08T00:00:00.000Z",
    updatedAt: "2026-07-08T00:00:00.000Z",
    ...overrides,
  };
}

describe("quarantine helpers", () => {
  it("detects superseded migration keys by prefix only", () => {
    expect(isSupersededMigrationKey("afp-history-v2-superseded-hours-2026-07-08-1710-1749")).toBe(true);
    expect(isSupersededMigrationKey("afp-history-v2-hours-2026-07-08-1710-1749")).toBe(false);
    expect(isSupersededMigrationKey(null)).toBe(false);
  });

  it("keeps superseded rows readable but excludes them from operational totals", () => {
    const superseded = entry({
      externalId: "afp-history-v2-superseded-hours-2026-07-08-1710-1749",
      notes: "SUPERSEDED BY MERGED 2026-07-08 14:00–17:49 RECORD — DO NOT BILL",
    });
    const operational = entry({
      id: "hrs_2",
      startTime: "11:00",
      endTime: "13:00",
      totalHours: 2,
      externalId: "afp-history-v2-hours-2026-07-08-1100-1300-billable-bol-review-process-v2-v2",
    });

    expect(superseded.startTime).toBe("17:10");
    expect(superseded.endTime).toBe("17:49");
    expect(superseded.notes).toContain("SUPERSEDED");
    expect(isSupersededMigrationKey(superseded.externalId)).toBe(true);
    expect(QUARANTINE_BADGE_LABEL).toBe("Superseded / Do Not Bill");
    expect(QUARANTINE_DIAGNOSTIC_REASON).toBe("Excluded because it is superseded");

    expect(sumHours([superseded, operational])).toBe(2);
    expect(sumBillableAmount([superseded, operational])).toBe(60);
  });
});
