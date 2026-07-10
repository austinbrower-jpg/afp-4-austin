import { apiGet, apiPost } from "@/lib/api-client/http";
import type { SyncConflict, SyncLogEntry } from "@/types/domain";

export interface SyncStatusSummary {
  configured: boolean;
  configuredDatabases: string[];
  missingDatabases: string[];
  lastSync: SyncLogEntry | null;
  queueLength: number;
  openConflicts: number;
  syncIntervalMinutes: number;
}

export interface SyncTriggerResponse {
  result: SyncLogEntry & { configured: boolean };
  status: SyncStatusSummary;
}

export interface NotionConnectionTestResult {
  ok: boolean;
  configured: boolean;
  botId?: string;
  workspaceName?: string;
  error?: string;
}

export const notionSyncApi = {
  status: () => apiGet<SyncStatusSummary>("/api/notion/status"),
  triggerSync: (trigger: SyncLogEntry["trigger"] = "manual") =>
    apiPost<SyncTriggerResponse>("/api/notion/sync", { trigger }),
  listConflicts: () => apiGet<SyncConflict[]>("/api/notion/conflicts"),
  resolveConflict: (id: string, resolution: "kept-local" | "kept-notion" | "merged") =>
    apiPost<{ ok: true }>("/api/notion/conflicts", { id, resolution }),
  testConnection: () => apiGet<NotionConnectionTestResult>("/api/notion/test-connection"),
};
