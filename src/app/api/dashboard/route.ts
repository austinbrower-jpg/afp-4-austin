import { NextResponse } from "next/server";
import { getDataProvider } from "@/lib/data/provider";
import { dataErrorResponse, NO_STORE_HEADERS } from "@/lib/data/route-utils";
import { entriesInRange, entriesToday, getMonthRange, getWeekRange, operationalHours, sumBillableAmount, sumHours, todayISO } from "@/lib/calculations";
import { roundCurrency } from "@/lib/reports/engine";
import type { DashboardSummary } from "@/types/api";
import type { Priority } from "@/types/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const PRIORITY: Record<Priority, number> = { urgent: 4, high: 3, medium: 2, low: 1 };

export async function GET() {
  try {
    const provider = await getDataProvider();
    const knowledgeForSummary = provider.knowledgeForReporting
      ? provider.knowledgeForReporting()
      : provider.knowledge.list();
    const [workspace, clients, projects, hours, workLogs, knowledge, invoices] = await Promise.all([
      provider.workspace(), provider.clients.list(), provider.projects.list(), provider.hours.list(), provider.workLogs.list(), knowledgeForSummary, provider.invoices.list(),
    ]);
    const client = clients[0] ?? null;
    const clientHours = operationalHours(client ? hours.filter((entry) => entry.clientId === client.id) : hours);
    const clientInvoices = client ? invoices.filter((entry) => entry.clientId === client.id) : invoices;
    const clientProjects = client ? projects.filter((entry) => entry.clientId === client.id) : projects;
    const week = getWeekRange();
    const month = getMonthRange();
    const latestInvoice = invoices.sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))[0] ?? null;
    const unbilled = latestInvoice ? clientHours.filter((entry) => entry.date > latestInvoice.periodEnd) : clientHours;
    const activeProjects = projects.filter((project) => project.status === "active");
    const activeProject = activeProjects.sort((a, b) => {
      const aDate = clientHours.find((entry) => entry.projectId === a.id)?.date ?? a.updatedAt;
      const bDate = clientHours.find((entry) => entry.projectId === b.id)?.date ?? b.updatedAt;
      return bDate.localeCompare(aDate);
    })[0] ?? null;
    const recentWorkEntries = workLogs.filter((entry) => !client || entry.clientId === client.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
    const upcomingTasks = workLogs.filter((entry) => entry.status !== "done").sort((a, b) => PRIORITY[b.priority] - PRIORITY[a.priority] || a.date.localeCompare(b.date)).slice(0, 5);
    const invoicedStatuses = new Set(["sent", "paid"]);
    const outstandingStatuses = new Set(["sent", "draft"]);
    const alreadyInvoicedList = clientInvoices.filter((entry) => invoicedStatuses.has(entry.status));
    const outstandingList = clientInvoices.filter((entry) => outstandingStatuses.has(entry.status));
    const payload: DashboardSummary = {
      workspaceName: workspace?.name ?? null,
      client,
      today: { hours: sumHours(entriesToday(clientHours)), date: todayISO() },
      week: { hours: sumHours(entriesInRange(clientHours, week.start, week.end)), start: week.start.toISOString().slice(0, 10), end: week.end.toISOString().slice(0, 10) },
      month: { hours: sumHours(entriesInRange(clientHours, month.start, month.end)), start: month.start.toISOString().slice(0, 10), end: month.end.toISOString().slice(0, 10) },
      currentHourlyRate: client?.defaultHourlyRate ?? 0,
      currentInvoiceAmount: sumBillableAmount(unbilled),
      unbilledSince: latestInvoice?.periodEnd ?? null,
      activeProject,
      recentWorkEntries,
      recentNotes: knowledge.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5),
      upcomingTasks,
      readyToInvoice: { hours: sumHours(unbilled), amount: sumBillableAmount(unbilled) },
      alreadyInvoiced: { count: alreadyInvoicedList.length, amount: roundCurrency(alreadyInvoicedList.reduce((sum, entry) => sum + entry.totalAmount, 0)) },
      outstanding: { count: outstandingList.length, amount: roundCurrency(outstandingList.reduce((sum, entry) => sum + entry.totalAmount, 0)) },
      recentInvoices: [...clientInvoices].sort((a, b) => (b.invoiceDate ?? b.periodEnd).localeCompare(a.invoiceDate ?? a.periodEnd)).slice(0, 5),
      recentProjects: [...clientProjects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5),
    };
    return NextResponse.json(payload, { headers: NO_STORE_HEADERS });
  } catch (error) { return dataErrorResponse(error); }
}
