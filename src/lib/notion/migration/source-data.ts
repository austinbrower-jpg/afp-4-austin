/**
 * Structured transcription of the four historical AFP-Work Notion pages this
 * dry run previews a migration for. Read-only source: fetched once via
 * Notion's read-only search/fetch tools (no writes, no row-level database
 * query) and transcribed here so the dry-run engine is deterministic and
 * testable without a live Notion connection. Re-fetch and update this file
 * by hand if the source pages change before a real migration is approved.
 */
import type { ProjectKey, SourcePageRef } from "./types";

export const SOURCE_PAGES: Record<"hoursWorked" | "workDone" | "july8" | "july9", SourcePageRef> = {
  hoursWorked: {
    id: "3984259d-cffa-81be-930a-ca4ef072d72a",
    title: "Hours Worked",
    url: "https://app.notion.com/p/3984259dcffa81be930aca4ef072d72a",
    fetchedAt: "2026-07-09T19:06:33.236Z",
  },
  workDone: {
    id: "3984259d-cffa-81aa-a638-e428d0bcf252",
    title: "Work Done",
    url: "https://app.notion.com/p/3984259dcffa81aaa638e428d0bcf252",
    fetchedAt: "2026-07-09T22:25:08.487Z",
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
};

export const CLIENT_NAME = "Anytime Fuel Pros";
export const STANDARD_HOURLY_RATE = 30;
/** Stated explicitly on the Hours Worked page ("Timezone: America/Chicago"). */
export const SOURCE_TIMEZONE = "America/Chicago";

export interface RawSession {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  billable: boolean;
  /** Raw "Workstream / Project" (billable rows) or context label (onsite row) text. */
  workstream: string;
  /** Raw Location column text; null where the source itself says "Not specified". */
  location: string | null;
  status: string;
  notes: string;
  table: "onsite" | "billable";
}

/**
 * Every row from the Hours Worked page's "Onsite Table" and "Billable Hours
 * Table", in source order. Times converted from the page's 12-hour text to
 * 24-hour HH:mm for the domain model.
 */
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
    id: "hrs-2026-07-08-s1",
    date: "2026-07-08",
    startTime: "11:00",
    endTime: "13:00",
    billable: true,
    workstream: "AFP work",
    location: "Office / onsite",
    status: "Confirmed",
    notes: "Confirmed billable work block.",
    table: "billable",
  },
  {
    id: "hrs-2026-07-08-s2",
    date: "2026-07-08",
    startTime: "14:05",
    endTime: "17:00",
    billable: true,
    workstream: "AFP work / technical documentation and Power Automate support",
    location: null,
    status: "Confirmed",
    notes: "Closed billable session.",
    table: "billable",
  },
  {
    id: "hrs-2026-07-08-s3",
    date: "2026-07-08",
    startTime: "17:10",
    endTime: "17:49",
    billable: true,
    workstream: "AFP work / website and operations planning",
    location: null,
    status: "Confirmed",
    notes: "Closed billable session.",
    table: "billable",
  },
  {
    id: "hrs-2026-07-09-s1",
    date: "2026-07-09",
    startTime: "09:12",
    endTime: "14:00",
    billable: true,
    workstream:
      "AFP work / Power Automate BOL Review Process V2, workbook reporting, Command Center planning, and Notion documentation",
    location: null,
    status: "Confirmed",
    notes:
      "Closed billable session. Work included Command Center/Sales Hub planning, vendor tab formulas, Pending/Unmatched troubleshooting, and safe Parse JSON troubleshooting plan.",
    table: "billable",
  },
];

/** Figures the Hours Worked / July 8 / July 9 pages state about themselves, for reconciliation. */
export const SOURCE_STATED_TOTALS = {
  totalBillableHours: 10.37,
  totalInvoiceAmount: 311.0,
  perDay: {
    "2026-07-08": { hours: 5.57, amount: 167.0 },
    "2026-07-09": { hours: 4.8, amount: 144.0 },
  },
} as const;

export interface RawWorkLog {
  id: string;
  date: string;
  title: string;
  summary: string;
  /** In source chronological order; the real page has more than one for July 9. */
  invoiceReadyBlocks: string[];
  relatedHoursIds: string[];
}

