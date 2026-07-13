/**
 * Phase 13 invoice save + locking — preflight (read-only) and apply plan.
 * Live writes are gated by NOTION_INVOICE_SAVE_ENABLED.
 */

import {
  buildInvoiceLockPlan,
  type InvoiceLockCandidate,
  type InvoiceLockFailure,
  type InvoiceLockPlan,
  type LockableHours,
  type LockableInvoice,
  type LockableWork,
} from "./invoice-locking";
import { fromNotionLegacyStatus, invoiceBlocksNewBilling } from "./invoice-status";
import { isSupersededHours } from "@/lib/notion/quarantine";
import { matchHoursToWork } from "@/lib/reports/relation-matching";
import type { ReportDataset, ReportDocument, ReportSettings } from "@/lib/reports/types";
import { composeReport } from "@/lib/reports/engine";
import type { HoursEntry, InvoiceReport, WorkLog } from "@/types/domain";
import { roundCurrency } from "@/lib/reports/engine";

export const INVOICE_SAVE_CONFIRMATION_PHRASE = "SAVE AFP INVOICE";

export function isInvoiceSaveEnabled(): boolean {
  return process.env.NOTION_INVOICE_SAVE_ENABLED === "true";
}

export interface InvoiceSaveRequest {
  type: "simple-invoice" | "detailed-invoice";
  clientId: string;
  periodStart: string;
  periodEnd: string;
  projectIds: string[];
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  paymentTerms: string;
  customTitle: string;
  notes: string;
  executiveSummary: string;
  draftDescriptions: Record<string, string>;
  confirmationPhrase?: string;
  pdfUrl?: string | null;
}

export interface DuplicateBillingDiagnostic {
  hoursId: string;
  sessionId: string | null;
  code: InvoiceLockFailure["code"] | "missing-session-id" | "duplicate-session-id" | "paid-hours" | "conflicting-relation";
  message: string;
}

export interface InvoiceSavePreflightResult {
  readOnly: true;
  writesPerformed: false;
  ready: boolean;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  includedHours: Array<{
    id: string;
    sessionId: string | null;
    date: string;
    startTime: string;
    endTime: string;
    amount: number;
    matchSource: string | null;
  }>;
  includedWorkDone: Array<{
    id: string;
    workLogId: string | null;
    title: string;
    date: string;
  }>;
  totals: {
    billableMinutes: number;
    nonBillableMinutes: number;
    billableHours: number;
    amount: number;
  };
  duplicateConflicts: DuplicateBillingDiagnostic[];
  lifecycleConflicts: DuplicateBillingDiagnostic[];
  lockPlan: InvoiceLockPlan;
  gatingReasons: string[];
  saveEnabled: boolean;
}

export interface InvoiceSavePayload {
  clientId: string;
  invoiceNumber: string;
  periodStart: string;
  periodEnd: string;
  hourlyRate: number;
  totalHours: number;
  totalAmount: number;
  summary: string;
  lineItems: InvoiceReport["lineItems"];
  hoursEntryIds: string[];
  workDoneIds: string[];
  status: InvoiceReport["status"];
  invoiceDate: string;
  dueDate: string;
  paymentTerms: string;
  pdfUrl: string | null;
}

export interface InvoiceSavePlan {
  preflight: InvoiceSavePreflightResult;
  invoicePayload: InvoiceSavePayload;
  existingInvoiceId: string | null;
  writeSteps: InvoiceSaveWriteStep[];
}

export type InvoiceSaveWriteStep =
  | { phase: "create-invoice"; label: string }
  | { phase: "link-invoice-relations"; label: string; invoiceId: string }
  | { phase: "lock-hours"; label: string; hoursId: string }
  | { phase: "link-work"; label: string; workId: string };

export interface InvoiceSaveApplyResult {
  success: boolean;
  stoppedEarly: boolean;
  error?: string;
  notionPageId?: string;
  notionUrl?: string;
  invoiceNumber?: string;
  appliedSteps: string[];
  skippedSteps: string[];
  partialState?: {
    invoiceId: string | null;
    hoursUpdated: string[];
    workUpdated: string[];
    hoursRemaining: string[];
    workRemaining: string[];
  };
}

function toLockableHours(h: HoursEntry): LockableHours {
  return {
    id: h.id,
    billingStatus: h.billingStatus ?? null,
    migrationKey: h.externalId ?? null,
    externalId: h.externalId ?? null,
    billable: h.billable,
    invoiceReportId: h.invoiceReportId ?? null,
  };
}

