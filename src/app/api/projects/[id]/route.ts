import { NextRequest, NextResponse } from "next/server";
import {
  initDb,
  projectRepo,
  listHoursByProject,
  listWorkLogsByProject,
  nowISO,
} from "@/lib/db";
import { knowledgeRepo } from "@/lib/db/repositories/knowledge";
import type { Priority, Project, ProjectStatus } from "@/types/domain";
import { syncEntityNow } from "@/lib/notion/sync-engine";

const STATUSES: ProjectStatus[] = ["active", "on-hold", "completed", "archived"];
const PRIORITIES: Priority[] = ["low", "medium", "high", "urgent"];

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  initDb();
  const { id } = await params;

  const project = projectRepo.findById(id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const hours = listHoursByProject(id);
  const workLogs = listWorkLogsByProject(id);
  const knowledge = knowledgeRepo.where("project_id = ?", [id], "title ASC");

  return NextResponse.json({ project, hours, workLogs, knowledge });
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  initDb();
  const { id } = await params;

  const existing = projectRepo.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));

  const updated: Project = {
    ...existing,
    name: typeof body.name === "string" && body.name.trim() ? body.name.trim() : existing.name,
    description: typeof body.description === "string" ? body.description : existing.description,
    status: STATUSES.includes(body.status) ? body.status : existing.status,
    priority: PRIORITIES.includes(body.priority) ? body.priority : existing.priority,
    color: typeof body.color === "string" && body.color ? body.color : existing.color,
    tags: Array.isArray(body.tags)
      ? body.tags.filter((t: unknown) => typeof t === "string")
      : existing.tags,
    notes: typeof body.notes === "string" ? body.notes : existing.notes,
    updatedAt: nowISO(),
  };

  projectRepo.update(id, updated);
  await syncEntityNow("project", id);

  return NextResponse.json(updated);
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  initDb();
  const { id } = await params;

  const existing = projectRepo.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  projectRepo.remove(id);
  return NextResponse.json({ ok: true });
}
