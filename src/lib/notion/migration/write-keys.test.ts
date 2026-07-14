import { describe, expect, it } from "vitest";
import {
  MIGRATION_NAMESPACE,
  clientMigrationKey,
  hoursMigrationKey,
  projectMigrationKey,
  workLogMigrationKey,
} from "./write-keys";

describe("corrected v2 migration keys", () => {
  it("uses a distinct afp-history-v2 namespace for every entity", () => {
    const keys = [
      clientMigrationKey(),
      projectMigrationKey("bolReviewV2"),
      projectMigrationKey("invoiceWorkspace"),
      projectMigrationKey("digitalSystemsAudit"),
      hoursMigrationKey({ date: "2026-07-10", startTime: "08:40", endTime: "14:30", billable: true, projectKey: "bolReviewV2" }),
      workLogMigrationKey({ date: "2026-07-10", title: "July 10, 2026 — Duplicate prevention" }),
    ];
    expect(MIGRATION_NAMESPACE).toBe("afp-history-v2");
    expect(keys.every((key) => key.startsWith("afp-history-v2-"))).toBe(true);
    expect(keys.every((key) => !key.endsWith("-v1"))).toBe(true);
  });

  it("keys the corrected continuous July 8 afternoon row, never either stale split", () => {
    expect(hoursMigrationKey({ date: "2026-07-08", startTime: "14:00", endTime: "17:49", billable: true, projectKey: "powerAutomateDocs" }))
      .toBe("afp-history-v2-hours-2026-07-08-1400-1749-billable-powerAutomateDocs");
  });

  it("is deterministic and distinguishes billable/project changes", () => {
    const base = { date: "2026-07-08", startTime: "11:00", endTime: "13:00" };
    const a = hoursMigrationKey({ ...base, billable: true, projectKey: "bolReviewV2" });
    expect(a).toBe(hoursMigrationKey({ ...base, billable: true, projectKey: "bolReviewV2" }));
    expect(a).not.toBe(hoursMigrationKey({ ...base, billable: false, projectKey: "bolReviewV2" }));
    expect(a).not.toBe(hoursMigrationKey({ ...base, billable: true, projectKey: "commandCenter" }));
  });
});
