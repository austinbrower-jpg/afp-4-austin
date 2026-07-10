import { NextRequest, NextResponse } from "next/server";
import { initDb, nowISO } from "@/lib/db";
import { hoursRepo } from "@/lib/db/repositories/hours";
import { projectRepo } from "@/lib/db/repositories/projects";
import { workLogRepo } from "@/lib/db/repositories/worklogs";
import { computeTotalHours } from "@/lib/calculations";
import { syncEntityNow } from "@/lib/notion/sync-engine";
import type { HoursEntryWithRelations } from "@/types/api";

function withRelations(entry: ReturnType<typeof hoursRepo.findById>): HoursEntryWithRelations | null {
  if (!entry) return null;
  const project = entry.projectId ? projectRepo.findById(entry.projectId) : null;
  const workLog = entry.relatedWorkLogId ? workLogRepo.findById(entry.relatedWorkLogId) : null;
  return {
    ...entry,
    projectName: project?.name ?? null,
    workLogTitle: workLog?.title ?? null,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  initDb();
  const { id } = await params;
  const entry = hoursRepo.findById(id);
  if (!entry) {
    return NextResponse.json({ error: "Hours entry not found" }, { status: 404 });
  }
  return NextResponse.json<HoursEntryWithRelations>(withRelations(entry)!);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  initDb();
  const { id } = await params;
  const existing = hoursRepo.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Hours entry not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));

  const startTime: string = typeof body.startTime === "string" && body.startTime ? body.startTime : existing.startTime;
  const endTime: string = typeof body.endTime === "string" && body.endTime ? body.endTime : existing.endTime;
  const breakMinutes = Number.isFinite(Number(body.breakMinutes))
    ? Math.max(0, Number(body.breakMinutes))
    : existing.breakMinutes;

  // Never trust a client-submitted totalHours - always recompute server-side.
  const totalHours = computeTotalHours(startTime, endTime, breakMinutes);

  const updated = {
    ...existing,
    date: typeof body.date === "string" && body.date ? body.date : existing.date,
    startTime,
    endTime,
    breakMinutes,
    totalHours,
    hourlyRate: Number.isFinite(Number(body.hourlyRate)) ? Number(body.hourlyRate) : existing.hourlyRate,
    billable: body.billable === undefined ? existing.billable : Boolean(body.billable),
    location: typeof body.location === "string" ? body.location : existing.location,
    projectId:
      body.projectId === undefined ? existing.projectId : (body.projectId || null),
    relatedWorkLogId:
      body.relatedWorkLogId === undefined ? existing.relatedWorkLogId : (body.relatedWorkLogId || null),
    notes: typeof body.notes === "string" ? body.notes : existing.notes,
    source: body.source === "timer" || body.source === "manual" ? body.source : existing.source,
    updatedAt: nowISO(),
  };

  hoursRepo.update(id, updated);
  await syncEntityNow("hours", id);

  return NextResponse.json<HoursEntryWithRelations>(withRelations(updated)!);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  initDb();
  const { id } = await params;
  const existing = hoursRepo.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Hours entry not found" }, { status: 404 });
  }
  hoursRepo.remove(id);
  return NextResponse.json({ ok: true });
}
