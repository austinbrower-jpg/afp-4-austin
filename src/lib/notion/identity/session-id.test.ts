import { describe, expect, it } from "vitest";
import {
  assignSessionIdsForBackfill,
  formatSessionId,
  generateSessionId,
  nextSessionSequence,
  parseSessionId,
} from "./session-id";

describe("Session ID generation", () => {
  it("formats AFP-YYYY-MM-DD-###", () => {
    expect(formatSessionId("2026-07-08", 1)).toBe("AFP-2026-07-08-001");
    expect(formatSessionId("2026-07-10", 12)).toBe("AFP-2026-07-10-012");
  });

  it("parses valid Session IDs", () => {
    expect(parseSessionId("AFP-2026-07-08-003")).toEqual({ date: "2026-07-08", sequence: 3 });
    expect(parseSessionId("invalid")).toBeNull();
  });

  it("assigns deterministic sequences sorted by start time", () => {
    const assigned = assignSessionIdsForBackfill([
      { id: "b", date: "2026-07-08", startTime: "14:00", migrationKey: null },
      { id: "a", date: "2026-07-08", startTime: "09:00", migrationKey: null },
      { id: "c", date: "2026-07-08", startTime: "11:00", migrationKey: null },
    ]);
    expect(assigned.get("a")).toBe("AFP-2026-07-08-001");
    expect(assigned.get("c")).toBe("AFP-2026-07-08-002");
    expect(assigned.get("b")).toBe("AFP-2026-07-08-003");
  });

  it("prevents collisions on the same date", () => {
    const first = generateSessionId({ date: "2026-07-09", existingOnDate: [] });
    const second = generateSessionId({ date: "2026-07-09", existingOnDate: [first] });
    expect(first).not.toBe(second);
    expect(nextSessionSequence("2026-07-09", [first])).toBe(2);
  });

  it("preserves migration keys independently of Session ID", () => {
    const sessionId = generateSessionId({ date: "2026-07-08", sequence: 1 });
    const migrationKey = "afp-hours-legacy-v1";
    expect(sessionId).toBe("AFP-2026-07-08-001");
    expect(migrationKey).not.toContain("AFP-2026-07-08");
  });
});
