import type { InvoiceReport, InvoiceStatus } from "@/types/domain";
export const relationIds = (property: { relation?: { id: string }[] } | undefined) => property?.relation?.map((r)=>r.id) ?? [];
export const firstRelationId = (property: { relation?: { id: string }[] } | undefined) => relationIds(property)[0] ?? null;
export function normalizeInvoiceStatus(value: string | null | undefined): InvoiceStatus { const v=(value??"").toLowerCase(); return v==="sent"||v==="paid"||v==="void"||v==="voided" ? (v==="voided"?"void":v) : "draft"; }
export const toNotionDate = (date: string | null | undefined) => date ? { start: date } : null;
export const fromNotionDate = (property: { date?: { start?: string | null } | null } | undefined) => property?.date?.start ?? null;
export const findClientByName = <T extends { name: string }>(clients: readonly T[], name: string) => clients.find((c)=>c.name.toLowerCase()===name.trim().toLowerCase()) ?? null;
export function serializeInvoiceForNotion(invoice: InvoiceReport) { return { invoiceNumber: invoice.invoiceNumber, status: invoice.status, periodStart: invoice.periodStart, periodEnd: invoice.periodEnd, totalHours: invoice.totalHours, totalAmount: invoice.totalAmount, hoursEntryIds: invoice.hoursEntryIds, workDoneIds: invoice.workDoneIds ?? [] }; }
