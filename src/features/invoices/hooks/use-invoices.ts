"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invoicesApi, type GenerateInvoiceInput, type UpdateInvoiceInput } from "../api";

export const invoicesQueryKey = ["invoices"] as const;
export const invoiceQueryKey = (id: string) => ["invoices", id] as const;

export function useInvoices() {
  return useQuery({
    queryKey: invoicesQueryKey,
    queryFn: invoicesApi.list,
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: invoiceQueryKey(id),
    queryFn: () => invoicesApi.get(id),
    enabled: Boolean(id),
  });
}

export function useGenerateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GenerateInvoiceInput) => invoicesApi.generate(input),
    onSuccess: (invoice) => {
      queryClient.invalidateQueries({ queryKey: invoicesQueryKey });
      queryClient.setQueryData(invoiceQueryKey(invoice.id), invoice);
    },
  });
}

export function useUpdateInvoice(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateInvoiceInput) => invoicesApi.update(id, input),
    onSuccess: (invoice) => {
      queryClient.invalidateQueries({ queryKey: invoicesQueryKey });
      queryClient.setQueryData(invoiceQueryKey(id), invoice);
    },
  });
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invoicesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invoicesQueryKey });
    },
  });
}
