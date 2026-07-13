import { NextRequest, NextResponse } from "next/server";
import { getDataProvider } from "@/lib/data/provider";
import { dataErrorResponse, NO_STORE_HEADERS } from "@/lib/data/route-utils";
import { projectInputSchema, validationMessages } from "@/lib/data/validation";
import type { Project } from "@/types/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Context) {
  try {
    const provider = await getDataProvider();
    const { id } = await params;
    const [project, hours, workLogs, knowledge, invoices] = await Promise.all([
      provider.projects.findById(id), provider.hours.list(), provider.workLogs.list(), provider.knowledge.list(), provider.invoices.list(),
    ]);
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const projectHours = hours.filter((entry) => entry.projectId === id);
    const projectWorkLogs = workLogs.filter((entry) => entry.projectId === id);
    const projectHoursIds = new Set(projectHours.map((entry) => entry.id));
    const projectWorkLogIds = new Set(projectWorkLogs.map((entry) => entry.id));
    const projectInvoices = invoices.filter((invoice) =>
      invoice.hoursEntryIds.some((hoursId) => projectHoursIds.has(hoursId)) ||
      (invoice.workDoneIds ?? []).some((workLogId) => projectWorkLogIds.has(workLogId)),
    );
    return NextResponse.json({
      project,
      hours: projectHours,
      workLogs: projectWorkLogs,
      knowledge: knowledge.filter((entry) => entry.projectId === id),
      invoices: projectInvoices,
    }, { headers: NO_STORE_HEADERS });
  } catch (error) { return dataErrorResponse(error); }
}
export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    const provider = await getDataProvider();
    const { id } = await params;
    const existing = await provider.projects.findById(id);
    if (!existing) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const parsed = projectInputSchema.safeParse({ ...existing, ...(await request.json().catch(() => null)) });
    if (!parsed.success) return NextResponse.json({ error: "Invalid project.", details: validationMessages(parsed.error) }, { status: 400 });
    const updated: Project = { ...existing, ...parsed.data, updatedAt: new Date().toISOString() };
    const saved = await provider.projects.update(id, updated);
    return NextResponse.json({ ...saved.entity, persistence: saved }, { headers: NO_STORE_HEADERS });
  } catch (error) { return dataErrorResponse(error); }
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  try {
    const provider = await getDataProvider();
    await provider.projects.remove((await params).id);
    return NextResponse.json({ ok: true });
  } catch (error) { return dataErrorResponse(error); }
}
