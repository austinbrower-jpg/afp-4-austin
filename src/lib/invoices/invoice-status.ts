/**
 * Invoice Reports.Status mapping between live Notion legacy values and app behavior.
 * Does not mutate the live select schema.
 */

export type NotionLegacyInvoiceStatus = "draft" | "sent" | "paid" | "void";

export type AppInvoiceStatus = "draft" | "sent" | "paid" | "void";

/** Normalized lifecycle key used for lock/edit rules. */
export function normalizeInvoiceStatus(status: string | null | undefined): string {
  return (status ?? "draft").toLowerCase().replace(/\s+/g, "-");
}

export function toNotionLegacyStatus(status: AppInvoiceStatus): NotionLegacyInvoiceStatus {
  return status;
}

export function fromNotionLegacyStatus(status: string | null | undefined): AppInvoiceStatus {
  const normalized = normalizeInvoiceStatus(status);
  if (normalized === "sent") return "sent";
  if (normalized === "paid") return "paid";
  if (normalized === "void" || normalized === "cancelled") return "void";
  return "draft";
}

/** draft — metadata saved; hours marked Invoiced; editable via explicit update flow */
export function isDraftInvoice(status: string): boolean {
  return normalizeInvoiceStatus(status) === "draft";
}

/** sent — locked from ordinary edits */
export function isSentInvoice(status: string): boolean {
  return normalizeInvoiceStatus(status) === "sent";
}

/** paid — fully locked */
export function isPaidInvoice(status: string): boolean {
  return normalizeInvoiceStatus(status) === "paid";
}

/** void — historical; hours may become eligible again only via explicit reviewed unlock (not auto) */
export function isVoidInvoice(status: string): boolean {
  const n = normalizeInvoiceStatus(status);
  return n === "void" || n === "cancelled";
}

export function invoiceAllowsOrdinaryEdit(status: string): boolean {
  return isDraftInvoice(status);
}

export function invoiceIsFullyLocked(status: string): boolean {
  return isPaidInvoice(status);
}

export function invoiceBlocksNewBilling(status: string): boolean {
  return !isVoidInvoice(status);
}

export const INVOICE_STATUS_BEHAVIOR = {
  draft: "Invoice metadata saved; included Hours linked and marked Invoiced; may still be edited through explicit update flow.",
  sent: "Locked from ordinary edits.",
  paid: "Fully locked.",
  void: "Invoice remains historical. Included Hours may become eligible again only through an explicit reviewed unlock flow (not implemented in Phase 13).",
} as const;
