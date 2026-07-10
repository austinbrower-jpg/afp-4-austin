import { NextRequest, NextResponse } from "next/server";
import { initDb, knowledgeRepo, workspaceRepo, clientRepo, newId, nowISO, newSyncable } from "@/lib/db";
import { syncEntityNow } from "@/lib/notion/sync-engine";
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

export async function GET(request: NextRequest) {
  initDb();
  const sp = request.nextUrl.searchParams;
  const type = sp.get("type");
  const parentId = sp.get("parentId");
  const q = sp.get("q")?.trim().toLowerCase() ?? "";

  let pages = knowledgeRepo.all("title ASC");

  if (type && isKnowledgeType(type)) {
    pages = pages.filter((p) => p.type === type);
  }

  if (parentId !== null) {
    if (parentId === "root" || parentId === "" || parentId === "null") {
      pages = pages.filter((p) => p.parentId === null);
    } else {
      pages = pages.filter((p) => p.parentId === parentId);
    }
  }

  if (q) {
    pages = pages.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.content.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }

  return NextResponse.json<KnowledgePage[]>(pages);
}

export async function POST(request: NextRequest) {
  initDb();
  const body = await request.json().catch(() => null);

  if (!body || typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (!isKnowledgeType(body.type)) {
    return NextResponse.json({ error: "A valid knowledge type is required" }, { status: 400 });
  }
  if (body.parentId) {
    const parent = knowledgeRepo.findById(body.parentId);
    if (!parent) {
      return NextResponse.json({ error: "Parent page not found" }, { status: 400 });
    }
  }

  const workspace = workspaceRepo.all()[0];
  const client = clientRepo.all()[0];
  const now = nowISO();

  const page: KnowledgePage = {
    id: newId("kb"),
    workspaceId: workspace?.id ?? "",
    clientId: typeof body.clientId === "string" ? body.clientId : (client?.id ?? null),
    projectId: typeof body.projectId === "string" ? body.projectId : null,
    type: body.type,
    title: body.title.trim(),
    content: typeof body.content === "string" ? body.content : "",
    tags: Array.isArray(body.tags) ? body.tags.filter((t: unknown) => typeof t === "string") : [],
    parentId: typeof body.parentId === "string" ? body.parentId : null,
    backlinkIds: Array.isArray(body.backlinkIds)
      ? body.backlinkIds.filter((id: unknown) => typeof id === "string")
      : [],
    ...newSyncable(),
    createdAt: now,
    updatedAt: now,
  };

  knowledgeRepo.insert(page);
  await syncEntityNow("knowledge", page.id);

  return NextResponse.json<KnowledgePage>(page, { status: 201 });
}
