import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api-client/http";
import type {
  HoursEntry,
  KnowledgePage,
  Priority,
  Project,
  ProjectStatus,
  WorkLog,
} from "@/types/domain";

/** Canonical project list shape - safe to reuse anywhere in the app for dropdowns/badges. */
export interface ProjectListItem extends Project {
  hoursCount: number;
  workLogCount: number;
  knowledgeCount: number;
}

export interface ProjectDetail {
  project: Project;
  hours: HoursEntry[];
  workLogs: WorkLog[];
  knowledge: KnowledgePage[];
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  status?: ProjectStatus;
  priority?: Priority;
  color?: string;
  tags?: string[];
  notes?: string;
}

export type UpdateProjectInput = Partial<CreateProjectInput>;

export const projectsApi = {
  list: () => apiGet<ProjectListItem[]>("/api/projects"),
  create: (input: CreateProjectInput) => apiPost<Project>("/api/projects", input),
  get: (id: string) => apiGet<ProjectDetail>(`/api/projects/${id}`),
  update: (id: string, input: UpdateProjectInput) =>
    apiPatch<Project>(`/api/projects/${id}`, input),
  remove: (id: string) => apiDelete<{ ok: true }>(`/api/projects/${id}`),
};
