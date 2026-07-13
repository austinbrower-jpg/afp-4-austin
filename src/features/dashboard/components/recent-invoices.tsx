"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Receipt } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/calculations";
import { InvoiceStatusBadge } from "@/features/invoices/components/invoice-status-badge";
import type { DashboardSummary } from "../api";

export function RecentInvoices({
  summary,
  isLoading,
}: {
  summary: DashboardSummary | undefined;
  isLoading: boolean;
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Receipt className="size-4 text-muted-foreground" />
          Recent Invoices
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading || !summary ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))
        ) : summary.recentInvoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">No invoices yet.</p>
        ) : (
          summary.recentInvoices.map((invoice) => (
            <Link
              key={invoice.id}
              href={`/invoices/${invoice.id}`}
              className="flex items-start justify-between gap-3 rounded-lg border border-transparent px-2 py-1.5 -mx-2 transition-colors hover:border-border hover:bg-muted/40"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{invoice.invoiceNumber}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {format(parseISO(invoice.periodEnd), "MMM d, yyyy")} · {formatCurrency(invoice.totalAmount)}
                </p>
              </div>
              <InvoiceStatusBadge status={invoice.status} className="shrink-0" />
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
