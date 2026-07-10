/**
 * Session-level time/rate math for the dry run. Reuses the app's existing
 * calculation utilities (src/lib/calculations.ts) so "app-convention"
 * figures genuinely match what the app would store if this data were
 * entered through the normal Hours flow - rather than reimplementing
 * rounding rules that could quietly drift out of sync.
 */
import { computeAmount, computeTotalHours, minutesBetween } from "@/lib/calculations";

export interface SessionCalculation {
  minutes: number;
  /** Unrounded hours derived directly from elapsed minutes. */
  hoursExact: number;
  /** computeTotalHours() output - hours rounded to hundredths, as the app would store it. */
  hoursAppRounded: number;
  /** Amount computed from the exact (unrounded) hours - matches the source page's own math. */
  amountExact: number;
  /** computeAmount() applied to the rounded hours - what the app's existing pipeline would bill. */
  amountAppConvention: number;
  /** amountAppConvention - amountExact, rounded to cents. Non-zero reveals a rounding-order discrepancy. */
  roundingDiscrepancy: number;
}

export function calculateSession(
  startTime: string,
  endTime: string,
  breakMinutes: number,
  hourlyRate: number,
): SessionCalculation {
  const rawMinutes = minutesBetween(startTime, endTime) - (breakMinutes || 0);
  const minutes = Math.max(0, rawMinutes);
  const hoursExact = minutes / 60;
  const hoursAppRounded = computeTotalHours(startTime, endTime, breakMinutes);
  const amountExact = Math.round(hoursExact * hourlyRate * 100) / 100;
  const amountAppConvention = computeAmount(hoursAppRounded, hourlyRate);

  return {
    minutes,
    hoursExact,
    hoursAppRounded,
    amountExact,
    amountAppConvention,
    roundingDiscrepancy: Math.round((amountAppConvention - amountExact) * 100) / 100,
  };
}

export function roundCents(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function roundHours(hours: number): number {
  return Math.round(hours * 100) / 100;
}
