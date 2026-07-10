import { NextRequest, NextResponse } from "next/server";
import {
  initDb,
  projectRepo,
  workspaceRepo,
  clientRepo,
  listHoursByProject,
  listWorkLogsByProject,
  newId,
  nowISO,
} from "@/lib/db";
import { knowledgeRepo } from "@/lib/db/repositories/knowledge";
import type { Priority, Project, ProjectStatus } from "@/types/domain";
import { syncEntityNow } from "@/lib/notion/sync-engine";

const STATUSES: ProjectStatus[] = ["active", "on-hold", "completed", "archived"];
const PRIORITIES: Priority[] = ["low", "medium", "high", "urgent"];

/** GET /api/projects becomes the canonical project list for the rest of the app. */
export interface ProjectListItem extends Project {
  hoursCount: number;
  workLogCount: number;
  knowledgeCount: number;
}

export async function GET() {
  initDb();
  const projects = projectRepo.all("name ASC");
  const enriched: ProjectListItem[] = projects.map((p) => ({
    ...p,
    hoursCount: listHoursByProject(p.id).length,
    workLogCount: listWorkLogsByProject(p.id).length,
    knowledgeCount: knowledgeRepo.where("project_id = ?", [p.id]).length,
  }));
  return NextResponse.json(enriched);
}

export async function POST(request: NextRequest) {
  initDb();
  const body = await request.json().catch(() => ({}));

  const workspace = workspaceRepo.all()[0];
  const client = clientRepo.all()[0];
  if (!workspace || !client) {
    return NextResponse.json(
      { error: "No seeded workspace/client to attach this project to" },
      { status: 500 },
    );
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const now = nowISO();
  const project: Project = {
    id: newId("proj"),
    workspaceId: workspace.id,
    clientId: client.id,
    name,
    description: typeof body.description === "string" ? body.description : "",
    status: STATUSES.includes(body.status) ? body.status : "active",
    priority: PRIORITIES.includes(body.priority) ? body.priority : "medium",
    color: typeof body.color === "string" && body.color ? body.color : "#6366f1",
    tags: Array.isArray(body.tags) ? body.tags.filter((t: unknown) => typeof t === "string") : [],
    notes: typeof body.notes === "string" ? body.notes : "",
    notionPageId: null,
    notionDatabaseId: null,
    syncStatus: "local-only",
    lastSyncedAt: null,
    notionLastEditedTime: null,
    createdAt: now,
    updatedAt: now,
  };

  projectRepo.insert(project);
  await syncEntityNow("project", project.id);

  return NextResponse.json(project, { status: 201 });
}
