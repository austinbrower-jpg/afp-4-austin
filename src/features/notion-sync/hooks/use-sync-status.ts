"use client";

import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { notionSyncApi } from "../api";

export const syncStatusQueryKey = ["notion", "status"] as const;

export function useSyncStatus() {
  return useQuery({
    queryKey: syncStatusQueryKey,
    queryFn: notionSyncApi.status,
    refetchInterval: 60_000,
  });
}

export function useTriggerSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (trigger: "manual" | "startup" | "background" | "on-edit" = "manual") =>
      notionSyncApi.triggerSync(trigger),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: syncStatusQueryKey });
      queryClient.invalidateQueries();
    },
  });
}

/** Read-only credential check - never queries or writes a database. */
export function useTestNotionConnection() {
  return useMutation({
    mutationFn: () => notionSyncApi.testConnection(),
  });
}

/**
 * Read-only schema mapping check - retrieves each configured database's
 * schema and compares it to what the app expects. Never queries row data,
 * never writes. Manual trigger only (not polled) to avoid hammering Notion.
 */
export function useVerifyNotionDatabases() {
  return useMutation({
    mutationFn: () => notionSyncApi.verifyDatabases(),
  });
}

/**
 * Runs sync once on mount (app startup) and then on an interval driven by
 * the configured NOTION_SYNC_INTERVAL_MINUTES (spec: "pull updates every
 * few minutes and on app startup"). Mount this once near the app root.
 */
export function useBackgroundSync() {
  const { data: status } = useSyncStatus();
  const { mutate: triggerSync } = useTriggerSync();
  const hasRunStartupSync = useRef(false);

  useEffect(() => {
    if (hasRunStartupSync.current) return;
    hasRunStartupSync.current = true;
    triggerSync("startup");
  }, [triggerSync]);

  useEffect(() => {
    const minutes = status?.syncIntervalMinutes ?? 5;
    const interval = setInterval(
      () => triggerSync("background"),
      Math.max(1, minutes) * 60_000,
    );
    return () => clearInterval(interval);
  }, [status?.syncIntervalMinutes, triggerSync]);
}
