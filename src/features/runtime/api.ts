import { apiGet } from "@/lib/api-client/http";
import type { AppDataSourceMode } from "@/lib/data/runtime-config";

export interface RuntimeStatus {
  ok: boolean;
  dataSource: AppDataSourceMode;
  sqliteAllowed: boolean;
  notionConfigured: boolean;
  generalSyncEnabled: boolean;
  accessProtection: string;
  environment: string;
  errors: string[];
  warnings: string[];
}

export const runtimeApi = { status: () => apiGet<RuntimeStatus>("/api/health") };
