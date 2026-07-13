import { NextRequest, NextResponse } from "next/server";
import { getDataProvider } from "@/lib/data/provider";
import { dataErrorResponse, NO_STORE_HEADERS } from "@/lib/data/route-utils";
import { buildInvoiceSavePreflight, type InvoiceSaveRequest } from "@/lib/invoices/invoice-save";
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
    pdfUrl: typeof body.pdfUrl === "string" ? body.pdfUrl : null,
  };
}

/** Read-only invoice save preflight — writesPerformed is always false. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const saveRequest = parseRequest(body as Record<string, unknown>);
    const provider = await getDataProvider();
    const [dataset, settings, hours, work, invoices] = await Promise.all([
      buildStoredDatasetForSave(provider),
      getReportSettings(),
      provider.hours.list(),
      provider.workLogs.list(),
      provider.invoices.list(),
    ]);

    const preflight = buildInvoiceSavePreflight(
      dataset,
      settings,
      saveRequest,
      invoices,
      hours,
      work,
    );

    return NextResponse.json(preflight, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return dataErrorResponse(error);
  }
}
