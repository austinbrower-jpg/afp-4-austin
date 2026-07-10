import { apiGet } from "@/lib/api-client/http";
import type { SearchResultItem } from "@/types/api";

export type { SearchResultItem };

export const searchApi = {
  search: (term: string) =>
    apiGet<SearchResultItem[]>(`/api/search?q=${encodeURIComponent(term)}`),
};
