"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Cloud, Database, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { runtimeApi } from "../api";
import { ApiError } from "@/lib/api-client/http";
import {
  formatLastSyncedLabel,
  LAST_NOTION_REFRESH_STORAGE_KEY,
  refreshNotionData,
} from "../lib/notion-refresh";

export function DataSourceBadge() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["runtime-status"], queryFn: runtimeApi.status, staleTime: 60_000 });
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(LAST_NOTION_REFRESH_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const refreshMutation = useMutation({
    mutationFn: async () => refreshNotionData(queryClient),
    onMutate: () => {
      setRefreshError(null);
    },
    onSuccess: (refreshedAt) => {
      setLastSyncedAt(refreshedAt);
      try {
        window.localStorage.setItem(LAST_NOTION_REFRESH_STORAGE_KEY, refreshedAt);
      } catch {
        // Best-effort persistence only.
      }
      console.info("[notion-refresh]", {
        success: true,
        lastSuccessfulSyncAt: refreshedAt,
      });
      toast.success("Fresh Notion data loaded");
    },
    onError: (error) => {
      const message =
        error instanceof ApiError
          ? `${error.code ? `${error.code}: ` : ""}${error.message}`
          : error instanceof Error
            ? error.message
            : "Failed to refresh Notion data.";
      setRefreshError(message);
      console.warn("[notion-refresh]", {
        success: false,
        errorCategory: error instanceof ApiError ? error.code ?? `http-${error.status}` : "unexpected",
      });
      toast.error(message);
    },
  });
  const notion = data?.dataSource === "notion";
  const statusLine = refreshError
    ? `Refresh failed: ${refreshError}`
    : notion
      ? formatLastSyncedLabel(lastSyncedAt)
      : "Using local fallback data";
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex flex-col items-end gap-0.5">
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="gap-1.5">
            {notion ? <Cloud className="size-3" /> : <Database className="size-3" />}
            {notion ? "Notion data" : "Local mock data"}
          </Badge>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Refresh current data"
            title="Refresh current data"
            disabled={refreshMutation.isPending}
            onClick={() => refreshMutation.mutate()}
          >
            <RefreshCw className={`size-3.5 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <span
          className={`hidden max-w-64 truncate text-[11px] leading-none text-muted-foreground md:block ${
            refreshError ? "text-destructive" : ""
          }`}
          title={statusLine}
        >
          {statusLine}
        </span>
      </div>
    </div>
  );
}