export const RAW_WORK_LOGS: RawWorkLog[] = [
  {
    id: "wl-2026-07-08",
    date: "2026-07-08",
    title: "July 8, 2026",
    summary:
      "Started organizing AFP contractor work into a structured tracking workflow and worked through the BOL Review Process V2 automation, BOL/invoice extraction testing, Excel table outputs, and early documentation structure. Also reviewed the SLC OPS page and began planning a stronger AFP website rebuild workflow using Claude Code / Vercel rather than Claude Artifacts.",
    invoiceReadyBlocks: [
      "Performed AFP systems and automation support, including review and documentation of the Power Automate BOL Review Process V2, testing BOL/invoice extraction behavior, validating expected BOL and fuel gallon values against workflow outputs, reviewing Sheet1 and Pending table results, identifying Anthropic API credit limitations as a blocker, and beginning structured documentation/work logging for future invoice and maintenance records. Also reviewed the SLC OPS page and started planning the AFP website rebuild workflow using Claude Code and Vercel.",
    ],
    relatedHoursIds: ["hrs-2026-07-08-onsite", "hrs-2026-07-08-s1", "hrs-2026-07-08-s2", "hrs-2026-07-08-s3"],
  },
  {
    id: "wl-2026-07-09",
    date: "2026-07-09",
    title: "July 9, 2026",
    summary:
      "Continued AFP Power Automate / BOL Review Process V2 development and documentation. The main focus was improving the Excel workbook and flow routing so uploaded documents can be separated into matched, pending, and manual-review categories. Added reporting fields for monthly filtering, created/updated Notion documentation, added a dedicated Unmatched validation path, confirmed Unmatched routing with a fake/problem PDF, diagnosed matching issues caused by simultaneous processing, and enabled trigger concurrency control so batch uploads queue safely instead of colliding while writing to Excel.",
    invoiceReadyBlocks: [
      "Performed AFP Power Automate development and documentation for the BOL Review Process V2 workflow. Updated the BOL Review workbook structure with reporting/status fields, documented flow architecture in Notion, created a dedicated Unmatched validation path, configured Excel row mappings for matched and manual-review records, tested SharePoint PDF upload routing, confirmed bad/incomplete documents route to Unmatched, diagnosed matching failures caused by simultaneous Excel access, enabled trigger concurrency control to process uploaded PDFs sequentially, and verified batch routing behavior across Sheet1, Pending, and Unmatched outputs.",
      "Also organized the BOL Review workbook with vendor/company review tabs, configured formula-based filtering from the Sheet1 master matched list, verified Brad Hall, Kendrick Oil, and Mansfield vendor outputs, reviewed the messy Phillips66 BOL as a low-quality/manual-review case, discussed route sheet meaning and future use, evaluated multi-page PDF support, and documented performance/delete-sync design considerations for future automation improvements.",
      "Continued AFP Power Automate, Excel workbook, and internal systems planning work. Built out the AFP Command Center / Sales Hub strategy in Notion, corrected vendor reporting formulas, reviewed workbook filter/copy behavior, investigated Pending and Unmatched routing behavior, diagnosed a Parse JSON failure caused by incomplete AI output, and prepared a safe troubleshooting approach that avoids increasing Anthropic token usage without approval.",
    ],
    relatedHoursIds: ["hrs-2026-07-09-s1"],
  },
];

/**
 * The July 9 page's own header states the session "Started at 9:00 AM" and
 * was "still active / not closed yet" with "Confirmed Billable Time: Not
 * finalized yet" - but the same page's later "End-of-Day Shift Update - 2:00
 * PM" section (and the Hours Worked table) reconcile the same session as
 * 9:12 AM-2:00 PM, closed. The engine treats the closed, reconciled figures
 * as authoritative and flags the stale header text - see dry-run.ts.
 */
export const JULY9_HEADER_VS_RECONCILED = {
  headerStatedStart: "09:00",
  reconciledStart: "09:12",
  headerStatedStatus: "Not finalized yet / session still active",
  reconciledStatus: "Confirmed / closed",
};

/**
 * Gaps between recorded sessions on the same day that appear in neither the
 * onsite nor billable tables - not migrated as break or session records,
 * only surfaced as a warning.
 */
export const UNTRACKED_GAPS = [
  { date: "2026-07-08", afterSessionId: "hrs-2026-07-08-s1", start: "13:00", end: "14:05" },
  { date: "2026-07-08", afterSessionId: "hrs-2026-07-08-s2", start: "17:00", end: "17:10" },
];

/**
 * Explicit, user-approved project assignments (2026-07-10 decision),
 * overriding the keyword-derived matches from the initial dry run. Every
 * session has an entry, including the non-billable onsite row (explicitly
 * `null` - not "ambiguous", just not project work). See dry-run.ts:
 * buildHours() prefers this table over matchProjectCandidates() whenever a
 * session id has an entry here.
 */
export const APPROVED_PROJECT_ASSIGNMENTS: Record<string, ProjectKey | null> = {
  "hrs-2026-07-08-onsite": null,
  "hrs-2026-07-08-s1": "bolReviewV2",
  "hrs-2026-07-08-s2": "powerAutomateDocs",
  "hrs-2026-07-08-s3": "commandCenter",
  "hrs-2026-07-09-s1": "bolReviewV2",
};

/**
 * Explicit, user-approved work-log-level project assignments (2026-07-10
 * decision). `projectKey` is the single main/primary project (the domain
 * WorkLog schema only supports one); `relatedProjectKeys` preserves the
 * others this day's work also touched, since the user explicitly asked for
 * those references to be preserved rather than dropped.
 *
 * July 8 has three sessions individually approved to three different
 * projects (see APPROVED_PROJECT_ASSIGNMENTS above) and no single "main"
 * project was specified for that day - left `projectKey: null` rather than
 * guessing one; all three are preserved in relatedProjectKeys.
 */
export const APPROVED_WORK_LOG_PROJECTS: Record<
  string,
  { projectKey: ProjectKey | null; relatedProjectKeys: ProjectKey[] }
> = {
  "wl-2026-07-08": {
    projectKey: null,
    relatedProjectKeys: ["bolReviewV2", "powerAutomateDocs", "commandCenter"],
  },
  "wl-2026-07-09": {
    projectKey: "bolReviewV2",
    relatedProjectKeys: ["commandCenter", "powerAutomateDocs"],
  },
};
