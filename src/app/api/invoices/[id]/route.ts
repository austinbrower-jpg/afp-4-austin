import { NextRequest, NextResponse } from "next/server";
import { getDataProvider } from "@/lib/data/provider";
import { dataErrorResponse, NO_STORE_HEADERS } from "@/lib/data/route-utils";
import { composeSavedInvoiceView } from "@/lib/invoices/invoice-saved-view";
import { buildStoredDatasetForSave } from "@/lib/invoices/invoice-save-data";
import { getReportSettings } from "@/lib/reports/settings";
import type { InvoiceDetailResponse, WorkPerformedRow } from "@/types/api";
import type { InvoiceReport, InvoiceStatus } from "@/types/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
const STATUSES: InvoiceStatus[] = ["draft", "sent", "paid", "void"];

async function augment(invoice: InvoiceReport, provider: Awaited<ReturnType<typeof getDataProvider>>): Promise<InvoiceDetailResponse> {
  const [workLogs, clients, hours, settings, baseDataset] = await Promise.all([
    provider.workLogs.list(),
    provider.clients.list(),
    provider.hours.list(),
    getReportSettings(),
    buildStoredDatasetForSave(provider),
  ]);
  const workPerformed: WorkPerformedRow[] = invoice.lineItems.map((line) => {
    const work = workLogs.find((entry) => entry.id === line.workLogId);
    return { workLogId: line.workLogId, title: work?.title ?? line.title, description: work?.invoiceDescription || work?.summary || line.description, hours: line.hours, href: work ? `/work-done/${work.id}` : null };
  });
  const savedView = composeSavedInvoiceView(invoice, hours, workLogs, baseDataset, settings);
  return {
    ...invoice,
    clientName: clients.find((client) => client.id === invoice.clientId)?.name ?? "Client",
    workPerformed,
    sessionIds: savedView.sessionIds,
    workLogIds: savedView.workLogIds,
    includedHoursCount: invoice.hoursEntryIds.length,
    includedWorkDoneCount: invoice.workDoneIds?.length ?? 0,
    relationWarnings: savedView.warnings,
    liveDriftWarnings: savedView.liveDriftWarnings,
    immutableTotals: savedView.immutableTotals,
    notionPageUrl: invoice.notionUrl ?? (invoice.notionPageId ? `https://www.notion.so/${invoice.notionPageId.replace(/-/g, "")}` : null),
  };
}
export async function GET(_request: NextRequest, { params }: Context) {
  try {
    const provider = await getDataProvider();
    const invoice = await provider.invoices.findById((await params).id);
    if (!invoice) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
    return NextResponse.json(await augment(invoice, provider), { headers: NO_STORE_HEADERS });
  } catch (error) { return dataErrorResponse(error); }
}

export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    const provider = await getDataProvider();
    const { id } = await params;
    const existing = await provider.invoices.findById(id);
    if (!existing) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
    const body = await request.json().catch(() => ({}));
    const updated: InvoiceReport = {
      ...existing,
      summary: typeof body.summary === "string" ? body.summary : existing.summary,
      status: typeof body.status === "string" && STATUSES.includes(body.status) ? body.status : existing.status,
      updatedAt: new Date().toISOString(),
    };
    const saved = await provider.invoices.update(id, updated);
    return NextResponse.json(await augment(saved.entity, provider), { headers: NO_STORE_HEADERS });
  } catch (error) { return dataErrorResponse(error); }
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  try {
    const provider = await getDataProvider();
    await provider.invoices.remove((await params).id);
    return NextResponse.json({ ok: true });
  } catch (error) { return dataErrorResponse(error); }
}
