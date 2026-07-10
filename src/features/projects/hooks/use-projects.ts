"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { projectsApi, type CreateProjectInput } from "../api";

export const projectsListQueryKey = ["projects", "list"] as const;

export function useProjects() {
  return useQuery({
    queryKey: projectsListQueryKey,
    queryFn: projectsApi.list,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectInput) => projectsApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectsListQueryKey });
      toast.success("Project created");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to create project");
    },
  });
}
