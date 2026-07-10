import { NextRequest, NextResponse } from "next/server";
import { initDb, workLogRepo, nowISO } from "@/lib/db";
import { syncEntityNow } from "@/lib/notion/sync-engine";
import type { WorkLog, Attachment } from "@/types/domain";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  initDb();
  const { id } = await params;
  const log = workLogRepo.findById(id);
  if (!log) {
    return NextResponse.json({ error: "Work log not found" }, { status: 404 });
  }
  return NextResponse.json<WorkLog>(log);
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  initDb();
  const { id } = await params;
  const existing = workLogRepo.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Work log not found" }, { status: 404 });
  }

  const body = await request.json();

  const updated: WorkLog = {
    ...existing,
    projectId: "projectId" in body ? ((body.projectId as string | null) ?? null) : existing.projectId,
    title: typeof body.title === "string" && body.title.trim() ? body.title.trim() : existing.title,
    date: typeof body.date === "string" && body.date ? body.date : existing.date,
    summary: typeof body.summary === "string" ? body.summary : existing.summary,
    detailedNotes:
      typeof body.detailedNotes === "string" ? body.detailedNotes : existing.detailedNotes,
    invoiceDescription:
      typeof body.invoiceDescription === "string"
        ? body.invoiceDescription
        : existing.invoiceDescription,
    status: (body.status as WorkLog["status"]) ?? existing.status,
    priority: (body.priority as WorkLog["priority"]) ?? existing.priority,
    relatedHoursIds: Array.isArray(body.relatedHoursIds)
      ? body.relatedHoursIds
      : existing.relatedHoursIds,
    relatedKnowledgeIds: Array.isArray(body.relatedKnowledgeIds)
      ? body.relatedKnowledgeIds
      : existing.relatedKnowledgeIds,
    evidence: Array.isArray(body.evidence) ? body.evidence : existing.evidence,
    githubLink: "githubLink" in body ? ((body.githubLink as string | null) ?? null) : existing.githubLink,
    attachments: Array.isArray(body.attachments)
      ? (body.attachments as Attachment[])
      : existing.attachments,
    updatedAt: nowISO(),
  };

  workLogRepo.update(id, updated);
  await syncEntityNow("worklog", id);

  const saved = workLogRepo.findById(id)!;
  return NextResponse.json<WorkLog>(saved);
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  initDb();
  const { id } = await params;
  const existing = workLogRepo.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Work log not found" }, { status: 404 });
  }
  workLogRepo.remove(id);
  return NextResponse.json({ ok: true });
}
