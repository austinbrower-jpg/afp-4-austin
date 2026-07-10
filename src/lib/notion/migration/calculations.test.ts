import { describe, expect, it } from "vitest";
import { calculateSession, roundCents, roundHours } from "@/lib/notion/migration/calculations";

describe("calculateSession - time calculation", () => {
  it("computes exact hours for a clean session (2 hours, no rounding needed)", () => {
    const s = calculateSession("11:00", "13:00", 0, 30);
    expect(s.minutes).toBe(120);
    expect(s.hoursExact).toBeCloseTo(2, 10);
    expect(s.hoursAppRounded).toBe(2);
  });

  it("subtracts break minutes before computing hours", () => {
    const s = calculateSession("09:00", "12:00", 30, 30);
    expect(s.minutes).toBe(150);
    expect(s.hoursExact).toBeCloseTo(2.5, 10);
  });

  it("wraps past midnight, matching minutesBetween's existing behavior", () => {
    const s = calculateSession("23:00", "01:00", 0, 30);
    expect(s.minutes).toBe(120);
    expect(s.hoursExact).toBeCloseTo(2, 10);
    expect(s.amountExact).toBe(60);
  });
});

describe("calculateSession - ambiguous/missing time handling", () => {
  it("returns zero hours and zero amount for identical start/end (no duration stated)", () => {
    const s = calculateSession("09:00", "09:00", 0, 30);
    expect(s.minutes).toBe(0);
    expect(s.hoursExact).toBe(0);
    expect(s.amountExact).toBe(0);
    expect(s.amountAppConvention).toBe(0);
  });

  it("never returns negative minutes/hours when a break exceeds the raw span", () => {
    const s = calculateSession("09:00", "09:15", 60, 30);
    expect(s.minutes).toBe(0);
    expect(s.hoursExact).toBe(0);
  });
});

describe("calculateSession - rate calculation", () => {
  it("multiplies exact hours by the hourly rate", () => {
    const s = calculateSession("09:00", "17:00", 0, 30);
    expect(s.amountExact).toBe(240);
  });

  it("scales linearly with a different rate", () => {
    const s = calculateSession("09:00", "17:00", 0, 65);
    expect(s.amountExact).toBe(520);
  });
});

describe("calculateSession - rounding behavior / discrepancy detection", () => {
  it("finds no discrepancy when elapsed minutes land on a clean hundredth of an hour", () => {
    const s = calculateSession("11:00", "13:00", 0, 30); // 120 min = 2.00h exactly
    expect(s.roundingDiscrepancy).toBe(0);
  });

  it("flags a rounding discrepancy for the real July 8 2:05-5:00 PM session (175 min)", () => {
    // 175 min = 2.91666...7h exactly -> $87.50, but computeTotalHours rounds
    // to 2.92h first -> 2.92 * 30 = $87.60. This is a real, reportable gap
    // between the app's existing calculation convention and the source
    // Notion page's own exact-minute math.
    const s = calculateSession("14:05", "17:00", 0, 30);
    expect(s.minutes).toBe(175);
    expect(s.hoursExact).toBeCloseTo(2.9166666667, 8);
    expect(s.hoursAppRounded).toBe(2.92);
    expect(s.amountExact).toBe(87.5);
    expect(s.amountAppConvention).toBe(87.6);
    expect(s.roundingDiscrepancy).toBe(0.1);
  });

  it("flags no discrepancy for a 39-minute session (39 min = 0.65h exactly)", () => {
    const s = calculateSession("17:10", "17:49", 0, 30);
    expect(s.hoursAppRounded).toBe(0.65);
    expect(s.roundingDiscrepancy).toBe(0);
  });

  it("flags no discrepancy for a 288-minute session (288 min = 4.80h exactly)", () => {
    const s = calculateSession("09:12", "14:00", 0, 30);
    expect(s.hoursAppRounded).toBe(4.8);
    expect(s.roundingDiscrepancy).toBe(0);
  });
});

describe("roundHours / roundCents", () => {
  it("rounds hours to the nearest hundredth", () => {
    expect(roundHours(2.91666667)).toBe(2.92);
  });

  it("rounds currency to the nearest cent", () => {
    expect(roundCents(87.504)).toBe(87.5);
    expect(roundCents(87.516)).toBe(87.52);
  });
});
