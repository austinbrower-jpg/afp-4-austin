"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  knowledgeApi,
  type CreateKnowledgePageInput,
  type UpdateKnowledgePageInput,
} from "../api";
import { knowledgePageQueryKey } from "./use-knowledge-page";

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export function useCreateKnowledgePage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateKnowledgePageInput) => knowledgeApi.create(input),
    onSuccess: (page) => {
      queryClient.invalidateQueries({ queryKey: ["knowledge"] });
      toast.success(`Created "${page.title}"`);
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to create page")),
  });
}

export function useUpdateKnowledgePage(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateKnowledgePageInput) => knowledgeApi.update(id, input),
    onSuccess: (page) => {
      queryClient.invalidateQueries({ queryKey: ["knowledge"] });
      queryClient.setQueryData(knowledgePageQueryKey(id), page);
      toast.success("Saved");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to save page")),
  });
}

export function useDeleteKnowledgePage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => knowledgeApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge"] });
      toast.success("Page deleted");
    },
    onError: (err) => toast.error(errorMessage(err, "Failed to delete page")),
  });
}
