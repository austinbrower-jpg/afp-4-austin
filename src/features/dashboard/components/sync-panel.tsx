"use client";

import { formatDistanceToNow } from "date-fns";
import { Cloud, CloudOff, RefreshCw, TriangleAlert } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useSyncStatus,
  useTriggerSync,
} from "@/features/notion-sync/hooks/use-sync-status";

export function SyncStatusCard() {
  const { data: status, isLoading } = useSyncStatus();
  const { mutate: triggerSync, isPending } = useTriggerSync();

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          {status?.configured ? (
            status.openConflicts > 0 || (status.lastSync?.errors ?? 0) > 0 ? (
              <TriangleAlert className="size-4 text-muted-foreground" />
            ) : (
              <Cloud className="size-4 text-muted-foreground" />
            )
          ) : (
            <CloudOff className="size-4 text-muted-foreground" />
          )}
          Sync Status
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => triggerSync("manual")}
          className="gap-1.5"
        >
          <RefreshCw className={`size-3.5 ${isPending ? "animate-spin" : ""}`} />
          Sync now
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading || !status ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Notion connection</span>
              <Badge variant={status.configured ? "secondary" : "outline"}>
                {status.configured ? "Connected" : "Local only"}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Queued changes</span>
              <span>{status.queueLength}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Open conflicts</span>
              <span className={status.openConflicts > 0 ? "text-destructive" : ""}>
                {status.openConflicts}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Databases connected</span>
              <span>
                {status.configuredDatabases.length}/
                {status.configuredDatabases.length + status.missingDatabases.length}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Sync interval</span>
              <span>Every {status.syncIntervalMinutes}m</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function RecentSyncCard() {
  const { data: status, isLoading } = useSyncStatus();
  const lastSync = status?.lastSync ?? null;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">Recent Notion Sync</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading || !status ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-56" />
          </div>
        ) : !lastSync ? (
          <p className="text-sm text-muted-foreground">No sync has run yet.</p>
        ) : (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Last run</span>
              <span>
                {lastSync.finishedAt
                  ? formatDistanceToNow(new Date(lastSync.finishedAt), { addSuffix: true })
                  : "In progress"}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Trigger</span>
              <span className="capitalize">{lastSync.trigger}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Direction</span>
              <span className="capitalize">{lastSync.direction}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Entities synced</span>
              <span>{lastSync.entitiesSynced}</span>
            </div>
            {(lastSync.conflicts > 0 || lastSync.errors > 0) && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Issues</span>
                <span className="text-destructive">
                  {lastSync.conflicts} conflict{lastSync.conflicts === 1 ? "" : "s"},{" "}
                  {lastSync.errors} error{lastSync.errors === 1 ? "" : "s"}
                </span>
              </div>
            )}
            {lastSync.message && (
              <p className="pt-1 text-xs text-muted-foreground">{lastSync.message}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
