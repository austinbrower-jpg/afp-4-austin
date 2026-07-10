import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client/http";
import type { Attachment, WorkLog, WorkLogStatus, Priority } from "@/types/domain";

/** Partial payload accepted by the create/update endpoints. */
export interface WorkLogInput {
  projectId: string | null;
  title: string;
  date: string;
  summary: string;
  detailedNotes: string;
  invoiceDescription: string;
  status: WorkLogStatus;
  priority: Priority;
  relatedHoursIds: string[];
  relatedKnowledgeIds: string[];
  evidence: string[];
  githubLink: string | null;
  attachments: Attachment[];
}

export interface WorkLogListFilters {
  status?: WorkLogStatus;
  projectId?: string;
}

function buildQuery(filters?: WorkLogListFilters): string {
  if (!filters) return "";
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.projectId) params.set("projectId", filters.projectId);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const workDoneApi = {
  list: (filters?: WorkLogListFilters) =>
    apiGet<WorkLog[]>(`/api/worklogs${buildQuery(filters)}`),
  get: (id: string) => apiGet<WorkLog>(`/api/worklogs/${id}`),
  create: (input: Partial<WorkLogInput>) => apiPost<WorkLog>("/api/worklogs", input),
  update: (id: string, input: Partial<WorkLogInput>) =>
    apiPatch<WorkLog>(`/api/worklogs/${id}`, input),
  remove: (id: string) => apiDelete<{ ok: true }>(`/api/worklogs/${id}`),
};
