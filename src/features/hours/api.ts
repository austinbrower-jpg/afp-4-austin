import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client/http";
import type { HoursEntryInput, HoursEntryWithRelations } from "./lib/types";

export type { HoursEntryWithRelations, HoursEntryInput } from "./lib/types";

export interface HoursListParams {
  start?: string;
  end?: string;
}

function buildQuery(params?: HoursListParams): string {
  if (!params?.start || !params?.end) return "";
  const qs = new URLSearchParams({ start: params.start, end: params.end });
  return `?${qs.toString()}`;
}

export const hoursApi = {
  list: (params?: HoursListParams) =>
    apiGet<HoursEntryWithRelations[]>(`/api/hours${buildQuery(params)}`),
  get: (id: string) => apiGet<HoursEntryWithRelations>(`/api/hours/${id}`),
  create: (input: Partial<HoursEntryInput>) =>
    apiPost<HoursEntryWithRelations>("/api/hours", input),
  update: (id: string, input: Partial<HoursEntryInput>) =>
    apiPatch<HoursEntryWithRelations>(`/api/hours/${id}`, input),
  remove: (id: string) => apiDelete<{ ok: true }>(`/api/hours/${id}`),
};
