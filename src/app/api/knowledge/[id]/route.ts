import { NextRequest, NextResponse } from "next/server";
import { getDataProvider } from "@/lib/data/provider";
import { dataErrorResponse, NO_STORE_HEADERS } from "@/lib/data/route-utils";
import { getDescendantIds } from "@/lib/knowledge/tree";
import type { KnowledgePage, KnowledgeType } from "@/types/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
const TYPES: KnowledgeType[] = ["project-note", "documentation", "notes", "flow-map", "research", "meeting-notes", "idea", "sop", "reference"];
const isType = (value: unknown): value is KnowledgeType => typeof value === "string" && TYPES.includes(value as KnowledgeType);

export async function GET(_request: NextRequest, { params }: Context) {
  try {
    const provider = await getDataProvider();
    const page = await provider.knowledge.findById((await params).id);
    if (!page) return NextResponse.json({ error: "Page not found." }, { status: 404 });
    return NextResponse.json(page, { headers: NO_STORE_HEADERS });
  } catch (error) { return dataErrorResponse(error); }
}
export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    const provider = await getDataProvider();
    const { id } = await params;
    const existing = await provider.knowledge.findById(id);
    if (!existing) return NextResponse.json({ error: "Page not found." }, { status: 404 });
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    if (body.type !== undefined && !isType(body.type)) return NextResponse.json({ error: "A valid knowledge type is required." }, { status: 400 });
    if (body.parentId) {
      const pages = await provider.knowledge.list();
      if (body.parentId === id || getDescendantIds(id, pages).has(body.parentId)) return NextResponse.json({ error: "Invalid parent cycle." }, { status: 400 });
    }
    const updated: KnowledgePage = {
      ...existing,
      title: typeof body.title === "string" && body.title.trim() ? body.title.trim() : existing.title,
      type: isType(body.type) ? body.type : existing.type,
      content: typeof body.content === "string" ? body.content : existing.content,
      tags: Array.isArray(body.tags) ? body.tags.filter((tag: unknown): tag is string => typeof tag === "string") : existing.tags,
      parentId: body.parentId === undefined ? existing.parentId : body.parentId || null,
      clientId: typeof body.clientId === "string" ? body.clientId : existing.clientId,
      projectId: body.projectId === undefined ? existing.projectId : body.projectId || null,
      backlinkIds: Array.isArray(body.backlinkIds) ? body.backlinkIds.filter((value: unknown): value is string => typeof value === "string") : existing.backlinkIds,
      updatedAt: new Date().toISOString(),
    };
    return NextResponse.json((await provider.knowledge.update(id, updated)).entity);
  } catch (error) { return dataErrorResponse(error); }
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  try {
    const provider = await getDataProvider();
    await provider.knowledge.remove((await params).id);
    return NextResponse.json({ ok: true });
  } catch (error) { return dataErrorResponse(error); }
}
