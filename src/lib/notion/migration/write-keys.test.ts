import { describe, expect, it } from "vitest";
import {
  clientMigrationKey,
  hoursMigrationKey,
  projectMigrationKey,
  workLogMigrationKey,
} from "@/lib/notion/migration/write-keys";

describe("write-keys - stable migration keys", () => {
  it("computes the exact literal keys for the five approved historical sessions", () => {
    expect(
      hoursMigrationKey({ date: "2026-07-08", startTime: "09:00", endTime: "11:00", billable: false, projectKey: null }),
    ).toBe("afp-hours-2026-07-08-0900-1100-nonbillable-none-v1");
    expect(
      hoursMigrationKey({ date: "2026-07-08", startTime: "11:00", endTime: "13:00", billable: true, projectKey: "bolReviewV2" }),
    ).toBe("afp-hours-2026-07-08-1100-1300-billable-bolReviewV2-v1");
    expect(
      hoursMigrationKey({ date: "2026-07-08", startTime: "14:05", endTime: "17:00", billable: true, projectKey: "powerAutomateDocs" }),
    ).toBe("afp-hours-2026-07-08-1405-1700-billable-powerAutomateDocs-v1");
    expect(
      hoursMigrationKey({ date: "2026-07-08", startTime: "17:10", endTime: "17:49", billable: true, projectKey: "commandCenter" }),
    ).toBe("afp-hours-2026-07-08-1710-1749-billable-commandCenter-v1");
    expect(
      hoursMigrationKey({ date: "2026-07-09", startTime: "09:12", endTime: "14:00", billable: true, projectKey: "bolReviewV2" }),
    ).toBe("afp-hours-2026-07-09-0912-1400-billable-bolReviewV2-v1");
  });

  it("computes the exact literal keys for the two approved historical work logs", () => {
    expect(workLogMigrationKey({ date: "2026-07-08", title: "July 8, 2026" })).toBe(
      "afp-worklog-2026-07-08-july-8-2026-v1",
    );
    expect(workLogMigrationKey({ date: "2026-07-09", title: "July 9, 2026" })).toBe(
      "afp-worklog-2026-07-09-july-9-2026-v1",
    );
  });

  it("computes the exact literal keys for the client and three projects", () => {
    expect(clientMigrationKey()).toBe("afp-client-v1");
    expect(projectMigrationKey("bolReviewV2")).toBe("afp-project-bol-review-process-v2-v1");
    expect(projectMigrationKey("commandCenter")).toBe("afp-project-command-center-sales-ops-hub-v1");
    expect(projectMigrationKey("powerAutomateDocs")).toBe("afp-project-power-automate-documentation-v1");
  });

  it("is deterministic - repeated calls with the same input return the same key", () => {
    const input = { date: "2026-07-08", startTime: "11:00", endTime: "13:00", billable: true, projectKey: "bolReviewV2" as const };
    expect(hoursMigrationKey(input)).toBe(hoursMigrationKey(input));
    expect(clientMigrationKey()).toBe(clientMigrationKey());
  });

  it("produces distinct keys for sessions that differ only by project", () => {
    const base = { date: "2026-07-08", startTime: "09:00", endTime: "10:00", billable: true };
    const a = hoursMigrationKey({ ...base, projectKey: "bolReviewV2" });
    const b = hoursMigrationKey({ ...base, projectKey: "commandCenter" });
    expect(a).not.toBe(b);
  });

  it("produces distinct keys for sessions that differ only by billable status", () => {
    const base = { date: "2026-07-08", startTime: "09:00", endTime: "10:00", projectKey: null };
    const a = hoursMigrationKey({ ...base, billable: true });
    const b = hoursMigrationKey({ ...base, billable: false });
    expect(a).not.toBe(b);
  });

  it("slugifies work log titles safely (no spaces, no commas)", () => {
    const key = workLogMigrationKey({ date: "2026-07-08", title: "July 8, 2026" });
    expect(key).not.toMatch(/[\s,]/);
  });
});
