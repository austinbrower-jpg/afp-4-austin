import { describe, expect, it } from "vitest";
import { buildMigrationDryRun } from "@/lib/notion/migration/dry-run";
import type { ExistingRecordsSnapshot } from "@/lib/notion/migration/types";

const FIXED_TIMESTAMP = "2026-07-10T00:00:00.000Z";

function run(snapshot?: Partial<ExistingRecordsSnapshot>) {
  return buildMigrationDryRun(
    {
      clientNamesLower: [],
      projectNamesLower: [],
      hoursKeys: [],
      workLogKeys: [],
      ...snapshot,
    },
    { generatedAt: FIXED_TIMESTAMP },
  );
}

describe("buildMigrationDryRun - source records / historical session parsing", () => {
  it("reports all four source pages with provenance", () => {
    const result = run();
    expect(result.sourcePages).toHaveLength(4);
    expect(result.sourcePages.map((p) => p.title).sort()).toEqual(
      ["Hours Worked", "July 8, 2026", "July 9, 2026", "Work Done"].sort(),
    );
  });

  it("parses all five historical sessions (1 onsite non-billable + 4 billable)", () => {
    const result = run();
    expect(result.proposedHours).toHaveLength(5);
    expect(result.proposedHours.filter((h) => h.record.billable)).toHaveLength(4);
    expect(result.proposedHours.filter((h) => !h.record.billable)).toHaveLength(1);
  });

  it("parses both dated work logs", () => {
    const result = run();
    expect(result.proposedWorkLogs).toHaveLength(2);
    expect(result.proposedWorkLogs.map((w) => w.record.date)).toEqual(["2026-07-08", "2026-07-09"]);
  });
});

describe("buildMigrationDryRun - proposed client", () => {
  it("derives Anytime Fuel Pros at the stated $30/hr rate and Chicago timezone", () => {
    const result = run();
    expect(result.proposedClient.record).toMatchObject({
      name: "Anytime Fuel Pros",
      status: "active",
      defaultHourlyRate: 30,
      timezone: "America/Chicago",
    });
    expect(result.proposedClient.action).toBe("create");
  });
});

describe("buildMigrationDryRun - approved project assignments (2026-07-10 decision)", () => {
  it("derives exactly the three evidenced projects", () => {
    const result = run();
    const names = result.proposedProjects.map((p) => p.record.name).sort();
    expect(names).toEqual(
      [
        "AFP Command Center / Sales & Operations Hub",
        "BOL Review Process V2",
        "Power Automate Documentation",
      ].sort(),
    );
  });

  it("assigns each session to its explicitly approved project", () => {
    const result = run();
    const byId = Object.fromEntries(result.proposedHours.map((h) => [h.syntheticId, h.record.projectKey]));
    expect(byId).toEqual({
      "hrs-2026-07-08-onsite": null,
      "hrs-2026-07-08-s1": "bolReviewV2",
      "hrs-2026-07-08-s2": "powerAutomateDocs",
      "hrs-2026-07-08-s3": "commandCenter",
      "hrs-2026-07-09-s1": "bolReviewV2",
    });
  });

  it("no longer flags any hours row as unassigned or multi-project ambiguous", () => {
    const result = run();
    for (const h of result.proposedHours) {
      expect(h.warnings).not.toContain("unassigned-project");
      expect(h.warnings).not.toContain("multi-project-session");
      expect(h.warnings).toContain("project-assignments-approved");
    }
  });

  it("keeps the July 9 work log's main project as BOL Review Process V2, preserving related projects", () => {
    const result = run();
    const wl = result.proposedWorkLogs.find((w) => w.syntheticId === "wl-2026-07-09");
    expect(wl?.record.projectKey).toBe("bolReviewV2");
    expect(wl?.record.relatedProjectKeys.sort()).toEqual(["commandCenter", "powerAutomateDocs"].sort());
    expect(wl?.record.relatedProjectsNote).toContain("BOL Review Process V2");
    expect(wl?.record.relatedProjectsNote).toContain("AFP Command Center / Sales & Operations Hub");
    expect(wl?.record.relatedProjectsNote).toContain("Power Automate Documentation");
    expect(wl?.warnings).toContain("worklog-related-projects-preserved");
  });

  it("leaves the July 8 work log's main project unassigned (three distinct approved projects, none specified as main)", () => {
    const result = run();
    const wl = result.proposedWorkLogs.find((w) => w.syntheticId === "wl-2026-07-08");
    expect(wl?.record.projectKey).toBeNull();
    expect(wl?.record.relatedProjectKeys.sort()).toEqual(
      ["bolReviewV2", "powerAutomateDocs", "commandCenter"].sort(),
    );
    expect(wl?.warnings).toContain("worklog-multi-project");
  });
});

