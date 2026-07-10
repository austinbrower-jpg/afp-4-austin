"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CircleDashed,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  XCircle,
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
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatHours } from "@/lib/calculations";
import { IMPORT_CONFIRMATION_PHRASE } from "@/lib/notion/migration/one-time-import";
import { useImportPreflight, useRunImport } from "../hooks";
import type { ImportResult, PreflightReport } from "../api";

function CheckRow({ check }: { check: PreflightReport["checks"][number] }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-border p-2.5 text-sm">
      {check.passed ? (
        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
      ) : (
        <XCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
      )}
      <div>
        <p className="font-mono text-xs text-muted-foreground">{check.code}</p>
        <p>{check.message}</p>
      </div>
    </div>
  );
}

function PreflightSection({ report, onRecheck, isFetching }: { report: PreflightReport; onRecheck: () => void; isFetching: boolean }) {
  const { dryRun } = report;
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Step 1 - Preflight &amp; preview</CardTitle>
          <CardDescription>
            Checked {formatDistanceToNow(new Date(report.checkedAt), { addSuffix: true })}. Every check below is
            re-run live, immediately before any write is attempted.
          </CardDescription>
          <CardAction className="flex items-center gap-2">
            <Badge variant="secondary" className="flex items-center gap-1">
              <ShieldCheck className="size-3" />
              No writes yet
            </Badge>
            <Badge variant={report.ready ? "secondary" : "destructive"}>{report.ready ? "Ready" : "Not ready"}</Badge>
            <Button variant="outline" size="sm" disabled={isFetching} onClick={onRecheck}>
              <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
              Re-check
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-2">
          {report.checks.map((c) => (
            <CheckRow key={c.code} check={c} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Exact records and counts</CardTitle>
          <CardDescription>What this import would create, resolved from the Phase 5 dry run.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg border border-border p-3 text-center">
              <p className="text-2xl font-semibold">1</p>
              <p className="text-xs text-muted-foreground">Client</p>
            </div>
            <div className="rounded-lg border border-border p-3 text-center">
              <p className="text-2xl font-semibold">{dryRun.proposedProjects.length}</p>
              <p className="text-xs text-muted-foreground">Projects</p>
            </div>
            <div className="rounded-lg border border-border p-3 text-center">
              <p className="text-2xl font-semibold">{dryRun.proposedHours.length}</p>
              <p className="text-xs text-muted-foreground">Hours rows</p>
            </div>
            <div className="rounded-lg border border-border p-3 text-center">
              <p className="text-2xl font-semibold">{dryRun.proposedWorkLogs.length}</p>
              <p className="text-xs text-muted-foreground">Work logs</p>
            </div>
          </div>
          <Separator />
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Billable hours</p>
              <p className="font-semibold">{formatHours(dryRun.totals.totalBillableHours)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Non-billable hours</p>
              <p className="font-semibold">{formatHours(dryRun.totals.totalNonBillableHours)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Invoice amount</p>
              <p className="font-semibold">{formatCurrency(dryRun.totals.totalInvoiceAmount)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Schema &amp; duplicate scan</CardTitle>
          <CardDescription>
            Migration Key / Project relation property status per database, and any records already matched by
            migration key in live Notion.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {report.schemaSetup.map((s) => (
              <div key={s.type} className="rounded-lg border border-border p-2.5 text-xs">
                <p className="font-medium capitalize">{s.type}</p>
                <p className="text-muted-foreground">
                  Migration Key: {s.migrationKeyPropertyPresent ? "present" : "will be added"}
                  {s.projectRelationPropertyPresent !== null &&
                    ` · Project relation: ${s.projectRelationPropertyPresent ? "present" : "will be added"}`}
                </p>
              </div>
            ))}
          </div>
          <div className="text-sm">
            {report.existingByKey.length === 0 ? (
              <p className="text-muted-foreground">No existing migration-key matches found - this looks like a fresh run.</p>
            ) : (
              <p className="text-muted-foreground">
                {report.existingByKey.length} of {1 + dryRun.proposedProjects.length + dryRun.proposedHours.length + dryRun.proposedWorkLogs.length} records
                already exist in Notion (matched by Migration Key) and will be skipped, not recreated.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function RecordList({
  title,
  items,
}: {
  title: string;
  items: Array<{ type: string; syntheticId: string; migrationKey: string; notionUrl?: string; error?: string }>;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-2 text-sm font-medium">
        {title} ({items.length})
      </p>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={`${item.type}-${item.migrationKey}`} className="rounded-lg border border-border p-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span>
                <span className="font-medium capitalize">{item.type}</span> · {item.syntheticId}
              </span>
              {item.notionUrl && (
                <a href={item.notionUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  Open in Notion →
                </a>
              )}
            </div>
            <p className="text-muted-foreground">{item.migrationKey}</p>
            {item.error && <p className="text-destructive">{item.error}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ResultsSection({ result }: { result: ImportResult }) {
  const status = !result.confirmationAccepted
    ? { label: "Confirmation rejected", variant: "destructive" as const, icon: XCircle }
    : !result.preflight?.ready
      ? { label: "Blocked by preflight", variant: "destructive" as const, icon: ShieldAlert }
      : result.ok
        ? { label: "Import complete", variant: "secondary" as const, icon: CheckCircle2 }
        : { label: "Partial failure - stopped early", variant: "destructive" as const, icon: AlertTriangle };

  const Icon = status.icon;

  return (
    <Card data-testid="import-results">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="size-4" />
          Results
        </CardTitle>
        <CardDescription>
          Run {result.runId} · started {new Date(result.startedAt).toLocaleString()} · finished{" "}
          {new Date(result.finishedAt).toLocaleString()}
        </CardDescription>
        <CardAction>
          <Badge variant={status.variant}>{status.label}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        {result.confirmationError && <p className="text-sm text-destructive">{result.confirmationError}</p>}

        {result.preflight && !result.preflight.ready && (
          <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-sm font-medium text-destructive">Preflight failed - nothing was written.</p>
            {result.preflight.checks
              .filter((c) => !c.passed)
              .map((c) => (
                <p key={c.code} className="text-xs text-muted-foreground">
                  {c.code}: {c.message}
                </p>
              ))}
          </div>
        )}

        {result.totals && (
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Billable hours</p>
              <p className="font-semibold">{formatHours(result.totals.totalBillableHours)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Non-billable hours</p>
              <p className="font-semibold">{formatHours(result.totals.totalNonBillableHours)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Invoice amount</p>
              <p className="font-semibold">{formatCurrency(result.totals.totalInvoiceAmount)}</p>
            </div>
          </div>
        )}

        {result.schemaChangesApplied.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Additive schema changes applied: {result.schemaChangesApplied.map((c) => `${c.type}.${c.property}`).join(", ")}
          </p>
        )}

        <RecordList title="Created" items={result.created} />
        <RecordList title="Skipped (duplicate)" items={result.skipped} />
        <RecordList title="Failed" items={result.failed} />

        {result.created.length === 0 && result.skipped.length === 0 && result.failed.length === 0 && (
          <p className="text-sm text-muted-foreground">No records were created, skipped, or failed.</p>
        )}
      </CardContent>
    </Card>
  );
}

export function MigrationImportView() {
  const { data: preflight, isLoading, isFetching, refetch } = useImportPreflight();
  const { mutate: runImport, data: result, isPending } = useRunImport();

  const handleConfirm = (phrase: string) => {
    runImport(phrase, {
      onSuccess: () => refetch(),
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Button variant="ghost" size="sm" className="w-fit" render={<Link href="/settings" />}>
          <ArrowLeft />
          Back to settings
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Historical Notion Import</h1>
          <p className="text-muted-foreground">
            One-time, narrowly scoped write of the approved July 8-9 historical records to live Notion, with
            duplicate protection. Never enables general sync.
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      )}

      {preflight && (
        <>
          <PreflightSection report={preflight} onRecheck={() => refetch()} isFetching={isFetching} />
          <ConfirmationSectionWithInput preflight={preflight} onConfirm={handleConfirm} isPending={isPending} />
        </>
      )}

      {result && <ResultsSection result={result} />}
    </div>
  );
}

function ConfirmationSectionWithInput({
  preflight,
  onConfirm,
  isPending,
}: {
  preflight: PreflightReport;
  onConfirm: (phrase: string) => void;
  isPending: boolean;
}) {
  const [typed, setTyped] = useState("");
  const matches = typed === IMPORT_CONFIRMATION_PHRASE;
  const disabled = !preflight.ready;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="size-4 text-amber-500" />
          Step 2 - Confirm and import
        </CardTitle>
        <CardDescription>
          {disabled
            ? "Preflight isn't ready yet - fix the failing checks above before this step unlocks."
            : "This will write to your real Notion workspace. Type the confirmation phrase exactly to enable the import button - there is no checkbox shortcut."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!disabled && (
          <>
            <p className="text-sm">
              Type <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{IMPORT_CONFIRMATION_PHRASE}</code>{" "}
              below:
            </p>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={IMPORT_CONFIRMATION_PHRASE}
              disabled={isPending}
              autoComplete="off"
              data-testid="import-confirmation-input"
            />
            <Button
              variant="default"
              disabled={!matches || isPending}
              onClick={() => onConfirm(typed)}
              data-testid="import-confirm-button"
            >
              {isPending ? "Importing…" : "Import now"}
            </Button>
            {typed.length > 0 && !matches && (
              <p className="text-xs text-destructive">Phrase doesn&apos;t match exactly - import stays disabled.</p>
            )}
          </>
        )}
        {disabled && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CircleDashed className="size-3.5" />
            Waiting on preflight.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
