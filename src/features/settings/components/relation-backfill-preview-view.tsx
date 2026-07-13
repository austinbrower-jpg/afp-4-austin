"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ExternalLink, LockKeyhole } from "lucide-react";
import { apiGet } from "@/lib/api-client/http";
import type { RelationBackfillPreview } from "@/lib/notion/relation-backfill/preview";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function RelationBackfillPreviewView() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["relation-backfill-preview"],
    queryFn: () => apiGet<RelationBackfillPreview>("/api/notion/relation-backfill-preview"),
  });

  if (isLoading) return <Skeleton className="h-[640px]" />;
  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTriangle />
        <AlertTitle>Preview unavailable</AlertTitle>
        <AlertDescription>{error instanceof Error ? error.message : "Unknown error"}</AlertDescription>
      </Alert>
    );
  }
  if (!data) return null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Relation Backfill Preview</h1>
        <p className="text-muted-foreground">
          Read-only July 8–10 proposal for explicit Notion relations. No writes are performed.
        </p>
      </div>

      <Alert>
        <LockKeyhole />
        <AlertTitle>Read-only preview</AlertTitle>
        <AlertDescription>
          This page compares live Notion values with proposed Session IDs, Work Log IDs, client/project
          relations, and billing/approval status. Writes performed: {String(data.writesPerformed)}.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Operational totals</CardTitle></CardHeader>
          <CardContent className="text-sm">
            <p>{data.totals.billableMinutes} billable min · {data.totals.nonBillableMinutes} non-billable min</p>
            <p>{data.totals.billableHours} billable hr · ${data.totals.amount.toFixed(2)}</p>
            <Badge className="mt-2" variant={data.totals.matchesExpected ? "default" : "destructive"}>
              {data.totals.matchesExpected ? "Matches $493.50 dataset" : "Totals mismatch"}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Quarantine</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {data.quarantineRows.length} superseded row(s) visible but excluded from totals.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Ambiguous matches</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {data.ambiguousMatches.length === 0 ? "None" : `${data.ambiguousMatches.length} need review`}
          </CardContent>
        </Card>
      </div>

      {data.duplicates.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Duplicate Session IDs detected</AlertTitle>
          <AlertDescription><ul className="list-disc pl-4">{data.duplicates.map((d) => <li key={d}>{d}</li>)}</ul></AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Proposed changes</CardTitle>
          <CardDescription>{data.client} · {data.period.start} to {data.period.end}</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entity</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Current</TableHead>
                <TableHead>Proposed</TableHead>
                <TableHead>Match</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.flatMap((row) =>
                row.fields.map((field) => (
                  <TableRow key={`${row.pageId}-${field.property}`} className={row.superseded ? "opacity-60" : undefined}>
                    <TableCell className="capitalize">{row.entity}</TableCell>
                    <TableCell>{row.label}{row.superseded && <Badge variant="destructive" className="ml-2">Superseded</Badge>}</TableCell>
                    <TableCell>{field.property}</TableCell>
                    <TableCell className="max-w-40 truncate text-muted-foreground">{field.currentValue ?? "—"}</TableCell>
                    <TableCell className="max-w-40 truncate">{field.proposedValue ?? "—"}</TableCell>
                    <TableCell>{row.matchSourceLabel ?? "—"}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon-sm" nativeButton={false} render={<a href={row.url} target="_blank" rel="noreferrer" />}><ExternalLink /><span className="sr-only">Open in Notion</span></Button>
                    </TableCell>
                  </TableRow>
                )),
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {data.diagnostics.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Diagnostics</CardTitle></CardHeader>
          <CardContent><ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">{data.diagnostics.map((d) => <li key={d}>{d}</li>)}</ul></CardContent>
        </Card>
      )}

      <Button variant="outline" render={<Link href="/settings" />}>Back to Settings</Button>
    </div>
  );
}
