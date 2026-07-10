"use client";

import { formatDistanceToNow } from "date-fns";
import { Cloud, CloudOff, Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSyncStatus, useTriggerSync } from "../hooks/use-sync-status";

export function SyncStatusBadge() {
  const { data: status, isLoading } = useSyncStatus();
  const { mutate: triggerSync, isPending } = useTriggerSync();

  if (isLoading || !status) {
    return (
      <Badge variant="outline" className="gap-1.5 text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        Checking sync…
      </Badge>
    );
  }

  const lastSync = status.lastSync;
  const hasConflicts = status.openConflicts > 0;
  const hasErrors = (lastSync?.errors ?? 0) > 0;

  const icon = !status.configured ? (
    <CloudOff className="size-3" />
  ) : hasConflicts || hasErrors ? (
    <TriangleAlert className="size-3" />
  ) : (
    <Cloud className="size-3" />
  );

  const label = !status.configured
    ? "Notion not connected"
    : hasConflicts
      ? `${status.openConflicts} conflict${status.openConflicts > 1 ? "s" : ""}`
      : lastSync?.finishedAt
        ? `Synced ${formatDistanceToNow(new Date(lastSync.finishedAt), { addSuffix: true })}`
        : "Never synced";

  const variant: "outline" | "secondary" | "destructive" = !status.configured
    ? "outline"
    : hasConflicts || hasErrors
      ? "destructive"
      : "secondary";

  return (
    <div className="flex items-center gap-1.5">
      <Tooltip>
        <TooltipTrigger
          render={
            <Badge variant={variant} className="gap-1.5">
              {icon}
              {label}
            </Badge>
          }
        />
        <TooltipContent className="max-w-64">
          {status.configured ? (
            <div className="space-y-1 text-xs">
              <p>Queue: {status.queueLength} pending</p>
              <p>Databases connected: {status.configuredDatabases.length}/6</p>
              {lastSync?.message && <p>{lastSync.message}</p>}
            </div>
          ) : (
            <p className="text-xs">
              Set NOTION_API_KEY and database IDs in .env.local to enable sync. Running
              in local/mock mode.
            </p>
          )}
        </TooltipContent>
      </Tooltip>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        disabled={isPending}
        onClick={() => triggerSync("manual")}
        aria-label="Sync now"
      >
        <RefreshCw className={`size-3.5 ${isPending ? "animate-spin" : ""}`} />
      </Button>
    </div>
  );
}
