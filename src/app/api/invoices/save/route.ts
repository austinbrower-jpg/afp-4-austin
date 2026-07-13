import { NextRequest, NextResponse } from "next/server";
import { getNotionClient } from "@/lib/notion/client";
import { getNotionConfig } from "@/lib/notion/config";
import { getDataProvider } from "@/lib/data/provider";
import { dataErrorResponse, NO_STORE_HEADERS } from "@/lib/data/route-utils";
import { applyInvoiceSave } from "@/lib/invoices/invoice-save-apply";
import { type InvoiceSaveRequest } from "@/lib/invoices/invoice-save";
import { buildStoredDatasetForSave } from "@/lib/invoices/invoice-save-data";
import { getReportSettings } from "@/lib/reports/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseRequest(body: Record<string, unknown>): InvoiceSaveRequest {
  return {
    type: body.type === "detailed-invoice" ? "detailed-invoice" : "simple-invoice",
    clientId: typeof body.clientId === "string" ? body.clientId : "",
    periodStart: typeof body.periodStart === "string" ? body.periodStart : "",
    periodEnd: typeof body.periodEnd === "string" ? body.periodEnd : "",
    projectIds: Array.isArray(body.projectIds) ? body.projectIds.filter((id): id is string => typeof id === "string") : [],
    invoiceNumber: typeof body.invoiceNumber === "string" ? body.invoiceNumber : "",
    invoiceDate: typeof body.invoiceDate === "string" ? body.invoiceDate : "",
    dueDate: typeof body.dueDate === "string" ? body.dueDate : "",
    paymentTerms: typeof body.paymentTerms === "string" ? body.paymentTerms : "",
    customTitle: typeof body.customTitle === "string" ? body.customTitle : "",
    notes: typeof body.notes === "string" ? body.notes : "",
    executiveSummary: typeof body.executiveSummary === "string" ? body.executiveSummary : "",
    draftDescriptions:
      body.draftDescriptions && typeof body.draftDescriptions === "object"
        ? (body.draftDescriptions as Record<string, string>)
        : {},
    confirmationPhrase: typeof body.confirmationPhrase === "string" ? body.confirmationPhrase : undefined,
    pdfUrl: typeof body.pdfUrl === "string" ? body.pdfUrl : null,
  };
}

/** Explicit invoice save — gated by NOTION_INVOICE_SAVE_ENABLED and confirmation phrase. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const saveRequest = parseRequest(body as Record<string, unknown>);
    const provider = await getDataProvider();
    const [dataset, settings, hours, work, invoices, workspace] = await Promise.all([
      buildStoredDatasetForSave(provider),
      getReportSettings(),
      provider.hours.list(),
      provider.workLogs.list(),
      provider.invoices.list(),
      provider.workspace(),
    ]);

    const notion = getNotionClient();
    const databases = getNotionConfig().databases;
    if (!notion || !databases.invoice) {
      return NextResponse.json({ error: "Notion invoice database is not configured." }, { status: 503 });
    }

    if (!workspace) {
      return NextResponse.json({ error: "Workspace is not configured." }, { status: 503, headers: NO_STORE_HEADERS });
    }

    const result = await applyInvoiceSave({
      notion,
      invoiceDatabaseId: databases.invoice,
      dataset,
      settings,
      request: saveRequest,
      existingInvoices: invoices,
      allHours: hours,
      allWork: work,
      workspaceId: workspace.id,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: result.stoppedEarly ? 409 : 500, headers: NO_STORE_HEADERS });
    }
    return NextResponse.json(result, { status: 201, headers: NO_STORE_HEADERS });
  } catch (error) {
    return dataErrorResponse(error);
  }
}
