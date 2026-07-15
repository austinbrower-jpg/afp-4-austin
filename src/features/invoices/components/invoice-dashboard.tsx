"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { apiGet } from "@/lib/api-client/http";
import type { InvoiceDashboardData } from "@/lib/invoices/dashboard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const invoiceDashboardQueryKey = ["invoices", "dashboard"] as const;

export function InvoiceDashboardView({ data }: { data: InvoiceDashboardData }) {
  const { summary, clients } = data;
  const stats: Array<[string, string | number]> = [
    ["Draft", summary.byStatus.draft],
    ["Sent", summary.byStatus.sent],
    ["Paid", summary.byStatus.paid],
    ["Void", summary.byStatus.void],
    ["Revenue this month", `$${summary.revenueThisMonth.toFixed(2)}`],
    ["Revenue YTD", `$${summary.revenueYtd.toFixed(2)}`],
    ["Outstanding invoices", summary.outstandingInvoices],
    [
      "Average payment time",
      summary.averagePaymentTimeDays === null ? "Future-ready" : `${summary.averagePaymentTimeDays} days`,
    ],
    ["Total billable hours", summary.totalBillableHours],
  ];

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Invoice Dashboard</h1>
        <p className="text-muted-foreground">Read-only invoice health, revenue, and client billing history.</p>
      </div>
      <section className="grid gap-4 md:grid-cols-3">
        {stats.map(([label, value]) => (
          <Card key={label}>
            <CardHeader><CardTitle className="text-sm text-muted-foreground">{label}</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold">{value}</CardContent>
          </Card>
        ))}
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Client Billing History</h2>
        {clients.length === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            No client billing history is available yet.
          </p>
        ) : clients.map((history) => (
          <Card key={history.clientId}>
            <CardHeader><CardTitle>{history.clientName}</CardTitle></CardHeader>
            <CardContent className="grid gap-2 md:grid-cols-3">
              <p>Invoices: {history.invoices.length}</p>
              <p>Hours billed: {history.hoursBilled}</p>
              <p>Work logs: {history.workLogs.length}</p>
              <p>Total revenue: ${history.totalRevenue.toFixed(2)}</p>
              <p>Average hourly rate: ${history.averageHourlyRate.toFixed(2)}</p>
              <p>Outstanding balance: ${history.outstandingBalance.toFixed(2)}</p>
              <p>Last invoice date: {history.lastInvoiceDate ?? "None"}</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}

export function InvoiceDashboardError({
  retry,
  isRetrying,
}: {
  retry: () => void;
  isRetrying: boolean;
}) {
  return (
    <Alert variant="destructive" className="mx-auto max-w-2xl">
      <AlertTriangle />
      <AlertTitle>Invoice Dashboard could not be loaded</AlertTitle>
      <AlertDescription className="space-y-4">
        <p>The current source request failed or timed out. No Notion records were changed.</p>
        <Button variant="outline" size="sm" disabled={isRetrying} onClick={retry}>
          <RefreshCw className={isRetrying ? "animate-spin" : undefined} />
          {isRetrying ? "Trying again…" : "Try again"}
        </Button>
      </AlertDescription>
    </Alert>
  );
}

function InvoiceDashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2"><Skeleton className="h-9 w-64" /><Skeleton className="h-5 w-96 max-w-full" /></div>
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => <Skeleton className="h-28" key={index} />)}
      </div>
    </div>
  );
}

export function InvoiceDashboard() {
  const query = useQuery({
    queryKey: invoiceDashboardQueryKey,
    queryFn: ({ signal }) =>
      apiGet<InvoiceDashboardData>("/api/invoices/dashboard", { signal, timeoutMs: 20_000 }),
    staleTime: 30_000,
    retry: false,
  });

  if (query.isError) {
    return <InvoiceDashboardError retry={() => void query.refetch()} isRetrying={query.isFetching} />;
  }
  if (!query.data) return <InvoiceDashboardLoading />;
  return <InvoiceDashboardView data={query.data} />;
}
