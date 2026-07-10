import { NextRequest, NextResponse } from "next/server";
import { getDataProvider } from "@/lib/data/provider";
import { newEntityBase } from "@/lib/data/entities";
import { dataErrorResponse, NO_STORE_HEADERS } from "@/lib/data/route-utils";
import { validationMessages, workLogInputSchema } from "@/lib/data/validation";
import type { WorkLog } from "@/types/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const provider = await getDataProvider();
    const status = request.nextUrl.searchParams.get("status");
    const projectId = request.nextUrl.searchParams.get("projectId");
    let logs = await provider.workLogs.list();
    if (status) logs = logs.filter((log) => log.status === status);
    if (projectId) logs = logs.filter((log) => log.projectId === projectId);
    logs.sort((a, b) => b.date.localeCompare(a.date));
    return NextResponse.json(logs, { headers: NO_STORE_HEADERS });
  } catch (error) { return dataErrorResponse(error); }
}
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = workLogInputSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid Work Done entry.", details: validationMessages(parsed.error) }, { status: 400 });
    const provider = await getDataProvider();
    const [workspace, client] = await Promise.all([provider.workspace(), provider.clients.list().then((rows) => rows[0])]);
    if (!workspace || !client) return NextResponse.json({ error: "No workspace/client configured." }, { status: 400 });
    const entry: WorkLog = {
      ...newEntityBase("work"),
      workspaceId: workspace.id,
      clientId: client.id,
      projectId: parsed.data.projectId,
      title: parsed.data.title,
      date: parsed.data.date,
      summary: parsed.data.summary,
      detailedNotes: parsed.data.detailedNotes,
      invoiceDescription: parsed.data.invoiceDescription,
      status: parsed.data.status,
      priority: parsed.data.priority,
      relatedHoursIds: parsed.data.relatedHoursIds,
      relatedKnowledgeIds: parsed.data.relatedKnowledgeIds,
      evidence: parsed.data.evidence,
      githubLink: parsed.data.githubLink,
      attachments: parsed.data.attachments,
      detailedWorkDescription: parsed.data.detailedWorkDescription,
      internalNotes: parsed.data.internalNotes,
      clientVisible: parsed.data.clientVisible,
      includeInInvoice: parsed.data.includeInInvoice,
      includeInWorkReport: parsed.data.includeInWorkReport,
      evidenceLinks: parsed.data.evidenceLinks,
    };
    const saved = await provider.workLogs.create(entry);
    return NextResponse.json({ ...saved.entity, persistence: saved }, { status: 201, headers: NO_STORE_HEADERS });
  } catch (error) { return dataErrorResponse(error); }
}
