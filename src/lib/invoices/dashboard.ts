import type { Client, HoursEntry, InvoiceReport, WorkLog } from "@/types/domain";
import { exactElapsedMinutes, roundCurrency } from "@/lib/reports/engine";

export interface InvoiceDashboardSummary {
  byStatus: Record<InvoiceReport["status"], number>;
  revenueThisMonth: number;
  revenueYtd: number;
  outstandingInvoices: number;
  outstandingBalance: number;
  averagePaymentTimeDays: number | null;
  totalBillableHours: number;
}

export interface ClientBillingHistory {
  clientId: string;
  clientName: string;
  invoices: InvoiceReport[];
  hoursBilled: number;
  workLogs: WorkLog[];
  totalRevenue: number;
  averageHourlyRate: number;
  outstandingBalance: number;
  lastInvoiceDate: string | null;
}

export interface InvoiceDashboardData {
  summary: InvoiceDashboardSummary;
  clients: ClientBillingHistory[];
}

export interface InvoiceDashboardLoadResult {
  data: InvoiceDashboardData;
  skipped: {
    clients: number;
    invoices: number;
    hours: number;
    workLogs: number;
  };
}

const INVOICE_STATUSES = new Set<InvoiceReport["status"]>(["draft", "sent", "paid", "void"]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  return !Number.isNaN(Date.parse(`${value}T12:00:00Z`));
}

function uniqueValid<T extends { id: string }>(rows: readonly T[], valid: (row: T) => boolean): T[] {
  const unique = new Map<string, T>();
  for (const row of rows) {
    if (!row || typeof row.id !== "string" || !row.id || !valid(row) || unique.has(row.id)) continue;
    unique.set(row.id, row);
  }
  return [...unique.values()];
}

function validClient(client: Client): boolean {
  return typeof client.name === "string" && typeof client.id === "string";
}

function validInvoice(invoice: InvoiceReport): boolean {
  return (
    typeof invoice.clientId === "string" &&
    validDate(invoice.periodEnd) &&
    Number.isFinite(invoice.totalAmount) &&
    INVOICE_STATUSES.has(invoice.status)
  );
}

function validHoursEntry(entry: HoursEntry): boolean {
  return (
    typeof entry.clientId === "string" &&
    validDate(entry.date) &&
    typeof entry.startTime === "string" &&
    typeof entry.endTime === "string" &&
    Number.isFinite(entry.breakMinutes) &&
    Number.isFinite(entry.hourlyRate)
  );
}

function validWorkLog(workLog: WorkLog): boolean {
  return typeof workLog.clientId === "string" && validDate(workLog.date);
}

function hoursForEntry(entry: HoursEntry): number {
  if (Number.isFinite(entry.totalHours) && entry.totalHours > 0) return entry.totalHours;
  return exactElapsedMinutes(entry.startTime, entry.endTime, entry.breakMinutes) / 60;
}

