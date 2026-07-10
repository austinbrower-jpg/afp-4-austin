"use client";

import { useQuery } from "@tanstack/react-query";
import { knowledgeApi, type KnowledgeListParams } from "../api";

export function knowledgeListQueryKey(params: KnowledgeListParams = {}) {
  return ["knowledge", "list", params] as const;
}

export function useKnowledgeList(params: KnowledgeListParams = {}) {
  return useQuery({
    queryKey: knowledgeListQueryKey(params),
    queryFn: () => knowledgeApi.list(params),
  });
}

/** All pages, unfiltered - used for tree building, wiki-link resolution, and backlink scans. */
export function useAllKnowledgePages() {
  return useKnowledgeList({});
}
