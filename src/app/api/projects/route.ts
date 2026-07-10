import { NextRequest, NextResponse } from "next/server";
import { getDataProvider } from "@/lib/data/provider";
import { newEntityBase } from "@/lib/data/entities";
import { dataErrorResponse, NO_STORE_HEADERS } from "@/lib/data/route-utils";
import { projectInputSchema, validationMessages } from "@/lib/data/validation";
import type { Project } from "@/types/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface ProjectListItem extends Project {
  hoursCount: number;
  workLogCount: number;
  knowledgeCount: number;
}
export async function GET() {
  try {
    const provider = await getDataProvider();
    const [projects, hours, workLogs, knowledge] = await Promise.all([
      provider.projects.list(), provider.hours.list(), provider.workLogs.list(), provider.knowledge.list(),
    ]);
    const items: ProjectListItem[] = projects.map((project) => ({
      ...project,
      hoursCount: hours.filter((entry) => entry.projectId === project.id).length,
      workLogCount: workLogs.filter((entry) => entry.projectId === project.id).length,
      knowledgeCount: knowledge.filter((entry) => entry.projectId === project.id).length,
    }));
    return NextResponse.json(items, { headers: NO_STORE_HEADERS });
  } catch (error) { return dataErrorResponse(error); }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = projectInputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid project.", details: validationMessages(parsed.error) }, { status: 400 });
    const provider = await getDataProvider();
    const [workspace, client] = await Promise.all([provider.workspace(), provider.clients.list().then((rows) => rows[0])]);
    if (!workspace || !client) return NextResponse.json({ error: "No workspace/client configured." }, { status: 400 });
    const project: Project = {
      ...newEntityBase("project"),
      workspaceId: workspace.id,
      clientId: client.id,
      ...parsed.data,
    };
    const saved = await provider.projects.create(project);
    return NextResponse.json({ ...saved.entity, persistence: saved }, { status: 201, headers: NO_STORE_HEADERS });
  } catch (error) { return dataErrorResponse(error); }
}
