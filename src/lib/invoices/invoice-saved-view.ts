/**
 * Immutable saved-invoice view — composes reports from stored relations only.
 */
import { composeReport, roundCurrency } from "@/lib/reports/engine";
import type { ReportDataset, ReportDocument, ReportSettings } from "@/lib/reports/types";
import type { HoursEntry, InvoiceReport, WorkLog } from "@/types/domain";
import { buildStoredDatasetForSave } from "./invoice-save-data";
import type { AppDataProvider } from "@/lib/data/provider-types";

export interface SavedInvoiceView {
  report: ReportDocument;
  warnings: string[];
  liveDriftWarnings: string[];
  sessionIds: string[];
  workLogIds: string[];
  immutableTotals: {
    totalHours: number;
    totalAmount: number;
    hourlyRate: number;
  };
}

export function buildSavedInvoiceDataset(
  invoice: InvoiceReport,
  allHours: HoursEntry[],
  allWork: WorkLog[],
  baseDataset: ReportDataset,
): { dataset: ReportDataset; warnings: string[] } {
  const warnings: string[] = [];
  const hoursIds = new Set(invoice.hoursEntryIds);
  const workIds = new Set(invoice.workDoneIds ?? []);

  const includedHours = allHours.filter((h) => hoursIds.has(h.id));
  const includedWork = allWork.filter((w) => workIds.has(w.id));

  if (includedHours.length !== hoursIds.size) {
    const missing = [...hoursIds].filter((id) => !includedHours.some((h) => h.id === id));
    warnings.push(`Missing ${missing.length} Included Hours relation(s): ${missing.join(", ")}`);
  }
  if (includedWork.length !== workIds.size) {
    const missing = [...workIds].filter((id) => !includedWork.some((w) => w.id === id));
    warnings.push(`Missing ${missing.length} Included Work Done relation(s): ${missing.join(", ")}`);
  }

  const client = baseDataset.clients.find((c) => c.id === invoice.clientId);

  const dataset: ReportDataset = {
    ...baseDataset,
    clients: client ? [client] : [],
    projects: baseDataset.projects.filter((p) => p.clientId === invoice.clientId),
    hours: includedHours.map((entry) => ({
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
    workRecords: includedWork.map((log) => {
      const fromBase = baseDataset.workRecords.find((w) => w.id === log.id);
      if (fromBase) return fromBase;
      return {
        id: log.id,
        clientId: log.clientId,
        projectId: log.projectId,
        date: log.date,
        title: log.title,
        summary: log.summary,
        detailedWorkDescription: log.detailedWorkDescription ?? log.invoiceDescription,
        internalNotes: log.internalNotes ?? log.detailedNotes,
        status: log.status,
        clientVisible: log.clientVisible ?? true,
        includeInInvoice: log.includeInInvoice ?? true,
        includeInWorkReport: log.includeInWorkReport ?? true,
        evidenceLinks: log.evidenceLinks ?? [],
        relatedHoursIds: log.relatedHoursIds,
        deliverables: [],
        testingPerformed: [],
        blockers: [],
        followUpItems: [],
        approvalStatus: log.approvalStatus ?? "approved",
      };
    }),
    knowledgeRecords: [],
  };

  return { dataset, warnings };
}

function invoiceViewId(invoice: InvoiceReport): string {
  return invoice.notionPageId ?? invoice.id;
}

/** Overlay saved snapshot totals on the report without mutating session lines. */
export function applyImmutableSnapshotToReport(
  report: ReportDocument,
  invoice: InvoiceReport,
): ReportDocument {
  const billableMinutes = Math.round(invoice.totalHours * 60);
  return {
    ...report,
    totals: {
      ...report.totals,
      billableMinutes,
      amountDue: invoice.totalAmount,
      hourlyRates: [invoice.hourlyRate],
    },
  };
}

export function detectSavedInvoiceDrift(
  report: ReportDocument,
  invoice: InvoiceReport,
  includedHours: HoursEntry[],
): string[] {
  const warnings: string[] = [];
  const liveAmount = roundCurrency(report.totals.amountDue);
  const liveHours = roundCurrency(report.totals.billableMinutes / 60);
  const billableSessions = report.sessions.filter((s) => s.billable);

  if (billableSessions.length !== invoice.hoursEntryIds.length) {
    warnings.push(
      `Included Hours count (${billableSessions.length}) differs from saved snapshot (${invoice.hoursEntryIds.length}).`,
    );
  }
  if (Math.abs(liveAmount - invoice.totalAmount) > 0.01) {
    warnings.push(
      `Live source rows recompose to $${liveAmount.toFixed(2)}; saved snapshot is $${invoice.totalAmount.toFixed(2)}.`,
    );
  }
  if (Math.abs(liveHours - invoice.totalHours) > 0.01) {
    warnings.push(
      `Live source rows recompose to ${liveHours}h; saved snapshot is ${invoice.totalHours}h.`,
    );
  }

  for (const hoursId of invoice.hoursEntryIds) {
    const row = includedHours.find((h) => h.id === hoursId);
    const session = report.sessions.find((s) => s.id === hoursId);
    if (!row) {
      warnings.push(`Saved Hours row ${hoursId} is no longer available in the source.`);
      continue;
    }
    if (!session && row.billable) {
      warnings.push(`Saved Hours row ${row.sessionId ?? hoursId} could not be included in preview composition.`);
    }
  }

  return warnings;
}

export function composeSavedInvoiceView(
  invoice: InvoiceReport,
  allHours: HoursEntry[],
  allWork: WorkLog[],
  baseDataset: ReportDataset,
  settings: ReportSettings,
  reportType: "simple-invoice" | "detailed-invoice" = "detailed-invoice",
): SavedInvoiceView {
  const { dataset, warnings } = buildSavedInvoiceDataset(invoice, allHours, allWork, baseDataset);
  const includedHours = allHours.filter((h) => invoice.hoursEntryIds.includes(h.id));

  const liveReport = composeReport(dataset, settings, {
    type: reportType,
    clientId: invoice.clientId,
    periodStart: invoice.periodStart,
    periodEnd: invoice.periodEnd,
    projectIds: [],
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate ?? invoice.periodEnd,
    paymentTerms: invoice.paymentTerms ?? settings.defaultPaymentTerms,
    dueDate: invoice.dueDate ?? invoice.periodEnd,
    customTitle: "",
    notes: "",
    executiveSummary: invoice.summary,
    draftDescriptions: {},
    viewingInvoiceId: invoiceViewId(invoice),
    savedInvoiceView: true,
  });

  const liveDriftWarnings = detectSavedInvoiceDrift(liveReport, invoice, includedHours);
  const report = applyImmutableSnapshotToReport(liveReport, invoice);

  const sessionIds = includedHours
    .map((h) => h.sessionId)
    .filter((id): id is string => Boolean(id?.trim()));
  const workLogIds = allWork
    .filter((w) => (invoice.workDoneIds ?? []).includes(w.id))
    .map((w) => w.workLogId)
    .filter((id): id is string => Boolean(id?.trim()));

  return {
    report,
    warnings,
    liveDriftWarnings,
    sessionIds,
    workLogIds,
    immutableTotals: {
      totalHours: invoice.totalHours,
      totalAmount: invoice.totalAmount,
      hourlyRate: invoice.hourlyRate,
    },
  };
}

export async function buildSavedInvoiceViewFromProvider(
  invoice: InvoiceReport,
  provider: AppDataProvider,
  settings: ReportSettings,
): Promise<SavedInvoiceView> {
  const [baseDataset, hours, work] = await Promise.all([
    buildStoredDatasetForSave(provider),
    provider.hours.list(),
    provider.workLogs.list(),
  ]);
  return composeSavedInvoiceView(invoice, hours, work, baseDataset, settings);
}
