"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  ArrowLeft,
  Info,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatHours } from "@/lib/calculations";
import { useMigrationPreview } from "../hooks";
import { DownloadJsonButton } from "./download-json-button";
import type {
  MigrationAction,
  ProposedHoursRecord,
  ProposedRecord,
  ProposedWorkLogRecord,
} from "@/lib/notion/migration/types";

const PROJECT_LABELS: Record<string, string> = {
  bolReviewV2: "BOL Review Process V2",
  commandCenter: "AFP Command Center / Sales & Operations Hub",
  powerAutomateDocs: "Power Automate Documentation",
};

function ActionBadge({ action }: { action: MigrationAction }) {
  return action === "create" ? (
    <Badge variant="secondary">Would create</Badge>
  ) : (
    <Badge variant="outline">Skip - already exists</Badge>
  );
}

function ProjectBadge({ projectKey }: { projectKey: string | null }) {
  if (!projectKey) {
    return <Badge variant="outline">Unassigned</Badge>;
  }
  return <Badge variant="secondary">{PROJECT_LABELS[projectKey] ?? projectKey}</Badge>;
}

export function MigrationPreviewView() {
  const { data, isLoading, isError, error, refetch, isFetching } = useMigrationPreview();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Button variant="ghost" size="sm" className="w-fit" render={<Link href="/settings" />}>
          <ArrowLeft />
          Back to settings
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Migration Dry Run</h1>
            <p className="text-muted-foreground">
              Preview-only: what a real migration of the historical AFP-Work Notion pages would
              create. Nothing below has been written to Notion or SQLite.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="flex items-center gap-1">
              <ShieldCheck className="size-3" />
              No writes performed
            </Badge>
            <Button variant="outline" disabled={isFetching} onClick={() => refetch()}>
              <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
              Re-run
            </Button>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {isError && (
        <Card>
          <CardContent className="pt-6 text-sm text-destructive">
            Failed to build the dry run: {error instanceof Error ? error.message : "Unknown error"}
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Source records</CardTitle>
              <CardDescription>
                Read-only transcription of four live Notion pages. Generated{" "}
                {formatDistanceToNow(new Date(data.generatedAt), { addSuffix: true })} - schema v
                {data.schemaVersion}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-2 sm:grid-cols-2">
                {data.sourcePages.map((p) => (
                  <li key={p.id} className="rounded-lg border border-border p-2.5 text-sm">
                    <a href={p.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                      {p.title}
                    </a>
                    <p className="text-xs text-muted-foreground">
                      Read {formatDistanceToNow(new Date(p.fetchedAt), { addSuffix: true })}
                    </p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reconciliation</CardTitle>
              <CardDescription>
                Recalculated directly from source sessions - not assumed from the page&apos;s own
                stated totals.
              </CardDescription>
              <CardAction>
                <Badge variant={data.totals.matchesSourceStated ? "secondary" : "destructive"}>
                  {data.totals.matchesSourceStated ? "Matches source-stated totals" : "Mismatch found"}
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Billable hours</p>
                  <p className="text-lg font-semibold">{formatHours(data.totals.totalBillableHours)}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Non-billable hours</p>
                  <p className="text-lg font-semibold">{formatHours(data.totals.totalNonBillableHours)}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Invoice amount</p>
                  <p className="text-lg font-semibold">{formatCurrency(data.totals.totalInvoiceAmount)}</p>
                  <p className="text-xs text-muted-foreground">
                    source-stated: {formatCurrency(data.totals.sourceStated.totalInvoiceAmount)}
                  </p>
                </div>
              </div>

              <Separator />

              <div>
                <p className="mb-2 text-sm font-medium">Per-day totals</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Billable</TableHead>
                      <TableHead>Non-billable</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Source-stated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.totals.perDay.map((d) => (
                      <TableRow key={d.date}>
                        <TableCell className="font-medium">{d.date}</TableCell>
                        <TableCell>{formatHours(d.billableHours)}</TableCell>
                        <TableCell>{formatHours(d.nonBillableHours)}</TableCell>
                        <TableCell>{formatCurrency(d.amount)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {data.totals.sourceStated.perDay[d.date]
                            ? `${data.totals.sourceStated.perDay[d.date].hours.toFixed(2)}h / ${formatCurrency(data.totals.sourceStated.perDay[d.date].amount)}`
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-2 rounded-lg border border-border p-3">
                <p className="text-sm font-medium">Billing convention (approved 2026-07-10)</p>
                <p className="text-xs text-muted-foreground">
                  Amounts are computed from exact elapsed minutes (exactMinutes/60 × hourlyRate),
                  rounding only the final dollar total to cents - never from hours pre-rounded to
                  hundredths. This app&apos;s default per-entry rounding convention was evaluated and
                  would have produced{" "}
                  <span className="font-medium text-foreground">
                    {formatCurrency(data.totals.referenceAppConventionTotal)}
                  </span>{" "}
                  for this dataset; that convention was explicitly rejected for this migration in
                  favor of the exact-minute total above.
                </p>
              </div>

              {data.totals.discrepancies.length > 0 && (
                <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="size-3.5" />
                    Discrepancies found
                  </p>
                  <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                    {data.totals.discrepancies.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Proposed client</CardTitle>
              <CardAction>
                <ActionBadge action={data.proposedClient.action} />
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="font-medium">{data.proposedClient.record.name}</p>
              <p className="text-muted-foreground">
                {formatCurrency(data.proposedClient.record.defaultHourlyRate)}/hr ·{" "}
                {data.proposedClient.record.timezone} · {data.proposedClient.record.status}
              </p>
              <p className="text-xs text-muted-foreground">{data.proposedClient.record.notes}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Proposed projects ({data.proposedProjects.length})</CardTitle>
              <CardDescription>Derived only from workstreams actually evidenced in the source content.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {data.proposedProjects.map((p) => (
                <div key={p.syntheticId} className="rounded-lg border border-border p-3 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{p.record.name}</p>
                    <ActionBadge action={p.action} />
                  </div>
                  <p className="text-xs text-muted-foreground">{p.record.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <ProposedHoursCard rows={data.proposedHours} />
          <ProposedWorkLogsCard rows={data.proposedWorkLogs} />

          <Card>
            <CardHeader>
              <CardTitle>Warnings ({data.warnings.length})</CardTitle>
              <CardDescription>Everything the parser couldn&apos;t determine automatically - review before approving a real migration.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.warnings.map((w) => (
                <div key={w.code} className="flex gap-2 rounded-lg border border-border p-2.5 text-sm">
                  {w.severity === "warning" ? (
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
                  ) : (
                    <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <div>
                    <p>{w.message}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Affects: {w.relatedIds.join(", ")}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Skipped / duplicates ({data.skipped.length})</CardTitle>
              <CardDescription>Records that already exist locally and would not be re-created.</CardDescription>
            </CardHeader>
            <CardContent>
              {data.skipped.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  None - nothing matching these records exists locally yet.
                </p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {data.skipped.map((s) => (
                    <li key={s.syntheticId}>
                      <span className="font-medium">{s.type}</span> {s.syntheticId} - {s.reason}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Export</CardTitle>
              <CardDescription>
                Copy or download this exact preview as JSON. Contains no API keys or secrets.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DownloadJsonButton result={data} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function ProposedHoursCard({ rows }: { rows: ProposedRecord<ProposedHoursRecord>[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Proposed hours ({rows.length})</CardTitle>
        <CardDescription>Every historical billable and non-billable session.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Hours (exact)</TableHead>
                <TableHead>Billable</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((h) => {
                const hasReferenceDiff =
                  h.record.billable && h.record.referenceAppRoundedAmount !== h.record.expectedAmount;
                return (
                  <TableRow key={h.syntheticId}>
                    <TableCell className="font-medium">{h.record.date}</TableCell>
                    <TableCell>{h.record.startTime}</TableCell>
                    <TableCell>{h.record.endTime}</TableCell>
                    <TableCell>{h.record.totalHours.toFixed(4)}h</TableCell>
                    <TableCell>
                      <Badge variant={h.record.billable ? "default" : "secondary"}>
                        {h.record.billable ? "Billable" : "Non-billable"}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-32 truncate" title={h.record.location}>
                      {h.record.location}
                    </TableCell>
                    <TableCell>
                      <ProjectBadge projectKey={h.record.projectKey} />
                    </TableCell>
                    <TableCell>
                      {formatCurrency(h.record.expectedAmount)}
                      {hasReferenceDiff && (
                        <span
                          className="ml-1 text-xs text-muted-foreground"
                          title="What this app's default rounded-hours convention would have produced (rejected for this migration)"
                        >
                          (ref: {formatCurrency(h.record.referenceAppRoundedAmount)})
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <ActionBadge action={h.action} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function ProposedWorkLogsCard({ rows }: { rows: ProposedRecord<ProposedWorkLogRecord>[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Proposed work logs ({rows.length})</CardTitle>
        <CardDescription>July 8 and July 9, with invoice-ready descriptions and related hours rows.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.map((w) => (
          <div key={w.syntheticId} className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{w.record.title}</p>
              <div className="flex flex-wrap items-center gap-2">
                <ProjectBadge projectKey={w.record.projectKey} />
                {w.record.relatedProjectKeys.map((k) => (
                  <Badge key={k} variant="outline">
                    + {PROJECT_LABELS[k] ?? k}
                  </Badge>
                ))}
                <ActionBadge action={w.action} />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{w.record.summary}</p>
            {w.record.relatedProjectsNote && (
              <p className="text-xs text-muted-foreground italic">{w.record.relatedProjectsNote}</p>
            )}
            <div>
              <p className="text-xs font-medium">Invoice-ready description</p>
              <p className="whitespace-pre-line text-xs text-muted-foreground">
                {w.record.invoiceDescription}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Related hours: {w.record.relatedHoursSyntheticIds.join(", ")}
            </p>
            <a
              href={w.record.detailedSourceReference.split(" - ")[0]}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary hover:underline"
            >
              Full source detail →
            </a>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
