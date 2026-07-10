"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { projectsApi, type UpdateProjectInput } from "../api";
import { projectsListQueryKey } from "./use-projects";

export function projectQueryKey(id: string) {
  return ["projects", "detail", id] as const;
}

export function useProject(id: string) {
  return useQuery({
    queryKey: projectQueryKey(id),
    queryFn: () => projectsApi.get(id),
    enabled: Boolean(id),
  });
}

export function useUpdateProject(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProjectInput) => projectsApi.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: projectsListQueryKey });
      toast.success("Project saved");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to save project");
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => projectsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectsListQueryKey });
      toast.success("Project deleted");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to delete project");
    },
  });
}
