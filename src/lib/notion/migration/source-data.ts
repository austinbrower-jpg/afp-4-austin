/**
 * Corrected, read-only transcription of the AFP July 8-10 historical source.
 * The live pages were re-fetched through the read-only Notion connector on
 * 2026-07-10. This module is data only and performs no network or data writes.
 */
import type { ProjectKey, SourcePageRef } from "./types";

export const SOURCE_PAGES: Record<
  "hoursWorked" | "workDone" | "july8" | "july9" | "july10",
  SourcePageRef
> = {
  hoursWorked: {
    id: "3984259d-cffa-81be-930a-ca4ef072d72a",
    title: "Hours Worked",
    url: "https://app.notion.com/p/3984259dcffa81be930aca4ef072d72a",
    fetchedAt: "2026-07-10T19:30:42.192Z",
  },
  workDone: {
    id: "3984259d-cffa-81aa-a638-e428d0bcf252",
    title: "Work Done",
    url: "https://app.notion.com/p/3984259dcffa81aaa638e428d0bcf252",
    fetchedAt: "2026-07-10T19:12:26.548Z",
  },
  july8: {
    id: "3984259d-cffa-81a4-91d8-ca2e268546b5",
    title: "July 8, 2026",
    url: "https://app.notion.com/p/3984259dcffa81a491d8ca2e268546b5",
    fetchedAt: "2026-07-09T22:25:08.487Z",
  },
  july9: {
    id: "3984259d-cffa-816a-9132-ff82206e7651",
    title: "July 9, 2026",
    url: "https://app.notion.com/p/3984259dcffa816a9132ff82206e7651",
    fetchedAt: "2026-07-09T22:22:58.890Z",
  },
  july10: {
    id: "3994259d-cffa-8145-8d19-fc3c39d6ec90",
    title: "July 10, 2026",
    url: "https://app.notion.com/p/3994259dcffa81458d19fc3c39d6ec90",
    fetchedAt: "2026-07-10T19:12:26.547Z",
  },
};

export const CLIENT_NAME = "Anytime Fuel Pros";
export const STANDARD_HOURLY_RATE = 30;
export const SOURCE_TIMEZONE = "America/Chicago";

export interface RawSession {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  billable: boolean;
  workstream: string;
  location: string | null;
  status: string;
  notes: string;
  table: "onsite" | "billable";
}

/** Exactly five corrected Hours rows: one non-billable and four billable. */
export const RAW_SESSIONS: RawSession[] = [
  {
    id: "hrs-2026-07-08-onsite",
    date: "2026-07-08",
    startTime: "09:00",
    endTime: "11:00",
    billable: false,
    workstream: "Office / onsite",
    location: "Office / onsite",
    status: "Non-billable",
    notes: "Onsite time before active billable work began.",
    table: "onsite",
  },
  {
    id: "hrs-2026-07-08-morning",
    date: "2026-07-08",
    startTime: "11:00",
    endTime: "13:00",
    billable: true,
    workstream: "AFP systems review and BOL Review Process V2 automation work",
    location: "Office / onsite",
    status: "Confirmed",
    notes: "Confirmed billable work block; project derived from the July 8 BOL Review Process V2 source detail.",
    table: "billable",
  },
  {
    id: "hrs-2026-07-08-afternoon",
    date: "2026-07-08",
    startTime: "14:00",
    endTime: "17:49",
    billable: true,
    workstream: "AFP technical documentation, Power Automate support, website, and operations planning",
    location: null,
    status: "Confirmed",
    notes: "Confirmed continuous billable session; replaces the obsolete 14:05-17:00 and 17:10-17:49 split rows.",
    table: "billable",
  },
  {
    id: "hrs-2026-07-09",
    date: "2026-07-09",
    startTime: "09:12",
    endTime: "14:00",
    billable: true,
    workstream: "Power Automate BOL Review Process V2, workbook reporting, Command Center planning, and Notion documentation",
    location: null,
    status: "Confirmed",
    notes: "Closed session; the end-of-day entry supersedes the stale 9:00 AM/open header.",
    table: "billable",
  },
  {
    id: "hrs-2026-07-10",
    date: "2026-07-10",
    startTime: "08:40",
    endTime: "14:30",
    billable: true,
    workstream: "BOL Review Process V2 duplicate-prevention redesign, Pending cleanup, Sheet1 duplicate suppression, and fuel-classification prompt fix",
    location: null,
    status: "Confirmed",
    notes: "Closed session; source-stated invoice amount uses exact elapsed minutes ($175.00).",
    table: "billable",
  },
];

export const SOURCE_STATED_TOTALS = {
  totalBillableHours: 16.45,
  totalInvoiceAmount: 493.5,
  perDay: {
    "2026-07-08": { hours: 5.82, amount: 174.5 },
    "2026-07-09": { hours: 4.8, amount: 144 },
    "2026-07-10": { hours: 5.83, amount: 175 },
  },
} as const;

export interface RawWorkLog {
  id: string;
  date: string;
  title: string;
  priority: "low" | "medium" | "high" | "urgent";
  summary: string;
  detailedWorkDescription: string;
  invoiceDescription: string;
  internalNotes: string;
  evidenceLinks: string[];
  relatedHoursIds: string[];
}

