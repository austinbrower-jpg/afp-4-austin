import { apiGet, apiPost } from "@/lib/api-client/http";
import type { PreflightReport, ImportResult } from "@/lib/notion/migration/one-time-import";

export type { PreflightReport, ImportResult } from "@/lib/notion/migration/one-time-import";

export const migrationImportApi = {
  /** Read-only: re-derives preflight status live. No writes. */
  preflight: () => apiGet<PreflightReport>("/api/notion/migration-import/preflight"),
  /**
   * The one write call in this feature. Requires the exact confirmation
   * phrase; the server re-runs preflight itself regardless of what the
   * client believes.
   */
  runImport: (confirmationPhrase: string) =>
    apiPost<ImportResult>("/api/notion/migration-import", { confirmationPhrase }),
};
