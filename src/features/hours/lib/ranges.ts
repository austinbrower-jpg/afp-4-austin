import { format, subDays } from "date-fns";
import { getMonthRange, getWeekRange } from "@/lib/calculations";
import type { HoursEntryWithRelations } from "./types";

/**
 * Table scoping control. "This Week" and "This Month" are Mon-Sun /
 * calendar-month windows (matching getWeekRange/getMonthRange), "Last 30
 * Days" is a rolling window, and "All Time" removes the date filter
 * entirely (the API just returns every entry for the client).
 */
export type HoursRangeKey = "this-week" | "this-month" | "last-30" | "all";

export const RANGE_OPTIONS: { value: HoursRangeKey; label: string }[] = [
  { value: "this-week", label: "This Week" },
  { value: "this-month", label: "This Month" },
  { value: "last-30", label: "Last 30 Days" },
  { value: "all", label: "All Time" },
];

const ISO = "yyyy-MM-dd";

export function resolveRange(key: HoursRangeKey, today: Date = new Date()): { start?: string; end?: string } {
  switch (key) {
    case "this-week": {
      const { start, end } = getWeekRange(today);
      return { start: format(start, ISO), end: format(end, ISO) };
    }
    case "this-month": {
      const { start, end } = getMonthRange(today);
      return { start: format(start, ISO), end: format(end, ISO) };
    }
    case "last-30":
      return { start: format(subDays(today, 29), ISO), end: format(today, ISO) };
    case "all":
    default:
      return {};
  }
}

export function entriesForRange(
  entries: readonly HoursEntryWithRelations[],
  key: HoursRangeKey,
  today: Date = new Date(),
): HoursEntryWithRelations[] {
  const { start, end } = resolveRange(key, today);
  if (!start || !end) return [...entries];
  return entries.filter((entry) => entry.date >= start && entry.date <= end);
}
