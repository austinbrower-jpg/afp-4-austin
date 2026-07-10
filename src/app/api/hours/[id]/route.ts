import { NextRequest, NextResponse } from "next/server";
import { getDataProvider } from "@/lib/data/provider";
import { dataErrorResponse, NO_STORE_HEADERS } from "@/lib/data/route-utils";
import { hoursInputSchema, validationMessages } from "@/lib/data/validation";
import { exactElapsedMinutes } from "@/lib/reports/engine";
import type { HoursEntryWithRelations } from "@/types/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

async function augment(id: string, provider: Awaited<ReturnType<typeof getDataProvider>>): Promise<HoursEntryWithRelations | null> {
  const [entry, projects, workLogs] = await Promise.all([
    provider.hours.findById(id), provider.projects.list(), provider.workLogs.list(),
  ]);
  if (!entry) return null;
  return {
    ...entry,
    projectName: entry.projectId ? projects.find((project) => project.id === entry.projectId)?.name ?? null : null,
    workLogTitle: entry.relatedWorkLogId ? workLogs.find((work) => work.id === entry.relatedWorkLogId)?.title ?? null : null,
  };
}
export async function GET(_request: NextRequest, { params }: Context) {
  try {
    const provider = await getDataProvider();
    const entry = await augment((await params).id, provider);
    if (!entry) return NextResponse.json({ error: "Hours entry not found." }, { status: 404 });
    return NextResponse.json(entry, { headers: NO_STORE_HEADERS });
  } catch (error) { return dataErrorResponse(error); }
}

export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    const provider = await getDataProvider();
    const { id } = await params;
    const existing = await provider.hours.findById(id);
    if (!existing) return NextResponse.json({ error: "Hours entry not found." }, { status: 404 });
    const body = await request.json().catch(() => null);
    const parsed = hoursInputSchema.safeParse({ ...existing, ...body });
    if (!parsed.success) return NextResponse.json({ error: "Invalid hours entry.", details: validationMessages(parsed.error) }, { status: 400 });
    const exactMinutes = exactElapsedMinutes(parsed.data.startTime, parsed.data.endTime, parsed.data.breakMinutes);
    if (exactMinutes <= 0) return NextResponse.json({ error: "Elapsed time must be greater than zero." }, { status: 400 });
    const updated = {
      ...existing,
      ...parsed.data,
      totalHours: exactMinutes / 60,
      updatedAt: new Date().toISOString(),
    };
    const saved = await provider.hours.update(id, updated);
    const response = await augment(saved.entity.id, provider);
    return NextResponse.json({ ...response, persistence: saved }, { headers: NO_STORE_HEADERS });
  } catch (error) { return dataErrorResponse(error); }
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  try {
    const provider = await getDataProvider();
    await provider.hours.remove((await params).id);
    return NextResponse.json({ ok: true });
  } catch (error) { return dataErrorResponse(error); }
}
