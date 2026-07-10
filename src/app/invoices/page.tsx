"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { GenerateInvoiceDialog } from "@/features/invoices/components/generate-invoice-dialog";
import { InvoiceListTable } from "@/features/invoices/components/invoice-list-table";
import { useInvoices } from "@/features/invoices/hooks/use-invoices";

export default function InvoicesPage() {
  const { data: invoices, isLoading, isError } = useInvoices();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Invoice Reports</h1>
          <p className="text-sm text-muted-foreground">
            Generate and export weekly invoices from billable hours and logged work.
          </p>
        </div>
        <GenerateInvoiceDialog />
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : isError ? (
        <p className="text-sm text-destructive">Failed to load invoices.</p>
      ) : (
        <InvoiceListTable invoices={invoices ?? []} />
      )}
    </div>
  );
}
