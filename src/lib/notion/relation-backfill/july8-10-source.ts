/**
 * Corrected July 8–10, 2026 operational dataset for relation backfill preview.
 * Read-only source — no Notion writes.
 */

import { SUPERSEDED_MIGRATION_KEY_PREFIX } from "@/lib/notion/quarantine";

export const JULY8_10_CLIENT = "Anytime Fuel Pros";
export const JULY8_10_HOURLY_RATE = 30;

/** Authoritative operational totals (excluding quarantine row). */
export const JULY8_10_OPERATIONAL_TOTALS = {
  billableMinutes: 987,
  nonBillableMinutes: 120,
  billableHours: 16.45,
  operationalHours: 18.45,
  amount: 493.5,
} as const;

export interface July810HoursRow {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  billable: boolean;
  projectKey: "bolReviewV2" | "powerAutomateDocs" | null;
  projectName: string | null;
  migrationKey: string | null;
  superseded: boolean;
  notes: string;
}

export interface July810WorkRow {
  id: string;
  date: string;
  title: string;
  projectKey: "bolReviewV2" | null;
  relatedHoursIds: string[];
}

export const JULY8_10_PROJECTS = {
  bolReviewV2: { key: "bolReviewV2" as const, name: "BOL Review Process V2" },
  powerAutomateDocs: { key: "powerAutomateDocs" as const, name: "Power Automate Documentation" },
} as const;

export const JULY8_10_HOURS: July810HoursRow[] = [
  {
    id: "hrs-jul8-onsite",
    date: "2026-07-08",
    startTime: "09:00",
    endTime: "11:00",
    billable: false,
    projectKey: null,
    projectName: null,
    migrationKey: "afp-hours-2026-07-08-0900-1100-nonbillable-v2",
    superseded: false,
    notes: "Onsite time before active billable work began.",
  },
  {
    id: "hrs-jul8-bol",
    date: "2026-07-08",
    startTime: "11:00",
    endTime: "13:00",
    billable: true,
    projectKey: "bolReviewV2",
    projectName: JULY8_10_PROJECTS.bolReviewV2.name,
    migrationKey: "afp-hours-2026-07-08-1100-1300-billable-bolReviewV2-v2",
    superseded: false,
    notes: "BOL Review Process V2 billable block.",
  },
  {
    id: "hrs-jul8-padocs",
    date: "2026-07-08",
    startTime: "14:00",
    endTime: "17:49",
    billable: true,
    projectKey: "powerAutomateDocs",
    projectName: JULY8_10_PROJECTS.powerAutomateDocs.name,
    migrationKey: "afp-hours-2026-07-08-1400-1749-billable-powerAutomateDocs-v2",
    superseded: false,
    notes: "Power Automate Documentation — merged operational session.",
  },
  {
    id: "hrs-jul8-quarantine",
    date: "2026-07-08",
    startTime: "17:10",
    endTime: "17:49",
    billable: true,
    projectKey: "bolReviewV2",
    projectName: JULY8_10_PROJECTS.bolReviewV2.name,
    migrationKey: `${SUPERSEDED_MIGRATION_KEY_PREFIX}2026-07-08-1710-1749`,
    superseded: true,
    notes: "Audit/quarantine row — excluded from operational totals.",
  },
  {
    id: "hrs-jul9-bol",
    date: "2026-07-09",
    startTime: "09:12",
    endTime: "14:00",
    billable: true,
    projectKey: "bolReviewV2",
    projectName: JULY8_10_PROJECTS.bolReviewV2.name,
    migrationKey: "afp-hours-2026-07-09-0912-1400-billable-bolReviewV2-v2",
    superseded: false,
    notes: "BOL Review Process V2 full-day session.",
  },
  {
    id: "hrs-jul10-bol",
    date: "2026-07-10",
    startTime: "08:40",
    endTime: "14:30",
    billable: true,
    projectKey: "bolReviewV2",
    projectName: JULY8_10_PROJECTS.bolReviewV2.name,
    migrationKey: "afp-hours-2026-07-10-0840-1430-billable-bolReviewV2-v2",
    superseded: false,
    notes: "BOL Review Process V2 continued work.",
  },
];

export const JULY8_10_WORK_DONE: July810WorkRow[] = [
  {
    id: "wl-jul8",
    date: "2026-07-08",
    title: "July 8, 2026",
    projectKey: null,
    relatedHoursIds: ["hrs-jul8-onsite", "hrs-jul8-bol", "hrs-jul8-padocs"],
  },
  {
    id: "wl-jul9",
    date: "2026-07-09",
    title: "July 9, 2026",
    projectKey: "bolReviewV2",
    relatedHoursIds: ["hrs-jul9-bol"],
  },
  {
    id: "wl-jul10",
    date: "2026-07-10",
    title: "July 10, 2026",
    projectKey: "bolReviewV2",
    relatedHoursIds: ["hrs-jul10-bol"],
  },
];

export function operationalHoursRows(): July810HoursRow[] {
  return JULY8_10_HOURS.filter((row) => !row.superseded);
}

export function quarantineHoursRows(): July810HoursRow[] {
  return JULY8_10_HOURS.filter((row) => row.superseded);
}
