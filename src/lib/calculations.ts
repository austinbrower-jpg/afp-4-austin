import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  isWithinInterval,
  parseISO,
} from "date-fns";
import type { HoursEntry } from "@/types/domain";
import { isSupersededHours } from "@/lib/notion/quarantine";

/** Hours rows included in operational and billing totals (excludes superseded/quarantine). */
export function operationalHours(entries: HoursEntry[]): HoursEntry[] {
  return entries.filter(
    (entry) => !isSupersededHours({
      migrationKey: entry.externalId,
      externalId: entry.externalId,
      billingStatus: entry.billingStatus,
    }),
  );
}

/** Minutes between two HH:mm times, wrapping past midnight if end < start. */
export function minutesBetween(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  let minutes = eh * 60 + em - (sh * 60 + sm);
  if (minutes < 0) minutes += 24 * 60;
  return minutes;
}

/** Total billable hours for a shift, rounded to the nearest hundredth. */
export function computeTotalHours(
  startTime: string,
  endTime: string,
  breakMinutes: number,
): number {
  const raw = minutesBetween(startTime, endTime) - (breakMinutes || 0);
  return Math.max(0, Math.round((raw / 60) * 100) / 100);
}

export function computeAmount(hours: number, hourlyRate: number): number {
  return Math.round(hours * hourlyRate * 100) / 100;
}

export function formatHours(hours: number): string {
  return `${hours.toFixed(2)}h`;
}

export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

export const WEEK_OPTS = { weekStartsOn: 1 as const }; // Monday

export function getWeekRange(date: Date = new Date()) {
  return {
    start: startOfWeek(date, WEEK_OPTS),
    end: endOfWeek(date, WEEK_OPTS),
  };
}

export function getMonthRange(date: Date = new Date()) {
  return { start: startOfMonth(date), end: endOfMonth(date) };
}

export function sumHours(entries: HoursEntry[]): number {
  return Math.round(operationalHours(entries).reduce((acc, e) => acc + e.totalHours, 0) * 100) / 100;
}

export function sumBillableAmount(entries: HoursEntry[]): number {
  return (
    Math.round(
      operationalHours(entries).reduce(
        (acc, e) => acc + (e.billable ? e.totalHours * e.hourlyRate : 0),
        0,
      ) * 100,
    ) / 100
  );
}

export function entriesInRange(
  entries: HoursEntry[],
  start: Date,
  end: Date,
): HoursEntry[] {
  return operationalHours(entries).filter((e) =>
    isWithinInterval(parseISO(e.date), { start, end }),
  );
}

export function entriesToday(entries: HoursEntry[], date: Date = new Date()): HoursEntry[] {
  const iso = date.toISOString().slice(0, 10);
  return operationalHours(entries).filter((e) => e.date === iso);
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function nowTimeHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