describe("buildMigrationDryRun - approved billing convention (2026-07-10 decision)", () => {
  it("stores exact (unrounded) hours as the proposed totalHours for every session", () => {
    const result = run();
    const s2 = result.proposedHours.find((h) => h.syntheticId === "hrs-2026-07-08-s2");
    expect(s2?.record.totalHours).toBeCloseTo(2.9166666667, 8);
    expect(s2?.record.expectedAmount).toBe(87.5);
  });

  it("keeps the app-rounded convention only as a labeled reference, not the proposed value", () => {
    const result = run();
    const s2 = result.proposedHours.find((h) => h.syntheticId === "hrs-2026-07-08-s2");
    expect(s2?.record.referenceAppRoundedHours).toBe(2.92);
    expect(s2?.record.referenceAppRoundedAmount).toBe(87.6);
    expect(s2?.warnings).toContain("billing-convention-approved");
  });

  it("recalculates the total invoice amount as exactly $311.00, matching the source", () => {
    const result = run();
    expect(result.totals.totalInvoiceAmount).toBe(311);
    expect(result.totals.totalBillableHours).toBe(10.37);
    expect(result.totals.matchesSourceStated).toBe(true);
    expect(result.totals.discrepancies).toEqual([]);
  });

  it("reports the rejected app-convention total ($311.10) only as a reference figure", () => {
    const result = run();
    expect(result.totals.referenceAppConventionTotal).toBe(311.1);
    expect(result.totals.totalInvoiceAmount).not.toBe(result.totals.referenceAppConventionTotal);
  });

  it("reports 2.00 non-billable onsite hours at $0", () => {
    const result = run();
    const onsite = result.proposedHours.find((h) => h.syntheticId === "hrs-2026-07-08-onsite");
    expect(onsite?.record.totalHours).toBe(2);
    expect(onsite?.record.expectedAmount).toBe(0);
    expect(result.totals.totalNonBillableHours).toBe(2);
  });

  it("computes correct per-day totals from the exact-minute convention", () => {
    const result = run();
    const day8 = result.totals.perDay.find((d) => d.date === "2026-07-08");
    const day9 = result.totals.perDay.find((d) => d.date === "2026-07-09");
    expect(day8?.billableHours).toBe(5.57);
    expect(day8?.amount).toBe(167);
    expect(day8?.nonBillableHours).toBe(2);
    expect(day9?.billableHours).toBe(4.8);
    expect(day9?.amount).toBe(144);
  });

  it("computes a per-session total for every proposed hours row", () => {
    const result = run();
    expect(result.totals.perSession).toHaveLength(5);
    const s2 = result.totals.perSession.find((s) => s.syntheticId === "hrs-2026-07-08-s2");
    expect(s2?.amount).toBe(87.5);
  });
});

describe("buildMigrationDryRun - warnings", () => {
  it("includes the stale July 9 session-start-header warning", () => {
    const result = run();
    const warning = result.warnings.find((w) => w.code === "stale-session-start-header");
    expect(warning).toBeDefined();
    expect(warning?.relatedIds).toContain("hrs-2026-07-09-s1");
  });

  it("includes the multiple-invoice-ready-blocks warning for July 9 only", () => {
    const result = run();
    const warning = result.warnings.find((w) => w.code === "multiple-invoice-ready-blocks");
    expect(warning?.relatedIds).toEqual(["wl-2026-07-09"]);
  });

  it("includes untracked-time-gap warnings for the two unrecorded gaps", () => {
    const result = run();
    const warning = result.warnings.find((w) => w.code === "untracked-time-gap");
    expect(warning?.relatedIds).toHaveLength(2);
  });

  it("includes the timezone-differs-from-app-default warning", () => {
    const result = run();
    expect(result.warnings.some((w) => w.code === "timezone-differs-from-app-default")).toBe(true);
  });

  it("includes a billing-convention-approved warning scoped to the one affected session", () => {
    const result = run();
    const warning = result.warnings.find((w) => w.code === "billing-convention-approved");
    expect(warning?.relatedIds).toEqual(["hrs-2026-07-08-s2"]);
  });

  it("includes a project-assignments-approved warning covering all five sessions", () => {
    const result = run();
    const warning = result.warnings.find((w) => w.code === "project-assignments-approved");
    expect(warning?.relatedIds).toHaveLength(5);
  });
});

describe("buildMigrationDryRun - duplicate detection", () => {
  it("proposes creating everything when nothing exists locally yet", () => {
    const result = run();
    expect(result.proposedClient.action).toBe("create");
    expect(result.proposedHours.every((h) => h.action === "create")).toBe(true);
    expect(result.skipped).toHaveLength(0);
  });

  it("skips the client when a same-named client already exists locally", () => {
    const result = run({ clientNamesLower: ["anytime fuel pros"] });
    expect(result.proposedClient.action).toBe("skip-existing");
    expect(result.skipped.some((s) => s.type === "client")).toBe(true);
  });

  it("skips only the matching hours row when its exact key already exists locally", () => {
    const result = run({
      hoursKeys: ["anytime fuel pros|2026-07-08|11:00|13:00"],
    });
    const s1 = result.proposedHours.find((h) => h.syntheticId === "hrs-2026-07-08-s1");
    const s2 = result.proposedHours.find((h) => h.syntheticId === "hrs-2026-07-08-s2");
    expect(s1?.action).toBe("skip-existing");
    expect(s2?.action).toBe("create");
    expect(result.skipped.filter((s) => s.type === "hours")).toHaveLength(1);
  });

  it("skips a work log matched by client/date/title", () => {
    const result = run({
      workLogKeys: ["anytime fuel pros|2026-07-09|july 9, 2026"],
    });
    const wl = result.proposedWorkLogs.find((w) => w.syntheticId === "wl-2026-07-09");
    expect(wl?.action).toBe("skip-existing");
  });
});

describe("buildMigrationDryRun - determinism / no writes", () => {
  it("produces identical output for identical input (same generatedAt)", () => {
    const a = run();
    const b = run();
    expect(a).toEqual(b);
  });

  it("always reports writesPerformed as false regardless of duplicate matches", () => {
    const result = run({ clientNamesLower: ["anytime fuel pros"] });
    expect(result.writesPerformed).toBe(false);
    expect(result.notionWritesPerformed).toBe(false);
    expect(result.sqliteWritesPerformed).toBe(false);
  });

  it("stamps schemaVersion 2 and the caller-provided generatedAt", () => {
    const result = run();
    expect(result.schemaVersion).toBe(2);
    expect(result.generatedAt).toBe(FIXED_TIMESTAMP);
  });
});
