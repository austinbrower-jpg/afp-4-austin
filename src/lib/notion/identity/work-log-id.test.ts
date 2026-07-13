import { describe, expect, it } from "vitest";
import {
  assignWorkLogIdsForBackfill,
  formatWorkLogId,
  generateWorkLogId,
  parseWorkLogId,
} from "./work-log-id";

describe("Work Log ID generation", () => {
  it("formats AFP-WORK-YYYY-MM-DD-###", () => {
    expect(formatWorkLogId("2026-07-08", 1)).toBe("AFP-WORK-2026-07-08-001");
  });

  it("parses valid Work Log IDs", () => {
    expect(parseWorkLogId("AFP-WORK-2026-07-09-002")).toEqual({ date: "2026-07-09", sequence: 2 });
  });

  it("assigns one ID per date in title order", () => {
    const assigned = assignWorkLogIdsForBackfill([
      { id: "wl2", date: "2026-07-09", title: "July 9, 2026" },
      { id: "wl1", date: "2026-07-08", title: "July 8, 2026" },
    ]);
    expect(assigned.get("wl1")).toBe("AFP-WORK-2026-07-08-001");
    expect(assigned.get("wl2")).toBe("AFP-WORK-2026-07-09-001");
  });

  it("prevents duplicate Work Log IDs on the same date", () => {
    const a = generateWorkLogId({ date: "2026-07-10", existingOnDate: [] });
    const b = generateWorkLogId({ date: "2026-07-10", existingOnDate: [a] });
    expect(a).not.toBe(b);
  });
});