function toLockableWork(w: WorkLog): LockableWork {
  return {
    id: w.id,
    clientVisible: w.clientVisible,
    includeInInvoice: w.includeInInvoice,
    approvalStatus: w.approvalStatus ?? null,
    internalNotes: w.internalNotes,
  };
}

function toLockableInvoices(
  invoices: InvoiceReport[],
  hours: HoursEntry[],
): LockableInvoice[] {
  return invoices.map((inv) => ({
    id: inv.notionPageId ?? inv.id,
    status: fromNotionLegacyStatus(inv.status),
    clientId: inv.clientId,
    includedHoursIds: hours.filter((h) => h.invoiceReportId === (inv.notionPageId ?? inv.id)).map((h) => h.id),
    includedWorkDoneIds: inv.workDoneIds ?? [],
  }));
}

export function buildCandidatesFromReport(
  report: ReportDocument,
  dataset: ReportDataset,
  clientId: string,
): InvoiceLockCandidate[] {
  const candidates: InvoiceLockCandidate[] = [];
  for (const session of report.sessions.filter((s) => s.billable)) {
    const hours = dataset.hours.find((h) => h.id === session.id);
    if (!hours) continue;
    const clientWork = dataset.workRecords.filter((w) => w.clientId === clientId);
    const matches = matchHoursToWork(
      {
        id: hours.id,
        date: hours.date,
        projectId: hours.projectId,
        relatedWorkLogId: hours.relatedWorkLogId ?? null,
        relatedWorkDoneIds: hours.relatedWorkDoneIds ?? [],
      },
      clientWork.map((w) => ({
        id: w.id,
        date: w.date,
        projectId: w.projectId,
        relatedHoursIds: w.relatedHoursIds ?? [],
        clientVisible: w.clientVisible,
        includeInInvoice: w.includeInInvoice,
        approvalStatus: w.approvalStatus ?? null,
      })),
    );
    const workIds = matches
      .filter((m) => m.workId && m.source !== "ambiguous" && m.source !== "missing")
      .map((m) => m.workId);
    candidates.push({ hoursId: hours.id, workIds });
  }
  return candidates;
}

function formatLockFailure(f: InvoiceLockFailure, hours: HoursEntry[], invoices: InvoiceReport[]): DuplicateBillingDiagnostic {
  const sessionId = hours.find((h) => h.id === f.hoursId)?.sessionId ?? null;
  let message = f.message;
  if (f.code === "already-invoiced" && f.hoursId) {
    const inv = invoices.find((i) => hours.find((h) => h.id === f.hoursId)?.invoiceReportId === (i.notionPageId ?? i.id));
    message = inv ? `Already invoiced on ${inv.invoiceNumber}` : "Already invoiced";
  }
  if (f.code === "tied-to-other-invoice" && f.hoursId) {
    const inv = invoices.find((i) => (i.notionPageId ?? i.id) === hours.find((h) => h.id === f.hoursId)?.invoiceReportId);
    message = inv ? `Conflicting invoice relation on ${inv.invoiceNumber}` : "Conflicting invoice relation";
  }
  return {
    hoursId: f.hoursId ?? "",
    sessionId,
    code: f.code,
    message,
  };
}

function extraDuplicateChecks(
  candidates: InvoiceLockCandidate[],
  hours: HoursEntry[],
  invoices: InvoiceReport[],
): DuplicateBillingDiagnostic[] {
  const diagnostics: DuplicateBillingDiagnostic[] = [];
  const sessionOwners = new Map<string, string>();

  for (const inv of invoices) {
    if (!invoiceBlocksNewBilling(inv.status)) continue;
    for (const h of hours.filter((row) => row.invoiceReportId === (inv.notionPageId ?? inv.id))) {
      if (h.sessionId) sessionOwners.set(h.sessionId, inv.invoiceNumber);
    }
  }

  for (const candidate of candidates) {
    const row = hours.find((h) => h.id === candidate.hoursId);
    if (!row) continue;
    if (!row.sessionId?.trim()) {
      diagnostics.push({
        hoursId: row.id,
        sessionId: null,
        code: "missing-session-id",
        message: "Missing Session ID",
      });
    }
    if (row.billingStatus === "paid") {
      diagnostics.push({
        hoursId: row.id,
        sessionId: row.sessionId ?? null,
        code: "paid-hours",
        message: row.sessionId ? `Paid on ${sessionOwners.get(row.sessionId) ?? "another invoice"}` : "Paid hours cannot be re-invoiced",
      });
    }
    if (isSupersededHours({ migrationKey: row.externalId ?? null, billingStatus: row.billingStatus })) {
      diagnostics.push({
        hoursId: row.id,
        sessionId: row.sessionId ?? null,
        code: "superseded",
        message: "Superseded historical record",
      });
    }
    if (row.sessionId && sessionOwners.has(row.sessionId)) {
      diagnostics.push({
        hoursId: row.id,
        sessionId: row.sessionId,
        code: "duplicate-session-id",
        message: `Session ID already appears on ${sessionOwners.get(row.sessionId)}`,
      });
    }
  }
  return diagnostics;
}

