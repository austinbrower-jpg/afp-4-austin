import type { Client, HoursEntry, InvoiceReport, Project, WorkLog } from "@/types/domain";
export interface InvoiceSearchIndex { clients: readonly Client[]; projects: readonly Project[]; hours: readonly HoursEntry[]; workLogs: readonly WorkLog[]; }
const includes = (value: unknown, term: string) => String(value ?? "").toLowerCase().includes(term);
export function searchInvoices(invoices: readonly InvoiceReport[], index: InvoiceSearchIndex, query: string): InvoiceReport[] {
  const term = query.trim().toLowerCase(); if (!term) return [...invoices];
  return invoices.filter((invoice) => {
    const client = index.clients.find((c) => c.id === invoice.clientId);
    const relatedHours = index.hours.filter((h) => invoice.hoursEntryIds.includes(h.id));
    const relatedWork = index.workLogs.filter((w) => invoice.workDoneIds?.includes(w.id) || invoice.lineItems.some((li) => li.workLogId === w.id));
    const projectIds = new Set([...relatedHours.map(h=>h.projectId), ...relatedWork.map(w=>w.projectId)].filter(Boolean));
    const projects = index.projects.filter((p) => projectIds.has(p.id));
    return [invoice.invoiceNumber, invoice.periodStart, invoice.periodEnd, invoice.invoiceDate, invoice.summary, client?.name, ...projects.map(p=>p.name), ...relatedHours.map(h=>h.sessionId ?? h.id), ...relatedWork.map(w=>w.workLogId ?? w.id)].some((v) => includes(v, term));
  });
}
