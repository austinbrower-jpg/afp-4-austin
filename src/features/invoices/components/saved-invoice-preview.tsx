"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client/http";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReportDocument } from "@/lib/reports/types";
import { ReportPreview } from "@/features/reports/components/report-preview";

interface SavedInvoicePreviewResponse {
  report: ReportDocument;
  immutableTotals: {
    totalHours: number;
    totalAmount: number;
    hourlyRate: number;
  };
  liveDriftWarnings: string[];
}

export function SavedInvoicePreview({ invoiceId }: { invoiceId: string }) {
  const previewQuery = useQuery({
    queryKey: ["invoice-saved-preview", invoiceId],
    queryFn: () => apiGet<SavedInvoicePreviewResponse>(`/api/invoices/${invoiceId}/preview`),
  });

  if (previewQuery.isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (previewQuery.isError || !previewQuery.data) {
    return null;
  }

  const { report, immutableTotals, liveDriftWarnings } = previewQuery.data;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>Saved invoice preview</CardTitle>
          <Badge variant="outline">Read-only</Badge>
          <Badge variant="secondary">Immutable relations</Badge>
        </div>
        <CardDescription>
          Preview uses only this invoice&apos;s Included Hours and Work Done — not a broad date-range re-query.
          Saved totals: {immutableTotals.totalHours}h · ${immutableTotals.totalAmount.toFixed(2)}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {liveDriftWarnings.length > 0 && (
          <ul className="list-disc pl-4 text-sm text-amber-700">
            {liveDriftWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        )}
        <ReportPreview report={report} />
      </CardContent>
    </Card>
  );
}
