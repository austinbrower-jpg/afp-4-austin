"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatHours } from "@/lib/calculations";
import { useInvoice } from "../hooks/use-invoices";
import { InvoiceStatusBadge } from "./invoice-status-badge";
import { InvoiceStatusSelect } from "./invoice-status-select";
import { InvoiceSummaryEditor } from "./invoice-summary-editor";
import { InvoiceExportActions } from "./invoice-export-actions";
import { InvoiceDeleteButton } from "./invoice-delete-button";
import { WorkPerformedList } from "./work-performed-list";
import type { InvoiceExportData } from "../lib/export";

function fmtDate(iso: string): string {
  try {
    return format(parseISO(iso), "MMM d, yyyy");
  } catch {
    return iso;
  }
}

export function InvoiceDetailView({ invoiceId }: { invoiceId: string }) {
  const { data: invoice, isLoading, isError } = useInvoice(invoiceId);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !invoice) {
    return (
      <div className="flex flex-col gap-3">
        <Link href="/invoices" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          Back to invoices
        </Link>
        <p className="text-sm text-destructive">
          Couldn&apos;t find that invoice. It may have been deleted.
        </p>
      </div>
    );
  }

  const exportData: InvoiceExportData = {
    invoice,
    clientName: invoice.clientName,
    workPerformed: invoice.workPerformed,
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Link
          href="/invoices"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to invoices
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{invoice.invoiceNumber}</h1>
              <InvoiceStatusBadge status={invoice.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {fmtDate(invoice.periodStart)} – {fmtDate(invoice.periodEnd)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <InvoiceStatusSelect invoiceId={invoice.id} status={invoice.status} />
            <InvoiceDeleteButton invoiceId={invoice.id} invoiceNumber={invoice.invoiceNumber} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-xs font-normal text-muted-foreground uppercase tracking-wide">
              Total Hours
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold tabular-nums">
            {formatHours(invoice.totalHours)}
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-xs font-normal text-muted-foreground uppercase tracking-wide">
              Hourly Rate
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold tabular-nums">
            {formatCurrency(invoice.hourlyRate)}/hr
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-xs font-normal text-muted-foreground uppercase tracking-wide">
              Total
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold tabular-nums">
            {formatCurrency(invoice.totalAmount)}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <InvoiceSummaryEditor invoiceId={invoice.id} summary={invoice.summary} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Work Performed</CardTitle>
        </CardHeader>
        <CardContent>
          <WorkPerformedList items={invoice.workPerformed} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Export</CardTitle>
        </CardHeader>
        <CardContent>
          <InvoiceExportActions data={exportData} />
        </CardContent>
      </Card>
    </div>
  );
}
