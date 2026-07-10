"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { migrationImportApi } from "./api";

export const migrationImportPreflightQueryKey = ["notion", "migration-import", "preflight"] as const;

/** Read-only, fetched automatically on mount and on manual "Re-check" - no external side effects. */
export function useImportPreflight() {
  return useQuery({
    queryKey: migrationImportPreflightQueryKey,
    queryFn: migrationImportApi.preflight,
    staleTime: 0,
  });
}

/** The one write mutation in this feature - only fires when the caller explicitly invokes it with the typed confirmation phrase. */
export function useRunImport() {
  return useMutation({
    mutationFn: (confirmationPhrase: string) => migrationImportApi.runImport(confirmationPhrase),
  });
}