export function summarizeInvoiceDashboard(
  invoices: readonly InvoiceReport[],
  hours: readonly HoursEntry[],
  today = new Date().toISOString().slice(0, 10),
): InvoiceDashboardSummary {
  const month = today.slice(0, 7);
  const year = today.slice(0, 4);
  const paid = invoices.filter((invoice) => invoice.status === "paid");
  const paymentDays = paid
    .map((invoice) => {
      if (!validDate(invoice.sentDate) || !validDate(invoice.paidDate)) return null;
      const days = (Date.parse(invoice.paidDate) - Date.parse(invoice.sentDate)) / 86_400_000;
      return Number.isFinite(days) && days >= 0 ? days : null;
    })
    .filter((value): value is number => value !== null);
  const paidOn = (invoice: InvoiceReport) =>
    (validDate(invoice.paidDate) && invoice.paidDate) ||
    (validDate(invoice.invoiceDate) && invoice.invoiceDate) ||
    invoice.periodEnd;
  const outstanding = invoices.filter((invoice) => invoice.status === "sent" || invoice.status === "draft");
  const totalBillableHours = hours
    .filter((entry) => entry.billable)
    .reduce((total, entry) => total + hoursForEntry(entry), 0);

  return {
    byStatus: {
      draft: invoices.filter((invoice) => invoice.status === "draft").length,
      sent: invoices.filter((invoice) => invoice.status === "sent").length,
      paid: paid.length,
      void: invoices.filter((invoice) => invoice.status === "void").length,
    },
    revenueThisMonth: roundCurrency(
      paid.filter((invoice) => paidOn(invoice).slice(0, 7) === month)
        .reduce((total, invoice) => total + invoice.totalAmount, 0),
    ),
    revenueYtd: roundCurrency(
      paid.filter((invoice) => paidOn(invoice).slice(0, 4) === year)
        .reduce((total, invoice) => total + invoice.totalAmount, 0),
    ),
    outstandingInvoices: outstanding.length,
    outstandingBalance: roundCurrency(
      outstanding.reduce((total, invoice) => total + invoice.totalAmount, 0),
    ),
    averagePaymentTimeDays: paymentDays.length
      ? Math.round((paymentDays.reduce((total, days) => total + days, 0) / paymentDays.length) * 10) / 10
      : null,
    totalBillableHours: Math.round(totalBillableHours * 100) / 100,
  };
}

export function buildClientBillingHistory(
  clients: readonly Client[],
  invoices: readonly InvoiceReport[],
  hours: readonly HoursEntry[],
  workLogs: readonly WorkLog[],
): ClientBillingHistory[] {
  return clients.map((client) => {
    const clientInvoices = invoices
      .filter((invoice) => invoice.clientId === client.id)
      .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));
    const clientHours = hours.filter((entry) => entry.clientId === client.id && entry.billable);
    const hoursBilled = clientHours.reduce((total, entry) => total + hoursForEntry(entry), 0);
    const billed = clientHours.reduce(
      (total, entry) => total + hoursForEntry(entry) * entry.hourlyRate,
      0,
    );

    return {
      clientId: client.id,
      clientName: client.name,
      invoices: clientInvoices,
      hoursBilled: Math.round(hoursBilled * 100) / 100,
      workLogs: workLogs.filter((workLog) => workLog.clientId === client.id),
      totalRevenue: roundCurrency(
        clientInvoices.filter((invoice) => invoice.status === "paid")
          .reduce((total, invoice) => total + invoice.totalAmount, 0),
      ),
      averageHourlyRate: hoursBilled ? roundCurrency(billed / hoursBilled) : 0,
      outstandingBalance: roundCurrency(
        clientInvoices.filter((invoice) => invoice.status === "sent" || invoice.status === "draft")
          .reduce((total, invoice) => total + invoice.totalAmount, 0),
      ),
      lastInvoiceDate: clientInvoices
        .map((invoice) => (validDate(invoice.invoiceDate) ? invoice.invoiceDate : invoice.periodEnd))
        .sort()
        .at(-1) ?? null,
    };
  });
}

export function buildInvoiceDashboardData(
  clients: readonly Client[],
  invoices: readonly InvoiceReport[],
  hours: readonly HoursEntry[],
  workLogs: readonly WorkLog[],
  today?: string,
): InvoiceDashboardLoadResult {
  const validClients = uniqueValid(clients, validClient);
  const validInvoices = uniqueValid(invoices, validInvoice);
  const validHours = uniqueValid(hours, validHoursEntry);
  const validWorkLogs = uniqueValid(workLogs, validWorkLog);

  return {
    data: {
      summary: summarizeInvoiceDashboard(validInvoices, validHours, today),
      clients: buildClientBillingHistory(validClients, validInvoices, validHours, validWorkLogs),
    },
    skipped: {
      clients: clients.length - validClients.length,
      invoices: invoices.length - validInvoices.length,
      hours: hours.length - validHours.length,
      workLogs: workLogs.length - validWorkLogs.length,
    },
  };
}
