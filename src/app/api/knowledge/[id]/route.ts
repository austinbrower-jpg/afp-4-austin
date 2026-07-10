import { NextRequest, NextResponse } from "next/server";
import { initDb, knowledgeRepo, nowISO } from "@/lib/db";
import { syncEntityNow } from "@/lib/notion/sync-engine";
import { getDescendantIds } from "@/lib/knowledge/tree";
import type { KnowledgePage, KnowledgeType } from "@/types/domain";

const VALID_TYPES: KnowledgeType[] = [
  "project-note",
  "documentation",
  "notes",
  "flow-map",
  "research",
  "meeting-notes",
  "idea",
  "sop",
  "reference",
];

function isKnowledgeType(value: unknown): value is KnowledgeType {
  return typeof value === "string" && VALID_TYPES.includes(value as KnowledgeType);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  initDb();
  const { id } = await params;
  const page = knowledgeRepo.findById(id);
  if (!page) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }
  return NextResponse.json<KnowledgePage>(page);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  initDb();
  const { id } = await params;
  const existing = knowledgeRepo.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (body.type !== undefined && !isKnowledgeType(body.type)) {
    return NextResponse.json({ error: "A valid knowledge type is required" }, { status: 400 });
  }
  if (body.title !== undefined && (typeof body.title !== "string" || !body.title.trim())) {
    return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
  }

  if (body.parentId !== undefined && body.parentId !== null) {
    if (body.parentId === id) {
      return NextResponse.json({ error: "A page cannot be its own parent" }, { status: 400 });
    }
    const parent = knowledgeRepo.findById(body.parentId);
    if (!parent) {
      return NextResponse.json({ error: "Parent page not found" }, { status: 400 });
    }
    const descendants = getDescendantIds(id, knowledgeRepo.all());
    if (descendants.has(body.parentId)) {
      return NextResponse.json(
        { error: "Cannot nest a page under one of its own child pages" },
        { status: 400 },
      );
    }
  }

  const updated: KnowledgePage = {
    ...existing,
    title: typeof body.title === "string" ? body.title.trim() : existing.title,
    type: isKnowledgeType(body.type) ? body.type : existing.type,
    content: typeof body.content === "string" ? body.content : existing.content,
    tags: Array.isArray(body.tags)
      ? body.tags.filter((t: unknown) => typeof t === "string")
      : existing.tags,
    parentId:
      body.parentId === undefined
        ? existing.parentId
        : body.parentId === null
          ? null
          : String(body.parentId),
    clientId: typeof body.clientId === "string" ? body.clientId : existing.clientId,
    projectId:
      body.projectId === undefined
        ? existing.projectId
        : body.projectId === null
          ? null
          : String(body.projectId),
    backlinkIds: Array.isArray(body.backlinkIds)
      ? body.backlinkIds.filter((bid: unknown) => typeof bid === "string")
      : existing.backlinkIds,
    updatedAt: nowISO(),
  };

  knowledgeRepo.update(id, updated);
  await syncEntityNow("knowledge", id);

  return NextResponse.json<KnowledgePage>(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  initDb();
  const { id } = await params;
  const existing = knowledgeRepo.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }

  // Promote direct children to top-level rather than leaving dangling parentIds.
  for (const child of knowledgeRepo.where("parent_id = ?", [id])) {
    knowledgeRepo.update(child.id, { ...child, parentId: null, updatedAt: nowISO() });
  }

  // Strip this page from any other page's explicit backlinkIds relation.
  for (const other of knowledgeRepo.all()) {
    if (other.backlinkIds.includes(id)) {
      knowledgeRepo.update(other.id, {
        ...other,
        backlinkIds: other.backlinkIds.filter((bid) => bid !== id),
        updatedAt: other.updatedAt,
      });
    }
  }

  knowledgeRepo.remove(id);

  return NextResponse.json({ ok: true });
}
