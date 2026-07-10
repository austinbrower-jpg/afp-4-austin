import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import {
  workspaceRepo,
  clientRepo,
  projectRepo,
  hoursRepo,
  workLogRepo,
  knowledgeRepo,
  invoiceRepo,
} from "@/lib/db";
import {
  entriesToday,
  entriesInRange,
  getWeekRange,
  getMonthRange,
  sumHours,
  sumBillableAmount,
  todayISO,
} from "@/lib/calculations";
import type { DashboardSummary } from "@/types/api";
import type { Priority, WorkLog } from "@/types/domain";

const PRIORITY_RANK: Record<Priority, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export async function GET() {
  initDb();

  const workspace = workspaceRepo.all()[0] ?? null;
  const client = clientRepo.all()[0] ?? null;

  const allHours = client
    ? hoursRepo.where("client_id = ?", [client.id], "date DESC, start_time DESC")
    : [];

  const todayHours = sumHours(entriesToday(allHours));
  const { start: weekStart, end: weekEnd } = getWeekRange();
  const weekHours = sumHours(entriesInRange(allHours, weekStart, weekEnd));
  const { start: monthStart, end: monthEnd } = getMonthRange();
  const monthHours = sumHours(entriesInRange(allHours, monthStart, monthEnd));

  const currentHourlyRate = client?.defaultHourlyRate ?? 0;

  // "Current invoice amount" is an unbilled-so-far estimate: the billable amount
  // for every hours entry dated after the most recent invoice's periodEnd. If no
  // invoice has been generated yet, every recorded hours entry is treated as
  // unbilled. This is a running estimate, not a finalized invoice total.
  const invoices = client
    ? invoiceRepo.where("client_id = ?", [client.id], "period_end DESC")
    : [];
  const latestInvoice = invoices[0] ?? null;
  const unbilledEntries = latestInvoice
    ? allHours.filter((h) => h.date > latestInvoice.periodEnd)
    : allHours;
  const currentInvoiceAmount = sumBillableAmount(unbilledEntries);

  // Active project: the active-status project with the most recent hours entry;
  // falls back to the most-recently-updated active project if none has hours yet.
  const activeProjects = projectRepo.where("status = ?", ["active"], "updated_at DESC");
  let activeProject = activeProjects[0] ?? null;
  let bestHoursDate: string | null = null;
  for (const project of activeProjects) {
    const latest = allHours.find((h) => h.projectId === project.id);
    if (latest && (!bestHoursDate || latest.date > bestHoursDate)) {
      bestHoursDate = latest.date;
      activeProject = project;
    }
  }

  const recentWorkEntries = client
    ? workLogRepo.where("client_id = ?", [client.id], "date DESC").slice(0, 5)
    : [];

  const recentNotes = knowledgeRepo.all("updated_at DESC").slice(0, 5);

  const upcomingTasks: WorkLog[] = (
    client ? workLogRepo.where("client_id = ? AND status != ?", [client.id, "done"]) : []
  )
    .sort((a, b) => {
      const rankDiff = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
      if (rankDiff !== 0) return rankDiff;
      return a.date.localeCompare(b.date);
    })
    .slice(0, 5);

  const payload: DashboardSummary = {
    workspaceName: workspace?.name ?? null,
    client,
    today: { hours: todayHours, date: todayISO() },
    week: {
      hours: weekHours,
      start: weekStart.toISOString().slice(0, 10),
      end: weekEnd.toISOString().slice(0, 10),
    },
    month: {
      hours: monthHours,
      start: monthStart.toISOString().slice(0, 10),
      end: monthEnd.toISOString().slice(0, 10),
    },
    currentHourlyRate,
    currentInvoiceAmount,
    unbilledSince: latestInvoice?.periodEnd ?? null,
    activeProject,
    recentWorkEntries,
    recentNotes,
    upcomingTasks,
  };

  return NextResponse.json(payload);
}
