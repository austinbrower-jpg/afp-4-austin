import type { ReportDataset, ReportWorkRecord } from "@/lib/reports/types";
import {
  JULY8_10_CLIENT,
  JULY8_10_HOURS,
  JULY8_10_HOURLY_RATE,
  JULY8_10_PROJECTS,
  JULY8_10_WORK_DONE,
} from "./july8-10-source";

const JULY810_CLIENT_ID = "july810-anytime-fuel-pros";
const JULY810_PROJECT_IDS = {
  bolReviewV2: "july810-bol-review-v2",
  powerAutomateDocs: "july810-power-automate-docs",
} as const;

/** Pure July 8–10 report dataset for previews and tests (no server-only). */
export function buildJuly810ReportDataset(): ReportDataset {
  const workRecords: ReportWorkRecord[] = JULY8_10_WORK_DONE.map((work) => ({
    id: work.id,
    clientId: JULY810_CLIENT_ID,
    projectId: work.projectKey ? JULY810_PROJECT_IDS[work.projectKey] : null,
    date: work.date,
    title: work.title,
    summary: `${work.title} professional services.`,
    detailedWorkDescription: `Client-visible work performed on ${work.title}.`,
    internalNotes: "",
    status: "done",
    clientVisible: true,
    includeInInvoice: true,
    includeInWorkReport: true,
    evidenceLinks: [],
    relatedHoursIds: [...work.relatedHoursIds],
    deliverables: [],
    testingPerformed: [],
    blockers: [],
    followUpItems: [],
    approvalStatus: "approved",
  }));

  return {
    source: "july-8-10-corrected",
    label: "July 8–10 corrected dataset",
    description: "Corrected operational July 8–10, 2026 preview with quarantine row excluded from totals.",
    clients: [{ id: JULY810_CLIENT_ID, name: JULY8_10_CLIENT, defaultHourlyRate: JULY8_10_HOURLY_RATE }],
    projects: [
      { id: JULY810_PROJECT_IDS.bolReviewV2, clientId: JULY810_CLIENT_ID, name: JULY8_10_PROJECTS.bolReviewV2.name },
      { id: JULY810_PROJECT_IDS.powerAutomateDocs, clientId: JULY810_CLIENT_ID, name: JULY8_10_PROJECTS.powerAutomateDocs.name },
    ],
    hours: JULY8_10_HOURS.map((row) => ({
      id: row.id,
      clientId: JULY810_CLIENT_ID,
      projectId: row.projectKey ? JULY810_PROJECT_IDS[row.projectKey] : null,
      date: row.date,
      startTime: row.startTime,
      endTime: row.endTime,
      breakMinutes: 0,
      hourlyRate: JULY8_10_HOURLY_RATE,
      billable: row.billable,
      relatedWorkLogId: JULY8_10_WORK_DONE.find((w) => w.relatedHoursIds.includes(row.id))?.id ?? null,
      relatedWorkDoneIds: JULY8_10_WORK_DONE.filter((w) => w.relatedHoursIds.includes(row.id)).map((w) => w.id),
      migrationKey: row.migrationKey,
      billingStatus: row.superseded ? "superseded" : row.billable ? "ready-to-invoice" : "draft",
    })),
    workRecords,
    knowledgeRecords: [],
  };
}
