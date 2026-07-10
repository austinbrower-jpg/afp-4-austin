import { NextRequest, NextResponse } from "next/server";
import {
  initDb,
  workspaceRepo,
  clientRepo,
  workLogRepo,
  invoiceRepo,
  listHoursByRange,
  listInvoicesByClient,
  newId,
  nowISO,
  newSyncable,
} from "@/lib/db";
import { sumHours, sumBillableAmount } from "@/lib/calculations";
import { nextInvoiceNumber, buildLineItems, buildSummary } from "@/lib/invoices/generate";
import { syncEntityNow } from "@/lib/notion/sync-engine";
import type { InvoiceReport } from "@/types/domain";

export async function GET() {
  initDb();
  const client = clientRepo.all()[0];
  if (!client) return NextResponse.json([]);
  return NextResponse.json(listInvoicesByClient(client.id));
}

export async function POST(request: NextRequest) {
  initDb();

  const body = await request.json().catch(() => ({}));
  const periodStart = typeof body?.periodStart === "string" ? body.periodStart : null;
  const periodEnd = typeof body?.periodEnd === "string" ? body.periodEnd : null;

  if (!periodStart || !periodEnd || periodStart > periodEnd) {
    return NextResponse.json(
      { error: "periodStart and periodEnd (YYYY-MM-DD) are required, with periodStart <= periodEnd." },
      { status: 400 },
    );
  }

  const workspace = workspaceRepo.all()[0];
  const client = clientRepo.all()[0];
  if (!workspace || !client) {
    return NextResponse.json({ error: "No workspace/client configured" }, { status: 400 });
  }

  const billableEntries = listHoursByRange(client.id, periodStart, periodEnd).filter(
    (e) => e.billable,
  );
  const totalHours = sumHours(billableEntries);
  const totalAmount = sumBillableAmount(billableEntries);
  const hourlyRate = client.defaultHourlyRate;

  const worklogsInRange = workLogRepo.where(
    "client_id = ? AND date >= ? AND date <= ?",
    [client.id, periodStart, periodEnd],
    "date ASC",
  );
  const lineItems = buildLineItems(worklogsInRange, billableEntries);

  const existingInvoices = listInvoicesByClient(client.id);
  const invoiceNumber = nextInvoiceNumber(client.name, existingInvoices);

  const now = nowISO();
  const invoice: InvoiceReport = {
    id: newId("inv"),
    workspaceId: workspace.id,
    clientId: client.id,
    invoiceNumber,
    periodStart,
    periodEnd,
    hourlyRate,
    totalHours,
    totalAmount,
    summary: buildSummary(periodStart, periodEnd, lineItems, totalHours, hourlyRate),
    lineItems,
    hoursEntryIds: billableEntries.map((e) => e.id),
    status: "draft",
    ...newSyncable(),
    createdAt: now,
    updatedAt: now,
  };

  invoiceRepo.insert(invoice);
  await syncEntityNow("invoice", invoice.id);

  return NextResponse.json(invoice, { status: 201 });
}
