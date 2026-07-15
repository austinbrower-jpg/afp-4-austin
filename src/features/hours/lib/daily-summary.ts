import { isValid, parseISO } from "date-fns";
import { exactElapsedMinutes } from "@/lib/reports/engine";
import { isSupersededHours } from "@/lib/notion/quarantine";
import type { HoursEntryWithRelations } from "./types";

export interface HoursDaySummary {
  date: string;
  totalHours: number;
  entryCount: number;
  projectCount: number;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isLocalDate(value: unknown): value is string {
  return typeof value === "string" && ISO_DATE.test(value) && isValid(parseISO(value));
}

export function aggregateHoursByDay(entries: readonly HoursEntryWithRelations[]): HoursDaySummary[] {
  const seen = new Set<string>();
  const groups = new Map<string, { hours: number; entries: number; projects: Set<string> }>();

  for (const entry of entries) {
    if (!entry || typeof entry.id !== "string" || !entry.id || seen.has(entry.id)) continue;
    if (
      !isLocalDate(entry.date) ||
      typeof entry.startTime !== "string" ||
      typeof entry.endTime !== "string" ||
      !Number.isFinite(entry.breakMinutes)
    ) continue;
    seen.add(entry.id);
    if (
      entry.superseded ||
      isSupersededHours({
        migrationKey: entry.externalId,
        externalId: entry.externalId,
        billingStatus: entry.billingStatus,
      })
    ) continue;

    const exactMinutes = exactElapsedMinutes(entry.startTime, entry.endTime, entry.breakMinutes);
    const hours = Number.isFinite(entry.totalHours) && entry.totalHours > 0
      ? entry.totalHours
      : exactMinutes / 60;
    if (hours <= 0) continue;
    const group = groups.get(entry.date) ?? { hours: 0, entries: 0, projects: new Set<string>() };
    group.hours += hours;
    group.entries += 1;
    if (entry.projectId) group.projects.add(entry.projectId);
    groups.set(entry.date, group);
  }

  return [...groups.entries()]
    .map(([date, group]) => ({
      date,
      totalHours: Math.round(group.hours * 100) / 100,
      entryCount: group.entries,
      projectCount: group.projects.size,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}
