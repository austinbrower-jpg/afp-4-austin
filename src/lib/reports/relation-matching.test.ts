import { describe, expect, it } from "vitest";
import { matchAllHoursToWork, matchHoursToWork } from "./relation-matching";

const work = [
  { id: "w8", date: "2026-07-08", projectId: "bol", relatedHoursIds: ["h1"], clientVisible: true, includeInInvoice: true, approvalStatus: "approved" },
  { id: "w9", date: "2026-07-09", projectId: "bol", relatedHoursIds: [], clientVisible: true, includeInInvoice: true, approvalStatus: "approved" },
  { id: "w9b", date: "2026-07-09", projectId: "docs", relatedHoursIds: [], clientVisible: true, includeInInvoice: true, approvalStatus: "approved" },
];

describe("relation matching order", () => {
  it("prefers explicit Hours → Related Work Done", () => {
    const result = matchHoursToWork(
      { id: "h1", date: "2026-07-08", projectId: "bol", relatedWorkLogId: "w8", relatedWorkDoneIds: ["w8"] },
      work,
    );
    expect(result[0].source).toBe("explicit");
    expect(result[0].workId).toBe("w8");
  });

  it("uses reciprocal Work Done → Related Hours", () => {
    const result = matchHoursToWork(
      { id: "h1", date: "2026-07-08", projectId: "bol", relatedWorkLogId: null, relatedWorkDoneIds: [] },
      work,
    );
    expect(result[0].source).toBe("reciprocal");
  });

  it("falls back to legacy date + project when unambiguous", () => {
    const result = matchHoursToWork(
      { id: "h2", date: "2026-07-09", projectId: "bol", relatedWorkLogId: null, relatedWorkDoneIds: [] },
      work,
    );
    expect(result[0].source).toBe("legacy-fallback");
    expect(result[0].workId).toBe("w9");
  });

  it("rejects ambiguous legacy fallback", () => {
    const ambiguousWork = [
      { id: "a", date: "2026-07-09", projectId: "bol", relatedHoursIds: [] },
      { id: "b", date: "2026-07-09", projectId: "bol", relatedHoursIds: [] },
    ];
    const result = matchHoursToWork(
      { id: "hx", date: "2026-07-09", projectId: "bol", relatedWorkLogId: null },
      ambiguousWork,
    );
    expect(result.every((m) => m.source === "ambiguous")).toBe(true);
  });

  it("rejects date-only when multiple candidates exist", () => {
    const result = matchHoursToWork(
      { id: "hx", date: "2026-07-09", projectId: null, relatedWorkLogId: null },
      work,
    );
    expect(result[0].source).toBe("ambiguous");
    expect(result[0].reason).toContain("Date-only fallback rejected");
  });

  it("matchAllHoursToWork labels every match", () => {
    const hours = [
      { id: "h1", date: "2026-07-08", projectId: "bol", relatedWorkLogId: "w8" },
      { id: "h2", date: "2026-07-09", projectId: "bol", relatedWorkLogId: null },
    ];
    const all = matchAllHoursToWork(hours, work);
    expect(all.matches.length).toBeGreaterThan(0);
    expect(all.byHours.get("h1")?.source).toBe("explicit");
  });
});
