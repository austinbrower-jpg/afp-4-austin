import { NextRequest, NextResponse } from "next/server";
import { initDb, invoiceRepo, workLogRepo, clientRepo, nowISO } from "@/lib/db";
import { syncEntityNow } from "@/lib/notion/sync-engine";
import type { InvoiceReport, InvoiceStatus } from "@/types/domain";
import type { InvoiceDetailResponse, WorkPerformedRow } from "@/types/api";

export type { InvoiceDetailResponse, WorkPerformedRow };

const VALID_STATUSES: InvoiceStatus[] = ["draft", "sent", "paid", "void"];

function augment(invoice: InvoiceReport): InvoiceDetailResponse {
  const workPerformed: WorkPerformedRow[] = invoice.lineItems.map((li) => {
    const workLog = workLogRepo.findById(li.workLogId);
    return {
      workLogId: li.workLogId,
      title: workLog?.title ?? li.title,
      description: (workLog?.invoiceDescription || workLog?.summary) ?? li.description,
      hours: li.hours,
      href: workLog ? `/work-done/${workLog.id}` : null,
    };
  });
  const clientName = clientRepo.findById(invoice.clientId)?.name ?? "Client";
  return { ...invoice, clientName, workPerformed };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  initDb();
  const { id } = await params;
  const invoice = invoiceRepo.findById(id);
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }
  return NextResponse.json(augment(invoice));
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  initDb();
  const { id } = await params;
  const existing = invoiceRepo.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const patch: Partial<Pick<InvoiceReport, "summary" | "status">> = {};

  if (typeof body?.summary === "string") {
    patch.summary = body.summary;
  }
  if (typeof body?.status === "string" && VALID_STATUSES.includes(body.status)) {
    patch.status = body.status as InvoiceStatus;
  }

  const updated: InvoiceReport = {
    ...existing,
    ...patch,
    updatedAt: nowISO(),
  };
  invoiceRepo.update(id, updated);
  await syncEntityNow("invoice", id);

  return NextResponse.json(augment(updated));
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  initDb();
  const { id } = await params;
  const existing = invoiceRepo.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }
  invoiceRepo.remove(id);
  return NextResponse.json({ ok: true });
}
