"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { notionSyncApi } from "@/features/notion-sync/api";
import { syncStatusQueryKey } from "@/features/notion-sync/hooks/use-sync-status";

export const conflictsQueryKey = ["notion", "conflicts"] as const;

export function useConflicts() {
  return useQuery({
    queryKey: conflictsQueryKey,
    queryFn: notionSyncApi.listConflicts,
    refetchInterval: 60_000,
  });
}

export function useResolveConflict() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      resolution,
    }: {
      id: string;
      resolution: "kept-local" | "kept-notion" | "merged";
    }) => notionSyncApi.resolveConflict(id, resolution),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conflictsQueryKey });
      queryClient.invalidateQueries({ queryKey: syncStatusQueryKey });
      toast.success("Conflict resolved");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to resolve conflict");
    },
  });
}
