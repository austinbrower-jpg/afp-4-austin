/**
 * Invoice locking design — read-only architecture for explicit invoice relations.
 * No live Notion writes during preview/export.
 */

import type { HoursBillingStatus } from "@/lib/notion/quarantine";
import { isSupersededHours } from "@/lib/notion/quarantine";

export type InvoiceLifecycleStatus =
  | "draft"
  | "generated"
  | "sent"
  | "paid"
  | "overdue"
  | "cancelled";

export interface LockableHours {
  id: string;
  billingStatus?: HoursBillingStatus | string | null;
  migrationKey?: string | null;
  externalId?: string | null;
  billable: boolean;
  invoiceReportId?: string | null;
}

export interface LockableWork {
  id: string;
  clientVisible?: boolean | null;
  includeInInvoice?: boolean | null;
  approvalStatus?: string | null;
  internalNotes?: string;
}

export interface LockableInvoice {
  id: string;
  status: InvoiceLifecycleStatus | string;
  clientId: string;
  includedHoursIds: string[];
  includedWorkDoneIds: string[];
}

export interface InvoiceLockCandidate {
  hoursId: string;
  workIds: string[];
}

export interface InvoiceLockFailure {
  hoursId?: string;
  workId?: string;
  code:
    | "superseded"
    | "non-billable"
    | "already-invoiced"
    | "tied-to-other-invoice"
    | "work-not-approved"
    | "work-not-visible"
    | "work-not-included"
    | "missing-relation";
  message: string;
}

export interface InvoiceLockPlan {
  invoiceId: string | null;
  candidates: InvoiceLockCandidate[];
  failures: InvoiceLockFailure[];
  /** Hours that would receive Billing Status = Invoiced on explicit save only */
  hoursToMarkInvoiced: string[];
  /** Proposed relation updates — never applied during preview */
  proposedRelations: {
    invoiceToClient: string | null;
    invoiceToHours: string[];
    invoiceToWorkDone: string[];
    hoursToInvoice: Array<{ hoursId: string; invoiceId: string }>;
  };
  idempotent: boolean;
  partialFailure: boolean;
}

function normalizeInvoiceStatus(status: string): string {
  return status.toLowerCase().replace(/\s+/g, "-");
}

export function isCancelledInvoice(status: string): boolean {
  return normalizeInvoiceStatus(status) === "cancelled";
}

export function isLockedBillingStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  const normalized = normalizeInvoiceStatus(status);
  return normalized === "invoiced" || normalized === "paid";
}

export function hoursTiedToOtherInvoice(
  hours: LockableHours,
  targetInvoiceId: string | null,
  invoices: readonly LockableInvoice[],
): LockableInvoice | null {
  if (!hours.invoiceReportId) return null;
  if (targetInvoiceId && hours.invoiceReportId === targetInvoiceId) return null;
  const owner = invoices.find((inv) => inv.id === hours.invoiceReportId);
  if (!owner || isCancelledInvoice(owner.status)) return null;
  return owner;
}

export interface BuildInvoiceLockPlanInput {
  invoiceId: string | null;
  clientId: string;
  candidates: InvoiceLockCandidate[];
  hours: readonly LockableHours[];
  workRecords: readonly LockableWork[];
  existingInvoices: readonly LockableInvoice[];
  /** When viewing an existing invoice, allow its already-invoiced hours */
  viewingInvoiceId?: string | null;
}

