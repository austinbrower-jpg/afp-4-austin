import "server-only";
import { getDataProvider } from "@/lib/data/provider";
import type { AppDataProvider } from "@/lib/data/provider-types";
import {
  APPROVED_PROJECT_ASSIGNMENTS,
  APPROVED_WORK_LOG_PROJECTS,
  CLIENT_NAME,
  RAW_SESSIONS,
  RAW_WORK_LOGS,
  SOURCE_PAGES,
  STANDARD_HOURLY_RATE,
} from "@/lib/notion/migration/source-data";
import type { KnowledgePage, WorkLog } from "@/types/domain";
import type {
  ReportDataSource,
  ReportDataset,
  ReportKnowledgeRecord,
  ReportWorkRecord,
} from "./types";

const HISTORICAL_CLIENT_ID = "historical-anytime-fuel-pros";
const HISTORICAL_PROJECTS = {
  bolReviewV2: { id: "historical-bol-review-v2", name: "BOL Review Process V2" },
  commandCenter: {
    id: "historical-command-center",
    name: "AFP Command Center / Sales & Operations Hub",
  },
  powerAutomateDocs: {
    id: "historical-power-automate-docs",
    name: "Power Automate Documentation",
  },
  invoiceWorkspace: {
    id: "historical-afp-invoice-workspace",
    name: "AFP Invoice Workspace",
  },
  digitalSystemsAudit: {
    id: "historical-digital-systems-audit",
    name: "Digital Systems Audit & Process Documentation",
  },
} as const;

function evidenceForWorkLog(id: string): string[] {
  if (id === "wl-2026-07-08") return [SOURCE_PAGES.july8.url, SOURCE_PAGES.hoursWorked.url];
  if (id === "wl-2026-07-09") return [SOURCE_PAGES.july9.url, SOURCE_PAGES.hoursWorked.url];
  return [SOURCE_PAGES.july10.url, SOURCE_PAGES.hoursWorked.url];
}

function historicalDeliverables(id: string): string[] {
  if (id === "wl-2026-07-08") return [
    "Reviewed and documented the BOL Review Process V2 workflow.",
    "Established structured work and invoice documentation.",
    "Prepared AFP website and operations planning.",
  ];
  if (id === "wl-2026-07-09") return [
    "Added workbook reporting and status fields.",
    "Created the Unmatched validation path and sequential batch controls.",
    "Built vendor review tabs and the Command Center plan.",
  ];
  return [
    "Redesigned Pending cleanup with unique row identifiers.",
    "Added Sheet1 and pre-Pending duplicate prevention.",
    "Corrected fuel classification in the extraction prompt.",
  ];
}

function historicalTesting(id: string): string[] {
  if (id === "wl-2026-07-08") return ["Tested BOL and invoice extraction behavior against expected values."];
  if (id === "wl-2026-07-09") return [
    "Confirmed incomplete documents route to Unmatched.",
    "Verified batch routing and vendor-filtered workbook outputs.",
  ];
  return ["Stress-tested repeat uploads and reconciled a 49-document batch across workbook outputs."];
}

function historicalBlockers(id: string): string[] {
  if (id === "wl-2026-07-08") return ["Anthropic API credit limits blocked additional extraction testing."];
  if (id === "wl-2026-07-09") return ["Incomplete AI output required a safe Parse JSON troubleshooting path."];
  return ["Kendrick and Phillips 66 classification/number edge cases remained for follow-up."];
}

function historicalFollowUps(id: string): string[] {
  if (id === "wl-2026-07-08") return ["Continue the website rebuild and automation documentation plan."];
  if (id === "wl-2026-07-09") return ["Evaluate multi-page PDF support and future delete-sync behavior."];
  return ["Complete the remaining document-classification edge-case validation."];
}

export function buildHistoricalDataset(): ReportDataset {
  const workRecords: ReportWorkRecord[] = RAW_WORK_LOGS.map((work) => {
    const approved = APPROVED_WORK_LOG_PROJECTS[work.id];
    return {
      id: work.id,
      clientId: HISTORICAL_CLIENT_ID,
      projectId: approved?.projectKey ? HISTORICAL_PROJECTS[approved.projectKey].id : null,
      date: work.date,
      title: work.title,
      summary: work.summary,
      detailedWorkDescription: work.detailedWorkDescription,
      internalNotes: work.internalNotes,
      status: "done",
      clientVisible: true,
      includeInInvoice: true,
      includeInWorkReport: true,
      evidenceLinks: [...work.evidenceLinks],
      relatedHoursIds: [...work.relatedHoursIds],
      deliverables: historicalDeliverables(work.id),
      testingPerformed: historicalTesting(work.id),
      blockers: historicalBlockers(work.id),
      followUpItems: historicalFollowUps(work.id),
    };
  });
  const knowledgeRecords: ReportKnowledgeRecord[] = RAW_WORK_LOGS.map((work) => ({
    id: `knowledge-${work.id}`,
    clientId: HISTORICAL_CLIENT_ID,
    projectId: workRecords.find((record) => record.id === work.id)?.projectId ?? null,
    title: `${work.title} source work page`,
    reportSummary: work.summary,
    internalNotes: "",
    clientVisible: true,
    includeInWorkReport: true,
    sourcePage: evidenceForWorkLog(work.id)[0],
  }));
  return {
    source: "historical-preview",
    label: "Historical preview data",
    description: "Corrected read-only July 8–10, 2026 AFP preview; no import is required.",
    clients: [{ id: HISTORICAL_CLIENT_ID, name: CLIENT_NAME, defaultHourlyRate: STANDARD_HOURLY_RATE }],
    projects: Object.values(HISTORICAL_PROJECTS).map((project) => ({
      ...project,
      clientId: HISTORICAL_CLIENT_ID,
    })),
    hours: RAW_SESSIONS.map((session) => ({
      id: session.id,
      clientId: HISTORICAL_CLIENT_ID,
      projectId: APPROVED_PROJECT_ASSIGNMENTS[session.id]
        ? HISTORICAL_PROJECTS[APPROVED_PROJECT_ASSIGNMENTS[session.id]!].id
        : null,
      date: session.date,
      startTime: session.startTime,
      endTime: session.endTime,
      breakMinutes: 0,
      hourlyRate: STANDARD_HOURLY_RATE,
      billable: session.billable,
      relatedWorkLogId: RAW_WORK_LOGS.find((work) => work.relatedHoursIds.includes(session.id))?.id ?? null,
    })),
    workRecords,
    knowledgeRecords,
  };
}

