import type { InvoiceReport } from "@/types/domain";
export type InvoiceTimelineEventType = "created" | "saved" | "sent" | "viewed" | "paid" | "voided";
export interface InvoiceTimelineEvent { type: InvoiceTimelineEventType; label: string; at: string | null; status: "complete" | "future"; }
export function buildInvoiceTimeline(invoice: InvoiceReport): InvoiceTimelineEvent[] {
  const savedAt = invoice.notionPageId ? invoice.updatedAt : null;
  return [
    { type: "created", label: "Created", at: invoice.createdAt, status: "complete" },
    { type: "saved", label: "Saved", at: savedAt, status: savedAt ? "complete" : "future" },
    { type: "sent", label: "Sent", at: invoice.sentDate ?? null, status: invoice.sentDate ? "complete" : "future" },
    { type: "viewed", label: "Viewed", at: null, status: "future" },
    { type: "paid", label: "Paid", at: invoice.paidDate ?? null, status: invoice.paidDate ? "complete" : "future" },
    { type: "voided", label: "Voided", at: invoice.status === "void" ? invoice.updatedAt : null, status: invoice.status === "void" ? "complete" : "future" },
  ];
}