export function buildInvoiceSavePreflight(
  dataset: ReportDataset,
  settings: ReportSettings,
  request: InvoiceSaveRequest,
  existingInvoices: InvoiceReport[],
  allHours: HoursEntry[],
  allWork: WorkLog[],
): InvoiceSavePreflightResult {
  const gatingReasons: string[] = [];
  const client = dataset.clients.find((c) => c.id === request.clientId);
  const report = composeReport(dataset, settings, {
    type: request.type,
    clientId: request.clientId,
    periodStart: request.periodStart,
    periodEnd: request.periodEnd,
    projectIds: request.projectIds,
    invoiceNumber: request.invoiceNumber.trim(),
    invoiceDate: request.invoiceDate,
    paymentTerms: request.paymentTerms,
    dueDate: request.dueDate,
    customTitle: request.customTitle,
    notes: request.notes,
    executiveSummary: request.executiveSummary,
    draftDescriptions: request.draftDescriptions,
  });

  if (!client) gatingReasons.push("Client is required.");
  if (!request.invoiceNumber.trim()) gatingReasons.push("Invoice number is required.");
  if (!request.periodStart || !request.periodEnd || request.periodStart > request.periodEnd) {
    gatingReasons.push("A valid date range is required.");
  }
  const billableSessions = report.sessions.filter((s) => s.billable);
  if (billableSessions.length === 0) gatingReasons.push("At least one billable Hours row must be included.");

  const candidates = buildCandidatesFromReport(report, dataset, request.clientId);
  const lockableInvoices = toLockableInvoices(existingInvoices, allHours);
  const existingByNumber = existingInvoices.find(
    (inv) => inv.invoiceNumber.trim().toLowerCase() === request.invoiceNumber.trim().toLowerCase(),
  );

  const lockPlan = buildInvoiceLockPlan({
    invoiceId: existingByNumber?.notionPageId ?? existingByNumber?.id ?? null,
    clientId: request.clientId,
    candidates,
    hours: allHours.map(toLockableHours),
    workRecords: allWork.map(toLockableWork),
    existingInvoices: lockableInvoices,
  });

  const duplicateConflicts = [
    ...lockPlan.failures.map((f) => formatLockFailure(f, allHours, existingInvoices)),
    ...extraDuplicateChecks(candidates, allHours, existingInvoices),
  ];
  const uniqueConflicts = duplicateConflicts.filter(
    (d, i, arr) => arr.findIndex((x) => x.hoursId === d.hoursId && x.code === d.code) === i,
  );

  if (uniqueConflicts.length > 0) {
    gatingReasons.push(`${uniqueConflicts.length} duplicate-billing or lifecycle conflict(s).`);
  }

  const expectedAmount = roundCurrency(billableSessions.reduce((sum, s) => sum + s.amount, 0));
  if (Math.abs(expectedAmount - report.totals.amountDue) > 0.01) {
    gatingReasons.push("Totals do not reconcile with included billable sessions.");
  }

  const workIds = new Set<string>();
  for (const c of candidates) c.workIds.forEach((id) => workIds.add(id));

  const includedHours = billableSessions.map((s) => {
    const hours = allHours.find((h) => h.id === s.id);
    const excluded = report.excludedRecords.find((r) => r.id === s.id);
    return {
      id: s.id,
      sessionId: hours?.sessionId ?? null,
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      amount: s.amount,
      matchSource: excluded?.matchSource ?? "Explicit",
    };
  });

  const includedWorkDone = [...workIds].map((id) => {
    const w = allWork.find((row) => row.id === id)!;
    return {
      id,
      workLogId: w.workLogId ?? null,
      title: w.title,
      date: w.date,
    };
  });

  const ready =
    gatingReasons.length === 0 &&
    uniqueConflicts.length === 0 &&
    lockPlan.failures.length === 0;

  return {
    readOnly: true,
    writesPerformed: false,
    ready,
    invoiceNumber: request.invoiceNumber.trim(),
    clientId: request.clientId,
    clientName: client?.name ?? "",
    includedHours,
    includedWorkDone,
    totals: {
      billableMinutes: report.totals.billableMinutes,
      nonBillableMinutes: report.totals.nonBillableMinutes,
      billableHours: roundCurrency(report.totals.billableMinutes / 60),
      amount: report.totals.amountDue,
    },
    duplicateConflicts: uniqueConflicts,
    lifecycleConflicts: uniqueConflicts.filter((d) =>
      ["already-invoiced", "paid-hours", "superseded", "conflicting-relation", "tied-to-other-invoice"].includes(d.code),
    ),
    lockPlan,
    gatingReasons,
    saveEnabled: isInvoiceSaveEnabled(),
  };
}

