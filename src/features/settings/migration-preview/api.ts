import { apiGet } from "@/lib/api-client/http";
import type { MigrationDryRunResult } from "@/lib/notion/migration/types";

export type { MigrationDryRunResult } from "@/lib/notion/migration/types";

export const migrationPreviewApi = {
  /**
   * Read-only Phase 5 dry run: no Notion API call, no SQLite write. Safe to
   * call repeatedly. See src/app/api/notion/migration-preview/route.ts.
   */
  preview: () => apiGet<MigrationDryRunResult>("/api/notion/migration-preview"),
};
