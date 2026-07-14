import { describe, expect, it } from "vitest";
import { buildMigrationDryRun } from "./dry-run";
import type { ExistingRecordsSnapshot } from "./types";

const FIXED_TIMESTAMP = "2026-07-10T00:00:00.000Z";
function run(snapshot: Partial<ExistingRecordsSnapshot> = {}) {
  return buildMigrationDryRun({ clientNamesLower: [], projectNamesLower: [], hoursKeys: [], workLogKeys: [], ...snapshot }, { generatedAt: FIXED_TIMESTAMP });
}

describe("corrected Phase 10A dry run", () => {
  it("contains five source pages, five Hours rows, and exactly three Work Done rows", () => {
    const result = run();
    expect(result.sourcePages.map((page) => page.title)).toEqual([
      "Hours Worked", "Work Done", "July 8, 2026", "July 9, 2026", "July 10, 2026",
    ]);
    expect(result.proposedHours).toHaveLength(5);
    expect(result.proposedHours.filter((row) => row.record.billable)).toHaveLength(4);
    expect(result.proposedWorkLogs.map((row) => row.record.date)).toEqual(["2026-07-08", "2026-07-09", "2026-07-10"]);
  });

  it("uses the corrected continuous July 8 afternoon and includes July 10", () => {
    const rows = run().proposedHours.map((row) => row.record);
    expect(rows).toContainEqual(expect.objectContaining({ date: "2026-07-08", startTime: "14:00", endTime: "17:49", expectedAmount: 114.5 }));
    expect(rows).toContainEqual(expect.objectContaining({ date: "2026-07-10", startTime: "08:40", endTime: "14:30", expectedAmount: 175 }));
    expect(rows.some((row) => row.startTime === "14:05" || row.startTime === "17:10")).toBe(false);
  });

  it("reconciles 987 billable minutes, 120 non-billable minutes, 16.45 hours, and $493.50", () => {
    const totals = run().totals;
    expect(totals.totalBillableMinutes).toBe(987);
    expect(totals.totalNonBillableMinutes).toBe(120);
    expect(totals.totalBillableHours).toBe(16.45);
    expect(totals.totalNonBillableHours).toBe(2);
    expect(totals.totalInvoiceAmount).toBe(493.5);
    expect(totals.matchesSourceStated).toBe(true);
    expect(totals.discrepancies).toEqual([]);
  });

  it("derives all five source-evidenced project candidates and reviewed assignments", () => {
    const result = run();
    expect(result.proposedProjects.map((row) => row.record.name).sort()).toEqual([
      "AFP Command Center / Sales & Operations Hub",
      "AFP Invoice Workspace",
      "BOL Review Process V2",
      "Digital Systems Audit & Process Documentation",
      "Power Automate Documentation",
    ].sort());
    expect(Object.fromEntries(result.proposedHours.map((row) => [row.syntheticId, row.record.projectKey]))).toEqual({
      "hrs-2026-07-08-onsite": null,
      "hrs-2026-07-08-morning": "bolReviewV2",
      "hrs-2026-07-08-afternoon": "powerAutomateDocs",
      "hrs-2026-07-09": "bolReviewV2",
      "hrs-2026-07-10": "bolReviewV2",
    });
  });

  it("provides every required Work Done field, visibility flag, evidence, and provenance", () => {
    for (const row of run().proposedWorkLogs) {
      expect(row.record).toMatchObject({ status: "done", clientVisible: true, includeInInvoice: true, includeInWorkReport: true });
      expect(row.record.title).not.toBe("");
      expect(row.record.summary).not.toBe("");
      expect(row.record.detailedWorkDescription).not.toBe("");
      expect(row.record.invoiceDescription).not.toBe("");
      expect(row.record.internalNotes).not.toBe("");
      expect(row.record.evidenceLinks.length).toBeGreaterThan(0);
      expect(row.provenance.length).toBeGreaterThan(0);
    }
  });

  it("detects local duplicates without changing deterministic analytical output", () => {
    const result = run({
      hoursKeys: ["anytime fuel pros|2026-07-10|08:40|14:30"],
      workLogKeys: ["anytime fuel pros|2026-07-10|july 10, 2026 — duplicate prevention and extraction reliability"],
    });
    expect(result.proposedHours.find((row) => row.record.date === "2026-07-10")?.action).toBe("skip-existing");
    expect(result.proposedWorkLogs.find((row) => row.record.date === "2026-07-10")?.action).toBe("skip-existing");
    expect(result.totals.totalInvoiceAmount).toBe(493.5);
  });

  it("is deterministic apart from an explicitly supplied timestamp and self-reports no writes", () => {
    const first = run();
    expect(first).toEqual(run());
    expect(first).toMatchObject({ schemaVersion: 3, generatedAt: FIXED_TIMESTAMP, writesPerformed: false, notionWritesPerformed: false, sqliteWritesPerformed: false });
  });
});
