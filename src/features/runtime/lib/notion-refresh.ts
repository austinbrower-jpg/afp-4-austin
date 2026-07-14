import { format } from "date-fns";
import type { QueryClient } from "@tanstack/react-query";
import { dashboardSummaryQueryKey } from "@/features/dashboard/hooks/use-dashboard-summary";

export const HOURS_REFRESH_QUERY_KEY = ["hours"] as const;
export const DASHBOARD_REFRESH_QUERY_KEY = dashboardSummaryQueryKey;
export const RUNTIME_STATUS_QUERY_KEY = ["runtime-status"] as const;
export const LAST_NOTION_REFRESH_STORAGE_KEY = "afp-notion:last-successful-refresh-at";

function asError(reason: unknown): Error {
  return reason instanceof Error ? reason : new Error("Failed to refresh Notion data.");
}

export async function refreshNotionData(queryClient: QueryClient): Promise<string> {
  const refreshedAt = new Date().toISOString();
  const results = await Promise.allSettled(
    [HOURS_REFRESH_QUERY_KEY, DASHBOARD_REFRESH_QUERY_KEY, RUNTIME_STATUS_QUERY_KEY].map((queryKey) =>
      queryClient.refetchQueries({ queryKey, exact: false, type: "active" }),
    ),
  );

  const failure = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
  if (failure) throw asError(failure.reason);

  return refreshedAt;
}

export function formatLastSyncedLabel(lastSyncedAt: string | null): string {
  if (!lastSyncedAt) return "Last synced: not yet refreshed";
  return `Last synced: ${format(new Date(lastSyncedAt), "MMM d, yyyy h:mm a")}`;
}

