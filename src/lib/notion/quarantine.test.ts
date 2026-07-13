import { describe, expect, it } from "vitest";
import { isSupersededHours, isSupersededMigrationKey, SUPERSEDED_MIGRATION_KEY_PREFIX, supersededDiagnosticReason } from "@/lib/notion/quarantine";
import { operationalHours } from "@/lib/calculations";
import type { HoursEntry } from "@/types/domain";

describe("quarantine detection", () => {
  it("detects superseded migration key prefix", () => {
    expect(isSupersededMigrationKey(`${SUPERSEDED_MIGRATION_KEY_PREFIX}2026-07-08`)).toBe(true);
    expect(isSupersededMigrationKey("afp-hours-normal-v2")).toBe(false);
  });

  it("detects Billing Status Superseded", () => {
    expect(isSupersededHours({ billingStatus: "superseded" })).toBe(true);
    expect(isSupersededHours({ billingStatus: "ready-to-invoice" })).toBe(false);
  });

  it("labels diagnostics for superseded rows", () => {
    const reason = supersededDiagnosticReason({
      migrationKey: `${SUPERSEDED_MIGRATION_KEY_PREFIX}test`,
    });
    expect(reason).toContain("Superseded historical record");
  });

  it("excludes superseded rows from operational hours totals", () => {
    const rows: HoursEntry[] = [
      {
        id: "1", workspaceId: "w", clientId: "c", projectId: null, date: "2026-07-08",
        startTime: "09:00", endTime: "11:00", breakMinutes: 0, totalHours: 2, hourlyRate: 30,
        billable: true, location: "", relatedWorkLogId: null, notes: "", source: "manual",
        externalId: `${SUPERSEDED_MIGRATION_KEY_PREFIX}x`,
        createdAt: "", updatedAt: "", notionPageId: null, notionDatabaseId: null,
        syncStatus: "synced", lastSyncedAt: null, notionLastEditedTime: null,
      },
      {
        id: "2", workspaceId: "w", clientId: "c", projectId: null, date: "2026-07-08",
        startTime: "11:00", endTime: "13:00", breakMinutes: 0, totalHours: 2, hourlyRate: 30,
        billable: true, location: "", relatedWorkLogId: null, notes: "", source: "manual",
        createdAt: "", updatedAt: "", notionPageId: null, notionDatabaseId: null,
        syncStatus: "synced", lastSyncedAt: null, notionLastEditedTime: null,
      },
    ];
    expect(operationalHours(rows)).toHaveLength(1);
    expect(operationalHours(rows)[0].id).toBe("2");
  });
});
