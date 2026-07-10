import { apiGet } from "@/lib/api-client/http";
import type { DashboardSummary } from "@/types/api";

export type { DashboardSummary };

export const dashboardApi = {
  summary: () => apiGet<DashboardSummary>("/api/dashboard"),
};