type FutureReportFields = {
  clientVisible?: boolean;
  includeInInvoice?: boolean;
  includeInWorkReport?: boolean;
  detailedWorkDescription?: string;
  internalNotes?: string;
  evidenceLinks?: string[];
  reportSummary?: string;
  sourcePage?: string;
};

function mapWorkLog(log: WorkLog, source: ReportDataSource): ReportWorkRecord {
  const future = log as WorkLog & FutureReportFields;
  const legacyClientDescription = log.invoiceDescription.trim();
  const isLocal = source === "local-mock";
  return {
    id: log.id,
    clientId: log.clientId,
    projectId: log.projectId,
    date: log.date,
    title: log.title,
    summary: log.summary,
    detailedWorkDescription: future.detailedWorkDescription ?? legacyClientDescription,
    internalNotes: future.internalNotes ?? log.detailedNotes,
    status: log.status,
    // The legacy local model explicitly labels invoiceDescription as
    // client-facing, so a populated value is a safe local/mock opt-in. Notion
    // rows require the proposed explicit flags and default to excluded.
    clientVisible: future.clientVisible ?? (isLocal && !!legacyClientDescription ? true : null),
    includeInInvoice: future.includeInInvoice ?? (isLocal && !!legacyClientDescription ? true : null),
    includeInWorkReport: future.includeInWorkReport ?? (isLocal && !!legacyClientDescription ? true : null),
    evidenceLinks: future.evidenceLinks ?? [
      ...log.evidence,
      ...(log.githubLink ? [log.githubLink] : []),
      ...log.attachments.map((attachment) => attachment.url),
    ],
    relatedHoursIds: [...log.relatedHoursIds],
    deliverables: log.status === "done" ? [log.title] : [],
    testingPerformed: [],
    blockers: log.status === "blocked" && log.summary ? [log.summary] : [],
    followUpItems: log.status === "blocked" ? ["Resolve the client-visible blocker and complete verification."] : [],
  };
}

function mapKnowledge(page: KnowledgePage): ReportKnowledgeRecord {
  const future = page as KnowledgePage & FutureReportFields;
  return {
    id: page.id,
    clientId: page.clientId,
    projectId: page.projectId,
    title: page.title,
    reportSummary: future.reportSummary ?? "",
    internalNotes: future.internalNotes ?? page.content,
    clientVisible: future.clientVisible ?? null,
    includeInWorkReport: future.includeInWorkReport ?? null,
    sourcePage: future.sourcePage ?? null,
  };
}

async function buildStoredDataset(provider: AppDataProvider): Promise<ReportDataset> {
  const source = provider.mode === "notion" ? "notion" : "local-mock";
  const [clients, projects, hours, workLogs, knowledge] = await Promise.all([
    provider.clients.list(), provider.projects.list(), provider.hours.list(), provider.workLogs.list(), provider.knowledge.list(),
  ]);
  return {
    source,
    label: source === "notion" ? "Notion data" : "Local mock data",
    description: source === "notion"
      ? "Fresh rows read directly from Notion for this request; no SQLite or mixed local rows."
      : "SQLite development records with the legacy client-facing description used as local visibility opt-in.",
    clients: clients.map((client) => ({
      id: client.id,
      name: client.name,
      defaultHourlyRate: client.defaultHourlyRate,
    })),
    projects: projects.map((project) => ({ id: project.id, clientId: project.clientId, name: project.name })),
    hours: hours.map((entry) => ({
      id: entry.id,
      clientId: entry.clientId,
      projectId: entry.projectId,
      migrationKey: entry.externalId ?? null,
      date: entry.date,
      startTime: entry.startTime,
      endTime: entry.endTime,
      breakMinutes: entry.breakMinutes,
      hourlyRate: entry.hourlyRate,
      billable: entry.billable,
      relatedWorkLogId: entry.relatedWorkLogId,
    })),
    workRecords: workLogs.map((log) => mapWorkLog(log, source)),
    knowledgeRecords: knowledge.map(mapKnowledge),
  };
}

export interface ReportBuilderData {
  datasets: ReportDataset[];
  recommendedSource: ReportDataSource;
}

export async function getReportBuilderData(): Promise<ReportBuilderData> {
  const provider = await getDataProvider();
  const current = await buildStoredDataset(provider);
  const historical = buildHistoricalDataset();
  return {
    datasets: [current, historical],
    // Production must open on the live provider even when its databases are
    // empty. The historical reconciliation stays available as an explicit,
    // isolated preview dataset and is never a fallback for live data.
    recommendedSource: current.source,
  };
}