export function buildInvoiceLockPlan(input: BuildInvoiceLockPlanInput): InvoiceLockPlan {
  const failures: InvoiceLockFailure[] = [];
  const hoursToMarkInvoiced: string[] = [];
  const invoiceToHours: string[] = [];
  const invoiceToWorkDone: string[] = [];
  const hoursToInvoice: Array<{ hoursId: string; invoiceId: string }> = [];
  const hoursById = new Map(input.hours.map((h) => [h.id, h]));
  const workById = new Map(input.workRecords.map((w) => [w.id, w]));

  for (const candidate of input.candidates) {
    const hours = hoursById.get(candidate.hoursId);
    if (!hours) {
      failures.push({
        hoursId: candidate.hoursId,
        code: "missing-relation",
        message: "Hours record not found",
      });
      continue;
    }

    if (isSupersededHours(hours)) {
      failures.push({
        hoursId: hours.id,
        code: "superseded",
        message: "Superseded hours cannot be invoiced",
      });
      continue;
    }

    if (!hours.billable) {
      failures.push({
        hoursId: hours.id,
        code: "non-billable",
        message: "Non-billable hours cannot be invoiced",
      });
      continue;
    }

    const viewing = input.viewingInvoiceId && hours.invoiceReportId === input.viewingInvoiceId;
    if (!viewing && isLockedBillingStatus(hours.billingStatus ?? null)) {
      failures.push({
        hoursId: hours.id,
        code: "already-invoiced",
        message: `Hours already marked ${hours.billingStatus}`,
      });
      continue;
    }

    const otherInvoice = hoursTiedToOtherInvoice(hours, input.invoiceId, input.existingInvoices);
    if (!viewing && otherInvoice) {
      failures.push({
        hoursId: hours.id,
        code: "tied-to-other-invoice",
        message: `Hours tied to invoice ${otherInvoice.id} (${otherInvoice.status})`,
      });
      continue;
    }

    if (candidate.workIds.length === 0) {
      failures.push({
        hoursId: hours.id,
        code: "missing-relation",
        message: "No linked Work Done for invoice inclusion",
      });
      continue;
    }

    let workOk = true;
    for (const workId of candidate.workIds) {
      const work = workById.get(workId);
      if (!work) {
        failures.push({ hoursId: hours.id, workId, code: "missing-relation", message: "Work Done not found" });
        workOk = false;
        continue;
      }
      if (work.clientVisible !== true) {
        failures.push({ hoursId: hours.id, workId, code: "work-not-visible", message: "Client Visible is not enabled" });
        workOk = false;
      }
      if (work.includeInInvoice !== true) {
        failures.push({ hoursId: hours.id, workId, code: "work-not-included", message: "Include in Invoice is not enabled" });
        workOk = false;
      }
      const approval = work.approvalStatus?.toLowerCase() ?? "";
      if (approval !== "approved" && approval !== "sent to client") {
        failures.push({ hoursId: hours.id, workId, code: "work-not-approved", message: "Work Done is not approved" });
        workOk = false;
      }
    }

    if (!workOk) continue;

    invoiceToHours.push(hours.id);
    hoursToMarkInvoiced.push(hours.id);
    if (input.invoiceId) {
      hoursToInvoice.push({ hoursId: hours.id, invoiceId: input.invoiceId });
    }
    for (const workId of candidate.workIds) {
      if (!invoiceToWorkDone.includes(workId)) invoiceToWorkDone.push(workId);
    }
  }

  const failedHours = new Set(failures.map((f) => f.hoursId).filter(Boolean));
  const successfulCandidates = input.candidates.filter((c) => !failedHours.has(c.hoursId));

  return {
    invoiceId: input.invoiceId,
    candidates: successfulCandidates,
    failures,
    hoursToMarkInvoiced,
    proposedRelations: {
      invoiceToClient: input.clientId,
      invoiceToHours,
      invoiceToWorkDone,
      hoursToInvoice,
    },
    idempotent: failures.length === 0,
    partialFailure: failures.length > 0 && successfulCandidates.length > 0,
  };
}

/** Retry-safe: same input produces the same lock plan. */
export function isIdempotentRetry(plan: InvoiceLockPlan, previousPlan: InvoiceLockPlan): boolean {
  const sort = (arr: string[]) => [...arr].sort().join(",");
  return (
    sort(plan.hoursToMarkInvoiced) === sort(previousPlan.hoursToMarkInvoiced) &&
    sort(plan.proposedRelations.invoiceToHours) === sort(previousPlan.proposedRelations.invoiceToHours) &&
    sort(plan.proposedRelations.invoiceToWorkDone) === sort(previousPlan.proposedRelations.invoiceToWorkDone)
  );
}

/** Internal Notes must never appear in export payloads. */
export function stripInternalNotes<T extends { internalNotes?: string }>(record: T): Omit<T, "internalNotes"> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- intentionally omitted from exports
  const { internalNotes, ...rest } = record;
  return rest;
}
