import type { AppDataProvider } from "@/lib/data/provider-types";
import type { ReportDataset } from "@/lib/reports/types";
import type { WorkLog } from "@/types/domain";

type FutureReportFields = {
  detailedWorkDescription?: string;
  internalNotes?: string;
  clientVisible?: boolean | null;
  includeInInvoice?: boolean | null;
  includeInWorkReport?: boolean | null;
  evidenceLinks?: string[];
  approvalStatus?: string | null;
};

function mapWorkLog(log: WorkLog, source: ReportDataset["source"]) {
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
    clientVisible: future.clientVisible ?? (isLocal && !!legacyClientDescription ? true : null),
    includeInInvoice: future.includeInInvoice ?? (isLocal && !!legacyClientDescription ? true : null),
    includeInWorkReport: future.includeInWorkReport ?? (isLocal && !!legacyClientDescription ? true : null),
    evidenceLinks: future.evidenceLinks ?? [
      ...log.evidence,
      ...(log.githubLink ? [log.githubLink] : []),
      ...log.attachments.map((attachment) => attachment.url),
    ],
    relatedHoursIds: [...(log.relatedHoursIds ?? [])],
    deliverables: log.status === "done" ? [log.title] : [],
    testingPerformed: [],
    blockers: log.status === "blocked" && log.summary ? [log.summary] : [],
    followUpItems: log.status === "blocked" ? ["Resolve the client-visible blocker and complete verification."] : [],
    approvalStatus: log.approvalStatus ?? (log.status === "done" ? "approved" : null),
  };
}

/** Notion-backed dataset for invoice save preflight (single source, not historical fixtures). */
export async function buildStoredDatasetForSave(provider: AppDataProvider): Promise<ReportDataset> {
  const source = provider.mode === "notion" ? "notion" : "local-mock";
  const [clients, projects, hours, workLogs] = await Promise.all([
    provider.clients.list(),
    provider.projects.list(),
    provider.hours.list(),
    provider.workLogs.list(),
  ]);
  return {
    source,
    label: source === "notion" ? "Notion data" : "Local mock data",
    description:
      source === "notion"
        ? "Fresh rows read directly from Notion for invoice save preflight."
        : "SQLite development records.",
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
      date: entry.date,
      startTime: entry.startTime,
      endTime: entry.endTime,
      breakMinutes: entry.breakMinutes,
      hourlyRate: entry.hourlyRate,
      billable: entry.billable,
      relatedWorkLogId: entry.relatedWorkLogId,
      relatedWorkDoneIds: entry.relatedWorkDoneIds,
      migrationKey: entry.externalId,
      billingStatus: entry.billingStatus,
      invoiceReportId: entry.invoiceReportId,
    })),
    workRecords: workLogs.map((log) => mapWorkLog(log, source)),
    knowledgeRecords: [],
  };
}
