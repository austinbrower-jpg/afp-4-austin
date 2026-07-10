import { NextRequest, NextResponse } from "next/server";
import { initDb, newId, newSyncable, nowISO } from "@/lib/db";
import { hoursRepo, listHoursByRange } from "@/lib/db/repositories/hours";
import { projectRepo } from "@/lib/db/repositories/projects";
import { workLogRepo } from "@/lib/db/repositories/worklogs";
import { workspaceRepo } from "@/lib/db/repositories/workspaces";
import { clientRepo } from "@/lib/db/repositories/clients";
import { computeTotalHours, todayISO, nowTimeHHMM } from "@/lib/calculations";
import { syncEntityNow } from "@/lib/notion/sync-engine";
import type { HoursEntry } from "@/types/domain";
import type { HoursEntryWithRelations } from "@/types/api";

/** Attach project name / related work log title so the table never shows raw ids. */
function withRelations(entries: HoursEntry[]): HoursEntryWithRelations[] {
  const projectMap = new Map(projectRepo.all().map((p) => [p.id, p.name]));
  const workLogMap = new Map(workLogRepo.all().map((w) => [w.id, w.title]));
  return entries.map((e) => ({
    ...e,
    projectName: e.projectId ? (projectMap.get(e.projectId) ?? null) : null,
    workLogTitle: e.relatedWorkLogId ? (workLogMap.get(e.relatedWorkLogId) ?? null) : null,
  }));
}

/**
 * GET /api/hours            -> all hours entries for the current client
 * GET /api/hours?start=&end= -> entries with date in [start, end] (inclusive, YYYY-MM-DD)
 */
export async function GET(request: NextRequest) {
  initDb();
  const client = clientRepo.all()[0];
  if (!client) return NextResponse.json<HoursEntryWithRelations[]>([]);

  const start = request.nextUrl.searchParams.get("start");
  const end = request.nextUrl.searchParams.get("end");

  const entries =
    start && end
      ? listHoursByRange(client.id, start, end)
      : hoursRepo.where("client_id = ?", [client.id], "date DESC, start_time DESC");

  return NextResponse.json<HoursEntryWithRelations[]>(withRelations(entries));
}

/** POST /api/hours - create a new hours entry (manual or timer-sourced). */
export async function POST(request: NextRequest) {
  initDb();
  const workspace = workspaceRepo.all()[0];
  const client = clientRepo.all()[0];
  if (!workspace || !client) {
    return NextResponse.json({ error: "No workspace/client configured" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));

  const startTime: string = typeof body.startTime === "string" && body.startTime ? body.startTime : nowTimeHHMM();
  const endTime: string = typeof body.endTime === "string" && body.endTime ? body.endTime : startTime;
  const breakMinutes = Number.isFinite(Number(body.breakMinutes)) ? Math.max(0, Number(body.breakMinutes)) : 0;

  // Never trust a client-submitted totalHours - always derive it server-side.
  const totalHours = computeTotalHours(startTime, endTime, breakMinutes);

  const now = nowISO();
  const entry: HoursEntry = {
    id: newId("hr"),
    workspaceId: workspace.id,
    clientId: client.id,
    projectId: typeof body.projectId === "string" && body.projectId ? body.projectId : null,
    date: typeof body.date === "string" && body.date ? body.date : todayISO(),
    startTime,
    endTime,
    breakMinutes,
    totalHours,
    hourlyRate: Number.isFinite(Number(body.hourlyRate)) ? Number(body.hourlyRate) : client.defaultHourlyRate,
    billable: body.billable === undefined ? true : Boolean(body.billable),
    location: typeof body.location === "string" ? body.location : "",
    relatedWorkLogId: typeof body.relatedWorkLogId === "string" && body.relatedWorkLogId ? body.relatedWorkLogId : null,
    notes: typeof body.notes === "string" ? body.notes : "",
    source: body.source === "timer" ? "timer" : "manual",
    ...newSyncable(),
    createdAt: now,
    updatedAt: now,
  };

  hoursRepo.insert(entry);
  await syncEntityNow("hours", entry.id);

  return NextResponse.json<HoursEntryWithRelations>(withRelations([entry])[0], { status: 201 });
}
