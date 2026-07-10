import "server-only";
import type { InvoiceLineItem, InvoiceReport } from "@/types/domain";
import {
  createRepository,
  RepoRow,
  SYNC_COLUMNS,
  syncFromRow,
  syncToRow,
  toJSON,
  fromJSON,
} from "../repository";

const COLUMNS = [
  "id",
  "workspace_id",
  "client_id",
  "invoice_number",
  "period_start",
  "period_end",
  "hourly_rate",
  "total_hours",
  "total_amount",
  "summary",
  "line_items",
  "hours_entry_ids",
  "status",
  ...SYNC_COLUMNS,
  "created_at",
  "updated_at",
];

function toRow(e: InvoiceReport): RepoRow {
  return {
    id: e.id,
    workspace_id: e.workspaceId,
    client_id: e.clientId,
    invoice_number: e.invoiceNumber,
    period_start: e.periodStart,
    period_end: e.periodEnd,
    hourly_rate: e.hourlyRate,
    total_hours: e.totalHours,
    total_amount: e.totalAmount,
    summary: e.summary,
    line_items: toJSON(e.lineItems),
    hours_entry_ids: toJSON(e.hoursEntryIds),
    status: e.status,
    ...syncToRow(e),
    created_at: e.createdAt,
    updated_at: e.updatedAt,
  };
}

function fromRow(row: RepoRow): InvoiceReport {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    clientId: row.client_id as string,
    invoiceNumber: row.invoice_number as string,
    periodStart: row.period_start as string,
    periodEnd: row.period_end as string,
    hourlyRate: row.hourly_rate as number,
    totalHours: row.total_hours as number,
    totalAmount: row.total_amount as number,
    summary: row.summary as string,
    lineItems: fromJSON<InvoiceLineItem[]>(row.line_items, []),
    hoursEntryIds: fromJSON<string[]>(row.hours_entry_ids, []),
    status: row.status as InvoiceReport["status"],
    ...syncFromRow(row),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export const invoiceRepo = createRepository<InvoiceReport>({
  table: "invoice_reports",
  columns: COLUMNS,
  toRow,
  fromRow,
});

export function listInvoicesByClient(clientId: string): InvoiceReport[] {
  return invoiceRepo.where("client_id = ?", [clientId], "period_start DESC");
}