export const RAW_WORK_LOGS: RawWorkLog[] = [
  {
    id: "wl-2026-07-08",
    date: "2026-07-08",
    title: "July 8, 2026 — AFP systems, automation, and documentation",
    priority: "high",
    summary: "Reviewed AFP digital systems and advanced BOL Review Process V2 extraction, matching, workbook output, testing, and maintainable work/invoice documentation.",
    detailedWorkDescription: "Reviewed the AFP digital systems scope; mapped and tested the Power Automate BOL Review Process V2 pipeline; validated BOL/invoice and gallon extraction across sample files; reviewed Sheet1 and Pending outputs; documented blockers and maintenance needs; established structured invoice/work logging; and planned AFP website and operations improvements.",
    invoiceDescription: "Performed AFP systems and automation support, including BOL Review Process V2 review and documentation, BOL/invoice extraction testing, validation of fuel-gallon values and workbook outputs, structured work/invoice documentation, and early website and operations planning.",
    internalNotes: "Source also records temporary Anthropic API credit limits and location ambiguity. Keep these operational details out of client-facing invoice copy unless specifically requested.",
    evidenceLinks: [SOURCE_PAGES.july8.url, SOURCE_PAGES.hoursWorked.url],
    relatedHoursIds: ["hrs-2026-07-08-onsite", "hrs-2026-07-08-morning", "hrs-2026-07-08-afternoon"],
  },
  {
    id: "wl-2026-07-09",
    date: "2026-07-09",
    title: "July 9, 2026 — BOL workflow routing and Command Center planning",
    priority: "high",
    summary: "Improved BOL Review Process V2 routing and workbook reporting, documented the flow, validated Unmatched and batch behavior, and planned the AFP Command Center / Sales & Operations Hub.",
    detailedWorkDescription: "Added reporting fields and vendor review formulas; documented the flow architecture; built the Unmatched validation path; configured matched, pending, and manual-review routing; diagnosed concurrency and incomplete JSON issues; enabled sequential processing; verified batch and vendor outputs; and developed the internal AFP Command Center / Sales Hub plan.",
    invoiceDescription: "Continued AFP Power Automate and Excel workbook development for BOL Review Process V2, including reporting fields, Unmatched validation, matched/pending routing, concurrency controls, batch verification, vendor reporting, flow documentation, and AFP Command Center / Sales Hub planning.",
    internalNotes: "The page header is stale (9:00 AM/open); the authoritative end-of-day entry is 9:12 AM-2:00 PM/closed. Parse JSON token-cost changes remained approval-gated.",
    evidenceLinks: [SOURCE_PAGES.july9.url, SOURCE_PAGES.hoursWorked.url],
    relatedHoursIds: ["hrs-2026-07-09"],
  },
  {
    id: "wl-2026-07-10",
    date: "2026-07-10",
    title: "July 10, 2026 — Duplicate prevention and extraction reliability",
    priority: "high",
    summary: "Redesigned Pending cleanup and duplicate prevention, corrected fuel classification in the extraction prompt, and reconciled a 49-document validation batch.",
    detailedWorkDescription: "Added unique PendingRowID values and rebuilt cleanup to delete every matching Pending row; added duplicate checks before Sheet1 and Pending writes; stress-tested repeat uploads; investigated BOL 1799635 / Invoice 7490341; corrected ULSD clear-versus-red classification rules in the Anthropic prompt; and reconciled Sheet1, Pending, Unmatched, and vendor outputs across a 49-document test set.",
    invoiceDescription: "Continued BOL Review Process V2 development by redesigning Pending cleanup, adding Sheet1 and pre-Pending duplicate prevention, correcting fuel-classification extraction rules, and validating duplicate handling and workbook results through stress tests and a 49-document reconciliation.",
    internalNotes: "The dated source header shows $175.00 while its footer shows $174.90 from rounded 5.83 hours. The authoritative Hours Worked page and corrected dataset use exact 350-minute billing: $175.00.",
    evidenceLinks: [SOURCE_PAGES.july10.url, SOURCE_PAGES.hoursWorked.url],
    relatedHoursIds: ["hrs-2026-07-10"],
  },
];

/** Source-evidenced single-project assignments for Hours rows. */
export const APPROVED_PROJECT_ASSIGNMENTS: Record<string, ProjectKey | null> = {
  "hrs-2026-07-08-onsite": null,
  "hrs-2026-07-08-morning": "bolReviewV2",
  "hrs-2026-07-08-afternoon": "powerAutomateDocs",
  "hrs-2026-07-09": "bolReviewV2",
  "hrs-2026-07-10": "bolReviewV2",
};

/** Primary and related projects preserved from each dated source page. */
export const APPROVED_WORK_LOG_PROJECTS: Record<
  string,
  { projectKey: ProjectKey; relatedProjectKeys: ProjectKey[] }
> = {
  "wl-2026-07-08": {
    projectKey: "bolReviewV2",
    relatedProjectKeys: ["powerAutomateDocs", "commandCenter", "invoiceWorkspace", "digitalSystemsAudit"],
  },
  "wl-2026-07-09": {
    projectKey: "bolReviewV2",
    relatedProjectKeys: ["powerAutomateDocs", "commandCenter"],
  },
  "wl-2026-07-10": { projectKey: "bolReviewV2", relatedProjectKeys: [] },
};

export const JULY9_HEADER_VS_RECONCILED = {
  headerStatedStart: "09:00",
  reconciledStart: "09:12",
  headerStatedStatus: "Not finalized yet / session still active",
  reconciledStatus: "Confirmed / closed",
};

/** The corrected continuous July 8 afternoon row leaves only the lunch gap. */
export const UNTRACKED_GAPS = [
  { date: "2026-07-08", afterSessionId: "hrs-2026-07-08-morning", start: "13:00", end: "14:00" },
];
