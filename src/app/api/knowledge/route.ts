import { NextRequest, NextResponse } from "next/server";
import { getDataProvider } from "@/lib/data/provider";
import { newEntityBase } from "@/lib/data/entities";
import { dataErrorResponse, NO_STORE_HEADERS } from "@/lib/data/route-utils";
import type { KnowledgePage, KnowledgeType } from "@/types/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const TYPES: KnowledgeType[] = ["project-note", "documentation", "notes", "flow-map", "research", "meeting-notes", "idea", "sop", "reference"];
const isType = (value: unknown): value is KnowledgeType => typeof value === "string" && TYPES.includes(value as KnowledgeType);

export async function GET(request: NextRequest) {
  try {
    const provider = await getDataProvider();
    const params = request.nextUrl.searchParams;
    const type = params.get("type");
    const parentId = params.get("parentId");
    const query = params.get("q")?.trim().toLowerCase() ?? "";
    let pages = await provider.knowledge.list();
    if (type && isType(type)) pages = pages.filter((page) => page.type === type);
    if (parentId !== null) pages = pages.filter((page) => parentId === "root" || !parentId || parentId === "null" ? page.parentId === null : page.parentId === parentId);
    if (query) pages = pages.filter((page) => [page.title, page.content, ...page.tags].some((value) => value.toLowerCase().includes(query)));
    return NextResponse.json(pages, { headers: NO_STORE_HEADERS });
  } catch (error) { return dataErrorResponse(error); }
}
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body.title !== "string" || !body.title.trim() || !isType(body.type)) {
      return NextResponse.json({ error: "Title and a valid knowledge type are required." }, { status: 400 });
    }
    const provider = await getDataProvider();
    const [workspace, client] = await Promise.all([provider.workspace(), provider.clients.list().then((rows) => rows[0])]);
    const page: KnowledgePage = {
      ...newEntityBase("knowledge"),
      workspaceId: workspace?.id ?? "",
      clientId: typeof body.clientId === "string" ? body.clientId : client?.id ?? null,
      projectId: typeof body.projectId === "string" ? body.projectId : null,
      type: body.type,
      title: body.title.trim(),
      content: typeof body.content === "string" ? body.content : "",
      tags: Array.isArray(body.tags) ? body.tags.filter((tag: unknown): tag is string => typeof tag === "string") : [],
      parentId: typeof body.parentId === "string" ? body.parentId : null,
      backlinkIds: Array.isArray(body.backlinkIds) ? body.backlinkIds.filter((id: unknown): id is string => typeof id === "string") : [],
    };
    const saved = await provider.knowledge.create(page);
    return NextResponse.json(saved.entity, { status: 201 });
  } catch (error) { return dataErrorResponse(error); }
}
