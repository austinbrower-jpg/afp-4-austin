"use client";

import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "../api";

export const dashboardSummaryQueryKey = ["dashboard", "summary"] as const;

export function useDashboardSummary() {
  return useQuery({
    queryKey: dashboardSummaryQueryKey,
    queryFn: dashboardApi.summary,
    refetchInterval: 60_000,
  });
}
