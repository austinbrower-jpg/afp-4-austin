import { NextRequest, NextResponse } from "next/server";
import { getDataProvider } from "@/lib/data/provider";
import { newEntityBase } from "@/lib/data/entities";
import { dataErrorResponse, NO_STORE_HEADERS } from "@/lib/data/route-utils";
import { amountFromExactMinutes, exactElapsedMinutes, roundCurrency } from "@/lib/reports/engine";
import { buildLineItems, buildSummary, nextInvoiceNumber } from "@/lib/invoices/generate";
import type { InvoiceReport } from "@/types/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const provider = await getDataProvider();
    const client = (await provider.clients.list())[0];
    const invoices = client ? (await provider.invoices.list()).filter((invoice) => invoice.clientId === client.id) : [];
    return NextResponse.json(invoices.sort((a, b) => b.periodEnd.localeCompare(a.periodEnd)), { headers: NO_STORE_HEADERS });
  } catch (error) { return dataErrorResponse(error); }
}
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const periodStart = typeof body.periodStart === "string" ? body.periodStart : "";
    const periodEnd = typeof body.periodEnd === "string" ? body.periodEnd : "";
    if (!periodStart || !periodEnd || periodStart > periodEnd) return NextResponse.json({ error: "A valid billing period is required." }, { status: 400 });
    const provider = await getDataProvider();
    if (provider.mode === "notion" && body.previewConfirmed !== true) {
      return NextResponse.json({ error: "Preview or export the report before saving invoice metadata to Notion." }, { status: 409 });
    }
    const [workspace, client, allHours, allWorkLogs, invoices] = await Promise.all([
      provider.workspace(), provider.clients.list().then((rows) => rows[0]), provider.hours.list(), provider.workLogs.list(), provider.invoices.list(),
    ]);
    if (!workspace || !client) return NextResponse.json({ error: "No workspace/client configured." }, { status: 400 });
    const billable = allHours.filter((entry) => entry.clientId === client.id && entry.billable && entry.date >= periodStart && entry.date <= periodEnd);
    const totalMinutes = billable.reduce((sum, entry) => sum + exactElapsedMinutes(entry.startTime, entry.endTime, entry.breakMinutes), 0);
    const totalAmount = roundCurrency(billable.reduce((sum, entry) => sum + amountFromExactMinutes(exactElapsedMinutes(entry.startTime, entry.endTime, entry.breakMinutes), entry.hourlyRate), 0));
    const workLogs = allWorkLogs.filter((entry) => entry.clientId === client.id && entry.date >= periodStart && entry.date <= periodEnd);
    const lineItems = buildLineItems(workLogs, billable.map((entry) => ({ ...entry, totalHours: exactElapsedMinutes(entry.startTime, entry.endTime, entry.breakMinutes) / 60 })));
    const hourlyRate = billable[0]?.hourlyRate ?? client.defaultHourlyRate;
    const invoiceNumber = typeof body.invoiceNumber === "string" && body.invoiceNumber.trim()
      ? body.invoiceNumber.trim()
      : nextInvoiceNumber(client.name, invoices);
    const invoice: InvoiceReport = {
      ...newEntityBase("invoice"),
      workspaceId: workspace.id,
      clientId: client.id,
      invoiceNumber,
      periodStart,
      periodEnd,
      hourlyRate,
      totalHours: totalMinutes / 60,
      totalAmount,
      summary: typeof body.summary === "string" ? body.summary : buildSummary(periodStart, periodEnd, lineItems, totalMinutes / 60, hourlyRate),
      lineItems,
      hoursEntryIds: billable.map((entry) => entry.id),
      status: "draft",
    };
    const saved = await provider.invoices.create(invoice);
    return NextResponse.json({ ...saved.entity, persistence: saved }, { status: 201, headers: NO_STORE_HEADERS });
  } catch (error) { return dataErrorResponse(error); }
}
