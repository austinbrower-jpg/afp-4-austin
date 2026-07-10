"use client";

import { CheckCircle2, CircleDashed, Database, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
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
import { useVerifyNotionDatabases } from "@/features/notion-sync/hooks/use-sync-status";
import type { NotionDatabaseVerification } from "@/features/notion-sync/api";

function StatusRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      {value}
    </div>
  );
}

function TriStateBadge({ state }: { state: boolean | null }) {
  if (state === null) {
    return (
      <span className="flex items-center gap-1 text-muted-foreground">
        <CircleDashed className="size-3" /> n/a
      </span>
    );
  }
  return state ? (
    <span className="flex items-center gap-1 text-emerald-500">
      <CheckCircle2 className="size-3" /> yes
    </span>
  ) : (
    <span className="flex items-center gap-1 text-destructive">
      <XCircle className="size-3" /> no
    </span>
  );
}

function DatabaseResultCard({ db }: { db: NotionDatabaseVerification }) {
  const invalidProps = db.properties.filter((p) => p.status !== "ok");

  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium leading-tight">
            {db.label}
            {db.databaseName ? (
              <span className="text-muted-foreground"> — &quot;{db.databaseName}&quot;</span>
            ) : null}
          </p>
          <p className="truncate text-xs text-muted-foreground">{db.envVar}</p>
        </div>
        <Badge variant={db.configured && db.accessible && db.schemaValid ? "secondary" : "outline"}>
          {db.configured && db.accessible && db.schemaValid ? "Ready" : "Not ready"}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-1">
        <StatusRow label="Configured" value={<TriStateBadge state={db.configured} />} />
        <StatusRow label="Accessible" value={<TriStateBadge state={db.accessible} />} />
        <StatusRow label="Schema valid" value={<TriStateBadge state={db.schemaValid} />} />
      </div>

      {db.error && <p className="text-xs text-destructive">{db.error}</p>}

      {db.configured && db.accessible && invalidProps.length > 0 && (
        <div className="space-y-1 rounded-md bg-muted/60 p-2">
          <p className="text-xs font-medium">Missing / incorrect properties</p>
          <ul className="space-y-0.5 text-xs text-muted-foreground">
            {invalidProps.map((p) => (
              <li key={p.field}>
                <code className="rounded bg-muted px-1 py-0.5">{p.notionName}</code>{" "}
                {p.status === "missing"
                  ? `— missing (expected "${p.expectedType}")`
                  : `— expected "${p.expectedType}", found "${p.actualType}"`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function NotionMappingCard() {
  const { mutate: verify, data, isPending, isIdle } = useVerifyNotionDatabases();

  const handleVerify = () => {
    verify(undefined, {
      onSuccess: (report) => {
        if (report.ready) {
          toast.success("Read-only mapping ready — all six databases check out.");
        } else if (!report.apiKeyConfigured) {
          toast.error("NOTION_API_KEY is not set.");
        } else {
          const notReady = report.databases.filter(
            (d) => !(d.configured && d.accessible && d.schemaValid),
          ).length;
          toast.error(`${notReady}/6 database(s) not ready yet — see details below.`);
        }
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : "Database verification failed");
      },
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="size-4 text-muted-foreground" />
          Notion Database Mapping
        </CardTitle>
        <CardDescription>
          Read-only: checks that each configured database is reachable and its
          schema matches what the app expects. Never reads row data, never
          writes.
        </CardDescription>
        <CardAction>
          {data ? (
            <Badge variant={data.ready ? "secondary" : "outline"} className="flex items-center gap-1">
              <ShieldCheck className="size-3" />
              {data.ready ? "Read-only mapping ready" : "Not ready"}
            </Badge>
          ) : (
            <Badge variant="outline">Not checked yet</Badge>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button variant="outline" disabled={isPending} onClick={handleVerify}>
          {isPending ? "Checking…" : "Verify databases"}
        </Button>

        {isIdle && !data && (
          <p className="text-sm text-muted-foreground">
            Run a check after adding your six <code className="rounded bg-muted px-1 py-0.5 text-xs">
              NOTION_DATABASE_*
            </code>{" "}
            ids to see what&apos;s missing before enabling real sync.
          </p>
        )}

        {data && (
          <>
            <Separator />
            <div className="grid gap-3 sm:grid-cols-2">
              {data.databases.map((db) => (
                <DatabaseResultCard key={db.type} db={db} />
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
