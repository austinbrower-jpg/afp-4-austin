"use client";

import { useQuery } from "@tanstack/react-query";
import { searchApi } from "../api";

export function useGlobalSearch(term: string) {
  return useQuery({
    queryKey: ["search", term],
    queryFn: () => searchApi.search(term),
    enabled: term.trim().length >= 2,
    staleTime: 10_000,
  });
}
