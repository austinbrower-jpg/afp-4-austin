"use client";

import { useQuery } from "@tanstack/react-query";
import { migrationPreviewApi } from "./api";

export const migrationPreviewQueryKey = ["notion", "migration-preview"] as const;

/**
 * Fetches automatically on mount - unlike the Notion connection/mapping
 * checks, this makes zero external API calls (no Notion, no SQLite write),
 * so there's no "don't hammer Notion" reason to gate it behind a button.
 * Not polled - it's a static analysis of a fixed historical fixture.
 */
export function useMigrationPreview() {
  return useQuery({
    queryKey: migrationPreviewQueryKey,
    queryFn: migrationPreviewApi.preview,
    staleTime: 0,
  });
}
