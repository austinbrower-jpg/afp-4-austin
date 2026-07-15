"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { hoursApi } from "../api";
import type { HoursEntryInput } from "../lib/types";
/** Unfiltered - always the full entry set, used to compute weekly/monthly/invoice stats. */
export const hoursAllQueryKey = ["hours", "list", "all"] as const;

/** Always fetches the full, unfiltered entry set so stat cards stay accurate regardless of the table's active range. */
export function useHoursStats() {
  return useQuery({
    queryKey: hoursAllQueryKey,
    queryFn: () => hoursApi.list(),
    staleTime: 15_000,
  });
}

function invalidateHours(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["hours"] });
}

export function useCreateHoursEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<HoursEntryInput>) => hoursApi.create(input),
    onSuccess: () => invalidateHours(queryClient),
  });
}

export function useUpdateHoursEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<HoursEntryInput> }) =>
      hoursApi.update(id, input),
    onSuccess: () => invalidateHours(queryClient),
  });
}

export function useDeleteHoursEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => hoursApi.remove(id),
    onSuccess: () => invalidateHours(queryClient),
  });
}
