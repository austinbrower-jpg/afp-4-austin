import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client/http";
import type { KnowledgePage, KnowledgeType } from "@/types/domain";

export interface KnowledgeListParams {
  type?: KnowledgeType;
  /** null (or omitted) => no parent filter. Pass "root" to get only top-level pages. */
  parentId?: string | "root" | null;
  q?: string;
}

export interface CreateKnowledgePageInput {
  type: KnowledgeType;
  title: string;
  content?: string;
  tags?: string[];
  parentId?: string | null;
  clientId?: string | null;
  projectId?: string | null;
  backlinkIds?: string[];
}

export type UpdateKnowledgePageInput = Partial<CreateKnowledgePageInput>;

function buildQuery(params: KnowledgeListParams): string {
  const sp = new URLSearchParams();
  if (params.type) sp.set("type", params.type);
  if (params.parentId !== undefined && params.parentId !== null) {
    sp.set("parentId", params.parentId);
  }
  if (params.q) sp.set("q", params.q);
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export const knowledgeApi = {
  list: (params: KnowledgeListParams = {}) =>
    apiGet<KnowledgePage[]>(`/api/knowledge${buildQuery(params)}`),
  get: (id: string) => apiGet<KnowledgePage>(`/api/knowledge/${id}`),
  create: (input: CreateKnowledgePageInput) =>
    apiPost<KnowledgePage>("/api/knowledge", input),
  update: (id: string, input: UpdateKnowledgePageInput) =>
    apiPatch<KnowledgePage>(`/api/knowledge/${id}`, input),
  remove: (id: string) => apiDelete<{ ok: true }>(`/api/knowledge/${id}`),
};
