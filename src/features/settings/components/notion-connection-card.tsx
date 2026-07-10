"use client";

import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, CircleDashed, Cloud, Plug, RefreshCw } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  useSyncStatus,
  useTestNotionConnection,
  useTriggerSync,
} from "@/features/notion-sync/hooks/use-sync-status";
import { NOTION_DATABASE_ENV_VARS } from "@/lib/notion/schema-requirements";
import type { SyncEntityType } from "@/types/domain";

const ENV_VAR_ORDER = [
  "NOTION_API_KEY",
  "NOTION_DATABASE_CLIENTS",
  "NOTION_DATABASE_PROJECTS",
  "NOTION_DATABASE_HOURS",
  "NOTION_DATABASE_WORKLOGS",
  "NOTION_DATABASE_KNOWLEDGE",
  "NOTION_DATABASE_INVOICES",
  "NOTION_SYNC_INTERVAL_MINUTES",
  "NOTION_SYNC_ENABLED",
];

export function NotionConnectionCard() {
  const { data: status, isLoading } = useSyncStatus();
  const { mutate: triggerSync, isPending } = useTriggerSync();
  const { mutate: testConnection, isPending: isTesting } = useTestNotionConnection();

  const handleTestConnection = () => {
    testConnection(undefined, {
      onSuccess: (result) => {
        if (result.ok) {
          toast.success(
            result.workspaceName
              ? `Connected to "${result.workspaceName}"`
              : "Notion connection is valid",
          );
        } else {
          toast.error(result.error ?? "Notion connection test failed");
        }
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : "Notion connection test failed");
      },
    });
  };

  if (isLoading || !status) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notion Connection</CardTitle>
          <CardDescription>Checking sync status…</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  const configuredSet = new Set(status.configuredDatabases as SyncEntityType[]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud className="size-4 text-muted-foreground" />
          Notion Connection
        </CardTitle>
        <CardDescription>
          {status.configured
            ? `Connected · ${status.configuredDatabases.length}/6 databases mapped`
            : "Not connected · running in local-only mode"}
        </CardDescription>
        <CardAction className="flex gap-1.5">
          <Badge variant={status.configured ? "secondary" : "outline"}>
            {status.configured ? "Configured" : "Not configured"}
          </Badge>
          <Badge variant={status.syncEnabled ? "secondary" : "outline"}>
            {status.syncEnabled ? "Sync enabled" : "Sync disabled (read-only)"}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(Object.keys(NOTION_DATABASE_ENV_VARS) as SyncEntityType[]).map((type) => {
            const connected = configuredSet.has(type);
            const { envVar, label } = NOTION_DATABASE_ENV_VARS[type];
            return (
              <div
                key={type}
                className="flex items-start gap-2 rounded-lg border border-border p-2.5"
              >
                {connected ? (
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                ) : (
                  <CircleDashed className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-tight">{label}</p>
                  <p className="truncate text-xs text-muted-foreground">{envVar}</p>
                </div>
              </div>
            );
          })}
        </div>

        <Separator />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5 text-sm text-muted-foreground">
            <p>Queue: {status.queueLength} pending</p>
            <p>Open conflicts: {status.openConflicts}</p>
            <p>
              Last sync:{" "}
              {status.lastSync?.finishedAt
                ? formatDistanceToNow(new Date(status.lastSync.finishedAt), {
                    addSuffix: true,
                  })
                : "never"}
            </p>
            <p>Sync interval: every {status.syncIntervalMinutes} min</p>
            {status.lastSync?.message && (
              <p className="text-xs italic">{status.lastSync.message}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={isTesting}
              onClick={handleTestConnection}
            >
              <Plug className={`size-3.5 ${isTesting ? "animate-pulse" : ""}`} />
              Test connection
            </Button>
            <Button
              variant="outline"
              disabled={isPending}
              onClick={() => triggerSync("manual")}
            >
              <RefreshCw className={`size-3.5 ${isPending ? "animate-spin" : ""}`} />
              Sync now
            </Button>
          </div>
        </div>

        {!status.configured && (
          <>
            <Separator />
            <div className="space-y-2">
              <p className="text-sm font-medium">Set up Notion sync</p>
              <p className="text-sm text-muted-foreground">
                Add these variables to <code className="rounded bg-muted px-1 py-0.5 text-xs">.env.local</code>{" "}
                at the project root, then restart the app:
              </p>
              <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs leading-relaxed">
                <code>
                  {ENV_VAR_ORDER.map((name) => `${name}=\n`).join("")}
                </code>
              </pre>
              <p className="text-xs text-muted-foreground">
                <code className="rounded bg-muted px-1 py-0.5">NOTION_API_KEY</code> is
                an internal integration secret from your Notion workspace. The six{" "}
                <code className="rounded bg-muted px-1 py-0.5">NOTION_DATABASE_*</code>{" "}
                variables are the database IDs for Clients, Projects, Hours,
                Work Logs, Knowledge, and Invoices — share each database with your
                integration first. <code className="rounded bg-muted px-1 py-0.5">
                  NOTION_SYNC_INTERVAL_MINUTES
                </code>{" "}
                is optional (defaults to 5).
              </p>
              <p className="text-xs text-muted-foreground">
                Setting a database id only enables the read-only schema
                check below — real push/pull sync stays off until you also
                set <code className="rounded bg-muted px-1 py-0.5">
                  NOTION_SYNC_ENABLED=true
                </code>. See{" "}
                <code className="rounded bg-muted px-1 py-0.5">
                  docs/notion-migration-plan.md
                </code>{" "}
                before enabling it.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
