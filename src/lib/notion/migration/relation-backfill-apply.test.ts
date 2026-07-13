import { describe, expect, it } from "vitest";
import {
  APPROVED_BILLING_STATUS,
  APPROVED_PROJECT_CLIENT_NAMES,
  buildWritePlan,
  type MappedLiveRows,
} from "./relation-backfill-apply";
import { JULY8_10_HOURS, JULY8_10_WORK_DONE } from "../relation-backfill/july8-10-source";
import { assignSessionIdsForBackfill } from "../identity/session-id";
import { assignWorkLogIdsForBackfill } from "../identity/work-log-id";

function emptyMapped(overrides: Partial<MappedLiveRows> = {}): MappedLiveRows {
  const sessionIds = assignSessionIdsForBackfill(
    JULY8_10_HOURS.map((h) => ({ id: h.id, date: h.date, startTime: h.startTime, migrationKey: h.migrationKey })),
  );
  const workLogIds = assignWorkLogIdsForBackfill(JULY8_10_WORK_DONE);
  const hoursBySourceId = new Map(
    JULY8_10_HOURS.map((h) => [
      h.id,
      {
        id: `live-${h.id}`,
        entity: "hours" as const,
        date: h.date,
        startTime: h.startTime,
        endTime: h.endTime,
        migrationKey: h.migrationKey,
        billable: h.billable,
        projectName: h.projectName,
      },
    ]),
  );
  const workBySourceId = new Map(
    JULY8_10_WORK_DONE.map((w) => [
      w.id,
      {
        id: `live-${w.id}`,
        entity: "work-done" as const,
        date: w.date,
        title: w.title,
      },
    ]),
  );
  const projectsByName = new Map(
    APPROVED_PROJECT_CLIENT_NAMES.map((name) => [
      name,
      { id: `proj-${name}`, name, clientIds: [] as string[] },
    ]),
  );
  return {
    hoursBySourceId,
    workBySourceId,
    client: { id: "client-atfp", name: "Anytime Fuel Pros" },
    projectsByName,
    sessionIds,
    workLogIds,
    ...overrides,
  };
}

describe("relation backfill apply plan", () => {
  it("assigns approved session and work log IDs", () => {
    const mapped = emptyMapped();
    expect(mapped.sessionIds.get("hrs-jul8-onsite")).toBe("AFP-2026-07-08-001");
    expect(mapped.sessionIds.get("hrs-jul8-quarantine")).toBe("AFP-2026-07-08-004");
    expect(mapped.workLogIds.get("wl-jul8")).toBe("AFP-WORK-2026-07-08-001");
  });

  it("uses Reviewed billing status for non-billable onsite row", () => {
    expect(APPROVED_BILLING_STATUS["hrs-jul8-onsite"]).toBe("Reviewed");
    expect(APPROVED_BILLING_STATUS["hrs-jul8-bol"]).toBe("Ready to Invoice");
  });

  it("builds apply plan in approved phase order", () => {
    const plan = buildWritePlan(emptyMapped());
    const phases = [...new Set(plan.map((p) => p.phase))];
    expect(phases).toEqual([
      "1-projects-client",
      "2-hours-session-id",
      "2-hours-client",
      "2-hours-billing-status",
      "3-work-work-log-id",
      "3-work-client",
      "3-work-approval-status",
      "4-hours-related-work-done",
      "5-work-related-hours",
    ]);
    expect(plan.filter((p) => !p.skip).length).toBeGreaterThan(0);
  });

  it("skips quarantine row for related work done", () => {
    const plan = buildWritePlan(emptyMapped());
    const quarantineRelation = plan.find(
      (p) => p.phase === "4-hours-related-work-done" && p.label.includes("17:10"),
    );
    expect(quarantineRelation).toBeUndefined();
  });

  it("is idempotent when values already present", () => {
    const mapped = emptyMapped();
    for (const [sourceId, live] of mapped.hoursBySourceId) {
      live.sessionId = mapped.sessionIds.get(sourceId) ?? null;
      live.clientId = mapped.client.id;
      live.billingStatus = APPROVED_BILLING_STATUS[sourceId];
    }
    const plan = buildWritePlan(mapped);
    expect(plan.filter((p) => p.phase.startsWith("2-hours") && !p.skip).length).toBe(0);
  });
});
