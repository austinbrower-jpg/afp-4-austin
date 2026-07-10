import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client/http";
import type { InvoiceReport, InvoiceStatus } from "@/types/domain";
import type { InvoiceDetailResponse } from "@/types/api";

export type { InvoiceDetailResponse };

export interface GenerateInvoiceInput {
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD
}

export interface UpdateInvoiceInput {
  summary?: string;
  status?: InvoiceStatus;
}

export const invoicesApi = {
  list: () => apiGet<InvoiceReport[]>("/api/invoices"),
  get: (id: string) => apiGet<InvoiceDetailResponse>(`/api/invoices/${id}`),
  generate: (input: GenerateInvoiceInput) =>
    apiPost<InvoiceReport>("/api/invoices", input),
  update: (id: string, input: UpdateInvoiceInput) =>
    apiPatch<InvoiceDetailResponse>(`/api/invoices/${id}`, input),
  remove: (id: string) => apiDelete<{ ok: true }>(`/api/invoices/${id}`),
};
