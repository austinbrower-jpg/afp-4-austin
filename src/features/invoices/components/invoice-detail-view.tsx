"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatHours } from "@/lib/calculations";
import { INVOICE_STATUS_BEHAVIOR } from "@/lib/invoices/invoice-status";
import { useInvoice } from "../hooks/use-invoices";
import { InvoiceStatusBadge } from "./invoice-status-badge";
import { InvoiceStatusSelect } from "./invoice-status-select";
import { InvoiceSummaryEditor } from "./invoice-summary-editor";
import { InvoiceExportActions } from "./invoice-export-actions";
import { InvoiceDeleteButton } from "./invoice-delete-button";
import { WorkPerformedList } from "./work-performed-list";
import { SavedInvoicePreview } from "./saved-invoice-preview";
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

  const lifecycleNote = INVOICE_STATUS_BEHAVIOR[invoice.status] ?? INVOICE_STATUS_BEHAVIOR.draft;

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
              {invoice.clientName} · {fmtDate(invoice.periodStart)} – {fmtDate(invoice.periodEnd)}
            </p>
            {invoice.notionPageUrl && (
              <a
                href={invoice.notionPageUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm underline"
              >
                Open in Notion
                <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>
          <div className="flex items-center gap-2">
            <InvoiceStatusSelect invoiceId={invoice.id} status={invoice.status} />
            <InvoiceDeleteButton invoiceId={invoice.id} invoiceNumber={invoice.invoiceNumber} />
          </div>
        </div>
      </div>

      {(invoice.relationWarnings.length > 0 || invoice.liveDriftWarnings.length > 0) && (
        <Alert>
          <AlertTitle>Relation or drift warnings</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 list-disc pl-4">
              {[...invoice.relationWarnings, ...invoice.liveDriftWarnings].map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-xs font-normal text-muted-foreground uppercase tracking-wide">
              Total Hours (saved)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold tabular-nums">
            {formatHours(invoice.immutableTotals.totalHours)}
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-xs font-normal text-muted-foreground uppercase tracking-wide">
              Hourly Rate
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold tabular-nums">
            {formatCurrency(invoice.immutableTotals.hourlyRate)}/hr
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-xs font-normal text-muted-foreground uppercase tracking-wide">
              Total (saved)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold tabular-nums">
            {formatCurrency(invoice.immutableTotals.totalAmount)}
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-xs font-normal text-muted-foreground uppercase tracking-wide">
              Included
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold tabular-nums">
            {invoice.includedHoursCount}h / {invoice.includedWorkDoneCount}w
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invoice metadata</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <span className="text-muted-foreground">Invoice date</span>
            <p>{invoice.invoiceDate ? fmtDate(invoice.invoiceDate) : "—"}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Due date</span>
            <p>{invoice.dueDate ? fmtDate(invoice.dueDate) : "—"}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Payment terms</span>
            <p>{invoice.paymentTerms ?? "—"}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Lifecycle</span>
            <p className="text-muted-foreground">{lifecycleNote}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Included relations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <p className="mb-2 font-medium">Session IDs ({invoice.sessionIds.length})</p>
            {invoice.sessionIds.length === 0 ? (
              <p className="text-muted-foreground">No Session IDs on linked Hours rows.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {invoice.sessionIds.map((sessionId) => (
                  <li key={sessionId}>
                    <Badge variant="outline">{sessionId}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="mb-2 font-medium">Work Log IDs ({invoice.workLogIds.length})</p>
            {invoice.workLogIds.length === 0 ? (
              <p className="text-muted-foreground">No Work Log IDs on linked Work Done rows.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {invoice.workLogIds.map((workLogId) => (
                  <li key={workLogId}>
                    <Badge variant="outline">{workLogId}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

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

      <SavedInvoicePreview invoiceId={invoice.id} />

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
