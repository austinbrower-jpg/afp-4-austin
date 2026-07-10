"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { WorkLog } from "@/types/domain";
import { workDoneApi, type WorkLogInput, type WorkLogListFilters } from "../api";

export const workLogsQueryKey = (filters?: WorkLogListFilters) =>
  ["worklogs", filters ?? {}] as const;
export const workLogQueryKey = (id: string) => ["worklogs", "detail", id] as const;

export function useWorkLogs(filters?: WorkLogListFilters, initialData?: WorkLog[]) {
  return useQuery({
    queryKey: workLogsQueryKey(filters),
    queryFn: () => workDoneApi.list(filters),
    initialData,
  });
}

export function useWorkLog(id: string, initialData?: WorkLog) {
  return useQuery({
    queryKey: workLogQueryKey(id),
    queryFn: () => workDoneApi.get(id),
    initialData,
    enabled: Boolean(id),
  });
}

export function useCreateWorkLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<WorkLogInput>) => workDoneApi.create(input),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["worklogs"] });
      queryClient.setQueryData(workLogQueryKey(created.id), created);
    },
  });
}

export function useUpdateWorkLog(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<WorkLogInput>) => workDoneApi.update(id, input),
    onSuccess: (updated) => {
      queryClient.setQueryData(workLogQueryKey(id), updated);
      queryClient.invalidateQueries({ queryKey: ["worklogs"] });
    },
  });
}

export function useDeleteWorkLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => workDoneApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["worklogs"] });
    },
  });
}
