import { apiGet, apiPost } from "@/lib/api-client/http";
import type { SyncConflict, SyncLogEntry } from "@/types/domain";

export interface SyncStatusSummary {
  configured: boolean;
  /** Master switch for real push/pull - see NOTION_SYNC_ENABLED in .env.example. */
  syncEnabled: boolean;
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

export type NotionPropertyCheckStatus = "ok" | "missing" | "wrong-type";

export interface NotionPropertyCheckResult {
  field: string;
  notionName: string;
  expectedType: string;
  status: NotionPropertyCheckStatus;
  actualType?: string;
}

export interface NotionDatabaseVerification {
  type: string;
  label: string;
  envVar: string;
  databaseId: string | null;
  configured: boolean;
  accessible: boolean | null;
  databaseName: string | null;
  schemaValid: boolean | null;
  properties: NotionPropertyCheckResult[];
  error?: string;
}

export interface ReadOnlyMappingReport {
  apiKeyConfigured: boolean;
  ready: boolean;
  databases: NotionDatabaseVerification[];
}

export const notionSyncApi = {
  status: () => apiGet<SyncStatusSummary>("/api/notion/status"),
  triggerSync: (trigger: SyncLogEntry["trigger"] = "manual") =>
    apiPost<SyncTriggerResponse>("/api/notion/sync", { trigger }),
  listConflicts: () => apiGet<SyncConflict[]>("/api/notion/conflicts"),
  resolveConflict: (id: string, resolution: "kept-local" | "kept-notion" | "merged") =>
    apiPost<{ ok: true }>("/api/notion/conflicts", { id, resolution }),
  testConnection: () => apiGet<NotionConnectionTestResult>("/api/notion/test-connection"),
  verifyDatabases: () => apiGet<ReadOnlyMappingReport>("/api/notion/verify-databases"),
};
