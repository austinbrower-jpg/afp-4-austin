import { NextRequest, NextResponse } from "next/server";
import { getDataProvider } from "@/lib/data/provider";
import { newEntityBase } from "@/lib/data/entities";
import { dataErrorResponse, NO_STORE_HEADERS } from "@/lib/data/route-utils";
import { hoursInputSchema, validationMessages } from "@/lib/data/validation";
import { exactElapsedMinutes } from "@/lib/reports/engine";
import type { HoursEntry } from "@/types/domain";
import type { HoursEntryWithRelations } from "@/types/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function withRelations(entries: HoursEntry[], provider: Awaited<ReturnType<typeof getDataProvider>>) {
  const [projects, workLogs] = await Promise.all([provider.projects.list(), provider.workLogs.list()]);
  const projectMap = new Map(projects.map((project) => [project.id, project.name]));
  const workLogMap = new Map(workLogs.map((work) => [work.id, work.title]));
  return entries.map((entry): HoursEntryWithRelations => ({
    ...entry,
    projectName: entry.projectId ? projectMap.get(entry.projectId) ?? null : null,
    workLogTitle: entry.relatedWorkLogId ? workLogMap.get(entry.relatedWorkLogId) ?? null : null,
  }));
}

function logHoursSuccess(details: { count: number; range: string; source: string; syncedAt: string }) {
  console.info("[api/hours] fetch succeeded", details);
}

function logHoursFailure(error: unknown) {
  if (!(error instanceof Error)) {
    console.warn("[api/hours] fetch failed", { category: "unexpected" });
    return;
  }
  const maybeError = error as Error & { code?: unknown };
  const category = typeof maybeError.code === "string" ? maybeError.code : error.name;
  console.warn("[api/hours] fetch failed", { category });
}

export async function GET(request: NextRequest) {
  try {
    const provider = await getDataProvider();
    const client = (await provider.clients.list())[0];
    if (!client && provider.mode !== "notion") {
      return NextResponse.json([], { headers: NO_STORE_HEADERS });
    }
    const start = request.nextUrl.searchParams.get("start");
    const end = request.nextUrl.searchParams.get("end");
    let entries = await provider.hours.list();
    if (client) entries = entries.filter((entry) => entry.clientId === client.id);
    if (start && end) entries = entries.filter((entry) => entry.date >= start && entry.date <= end);
    entries.sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime));
    const payload = await withRelations(entries, provider);
    logHoursSuccess({
      count: payload.length,
      range: start && end ? `${start}..${end}` : "all",
      source: provider.mode,
      syncedAt: new Date().toISOString(),
    });
    return NextResponse.json(payload, { headers: NO_STORE_HEADERS });
  } catch (error) {
    logHoursFailure(error);
    return dataErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = hoursInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid hours entry.", details: validationMessages(parsed.error) }, { status: 400 });
    }
    const provider = await getDataProvider();
    const [workspace, client] = await Promise.all([provider.workspace(), provider.clients.list().then((rows) => rows[0])]);
    if (!workspace || (!client && provider.mode !== "notion")) {
      return NextResponse.json({ error: "No workspace/client configured." }, { status: 400 });
    }
    const exactMinutes = exactElapsedMinutes(parsed.data.startTime, parsed.data.endTime, parsed.data.breakMinutes);
    if (exactMinutes <= 0) return NextResponse.json({ error: "Elapsed time must be greater than zero." }, { status: 400 });
    const entry: HoursEntry = {
      ...newEntityBase("hours"),
      workspaceId: workspace.id,
      // Notion Hours has no Client relation. Before the one-time import
      // creates the Client row, the native provider already projects Hours
      // with an empty client identity; use that same identity for the
      // controlled create/readback path. Mock mode still requires a Client.
      clientId: client?.id ?? "",
      projectId: parsed.data.projectId,
      date: parsed.data.date,
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
      breakMinutes: parsed.data.breakMinutes,
      totalHours: exactMinutes / 60,
      hourlyRate: parsed.data.hourlyRate,
      billable: parsed.data.billable,
      location: parsed.data.location,
      relatedWorkLogId: parsed.data.relatedWorkLogId,
      notes: parsed.data.notes,
      source: parsed.data.source,
    };
    const saved = await provider.hours.create(entry);
    const [response] = await withRelations([saved.entity], provider);
    return NextResponse.json({ ...response, persistence: saved }, { status: 201, headers: NO_STORE_HEADERS });
  } catch (error) {
    return dataErrorResponse(error);
  }
}