export function buildInvoiceSavePlan(
  dataset: ReportDataset,
  settings: ReportSettings,
  request: InvoiceSaveRequest,
  existingInvoices: InvoiceReport[],
  allHours: HoursEntry[],
  allWork: WorkLog[],
): InvoiceSavePlan {
  const preflight = buildInvoiceSavePreflight(
    dataset,
    settings,
    request,
    existingInvoices,
    allHours,
    allWork,
  );
  const report = composeReport(dataset, settings, {
    type: request.type,
    clientId: request.clientId,
    periodStart: request.periodStart,
    periodEnd: request.periodEnd,
    projectIds: request.projectIds,
    invoiceNumber: request.invoiceNumber.trim(),
    invoiceDate: request.invoiceDate,
    paymentTerms: request.paymentTerms,
    dueDate: request.dueDate,
    customTitle: request.customTitle,
    notes: request.notes,
    executiveSummary: request.executiveSummary,
    draftDescriptions: request.draftDescriptions,
  });

  const existingByNumber = existingInvoices.find(
    (inv) => inv.invoiceNumber.trim().toLowerCase() === request.invoiceNumber.trim().toLowerCase(),
  );

  const workDoneIds = [...new Set(preflight.lockPlan.proposedRelations.invoiceToWorkDone)];
  const hourlyRates = [...new Set(report.sessions.filter((s) => s.billable).map((s) => s.hourlyRate))];

  const invoicePayload = {
    clientId: request.clientId,
    invoiceNumber: request.invoiceNumber.trim(),
    periodStart: request.periodStart,
    periodEnd: request.periodEnd,
    hourlyRate: hourlyRates[0] ?? dataset.clients[0]?.defaultHourlyRate ?? 30,
    totalHours: roundCurrency(preflight.totals.billableMinutes / 60),
    totalAmount: preflight.totals.amount,
    summary: report.summary,
    lineItems: [],
    hoursEntryIds: preflight.lockPlan.proposedRelations.invoiceToHours,
    workDoneIds,
    status: "draft" as const,
    invoiceDate: request.invoiceDate,
    dueDate: request.dueDate,
    paymentTerms: request.paymentTerms,
    pdfUrl: request.pdfUrl?.trim() || null,
  };

  const writeSteps: InvoiceSaveWriteStep[] = [];
  if (existingByNumber?.notionPageId ?? existingByNumber?.id) {
    writeSteps.push({
      phase: "link-invoice-relations",
      label: `Resolve existing invoice ${request.invoiceNumber}`,
      invoiceId: existingByNumber!.notionPageId ?? existingByNumber!.id,
    });
  } else {
    writeSteps.push({ phase: "create-invoice", label: `Create invoice ${request.invoiceNumber}` });
  }
  for (const hoursId of preflight.lockPlan.proposedRelations.invoiceToHours) {
    writeSteps.push({ phase: "lock-hours", label: `Lock hours ${hoursId}`, hoursId });
  }
  for (const workId of workDoneIds) {
    writeSteps.push({ phase: "link-work", label: `Link work ${workId}`, workId });
  }

  return {
    preflight,
    invoicePayload: { ...invoicePayload, workDoneIds },
    existingInvoiceId: existingByNumber?.notionPageId ?? existingByNumber?.id ?? null,
    writeSteps,
  };
}

/** Apply is implemented for tests/mocks; live path refuses unless NOTION_INVOICE_SAVE_ENABLED=true. */
export function assertInvoiceSaveAllowed(confirmationPhrase?: string): void {
  if (!isInvoiceSaveEnabled()) {
    throw new Error("Live invoice save is disabled (NOTION_INVOICE_SAVE_ENABLED is not true).");
  }
  if (confirmationPhrase !== INVOICE_SAVE_CONFIRMATION_PHRASE) {
    throw new Error(`Confirmation phrase must be exactly "${INVOICE_SAVE_CONFIRMATION_PHRASE}".`);
  }
  if (process.env.NOTION_SYNC_ENABLED === "true") {
    throw new Error("Refusing invoice save while NOTION_SYNC_ENABLED=true.");
  }
}
