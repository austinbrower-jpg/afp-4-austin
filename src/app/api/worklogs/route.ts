import { NextRequest, NextResponse } from "next/server";
import {
  initDb,
  workLogRepo,
  workspaceRepo,
  clientRepo,
  newId,
  nowISO,
  newSyncable,
} from "@/lib/db";
import { syncEntityNow } from "@/lib/notion/sync-engine";
import type { WorkLog, Attachment } from "@/types/domain";

export async function GET(request: NextRequest) {
  initDb();
  const status = request.nextUrl.searchParams.get("status");
  const projectId = request.nextUrl.searchParams.get("projectId");

  let logs = workLogRepo.all("date DESC");
  if (status) logs = logs.filter((l) => l.status === status);
  if (projectId) logs = logs.filter((l) => l.projectId === projectId);

  return NextResponse.json<WorkLog[]>(logs);
}

export async function POST(request: NextRequest) {
  initDb();
  const body = await request.json();

  const workspace = workspaceRepo.all()[0];
  const client = clientRepo.all()[0];
  if (!workspace || !client) {
    return NextResponse.json(
      { error: "No workspace/client configured" },
      { status: 400 },
    );
  }

  const now = nowISO();
  const id = newId("worklog");

  const entity: WorkLog = {
    id,
    workspaceId: workspace.id,
    clientId: client.id,
    projectId: (body.projectId as string | null) ?? null,
    title: typeof body.title === "string" && body.title.trim() ? body.title.trim() : "Untitled work log",
    date: (body.date as string) || now.slice(0, 10),
    summary: (body.summary as string) ?? "",
    detailedNotes: (body.detailedNotes as string) ?? "",
    invoiceDescription: (body.invoiceDescription as string) ?? "",
    status: (body.status as WorkLog["status"]) ?? "not-started",
    priority: (body.priority as WorkLog["priority"]) ?? "medium",
    relatedHoursIds: Array.isArray(body.relatedHoursIds) ? body.relatedHoursIds : [],
    relatedKnowledgeIds: Array.isArray(body.relatedKnowledgeIds) ? body.relatedKnowledgeIds : [],
    evidence: Array.isArray(body.evidence) ? body.evidence : [],
    githubLink: (body.githubLink as string | null) ?? null,
    attachments: Array.isArray(body.attachments) ? (body.attachments as Attachment[]) : [],
    ...newSyncable(),
    createdAt: now,
    updatedAt: now,
  };

  workLogRepo.insert(entity);
  await syncEntityNow("worklog", id);

  const saved = workLogRepo.findById(id)!;
  return NextResponse.json<WorkLog>(saved, { status: 201 });
}
