"use client";

import { useQuery } from "@tanstack/react-query";
import { knowledgeApi } from "../api";

export function knowledgePageQueryKey(id: string) {
  return ["knowledge", "page", id] as const;
}

export function useKnowledgePage(id: string) {
  return useQuery({
    queryKey: knowledgePageQueryKey(id),
    queryFn: () => knowledgeApi.get(id),
    enabled: Boolean(id),
    retry: false,
  });
}
