import "server-only";
import type { Project } from "@/types/domain";
import {
  createRepository,
  RepoRow,
  SYNC_COLUMNS,
  syncFromRow,
  syncToRow,
  toJSON,
  fromJSON,
} from "../repository";

const COLUMNS = [
  "id",
  "workspace_id",
  "client_id",
  "name",
  "description",
  "status",
  "priority",
  "color",
  "tags",
  "notes",
  ...SYNC_COLUMNS,
  "created_at",
  "updated_at",
];

function toRow(e: Project): RepoRow {
  return {
    id: e.id,
    workspace_id: e.workspaceId,
    client_id: e.clientId,
    name: e.name,
    description: e.description,
    status: e.status,
    priority: e.priority,
    color: e.color,
    tags: toJSON(e.tags),
    notes: e.notes,
    ...syncToRow(e),
    created_at: e.createdAt,
    updated_at: e.updatedAt,
  };
}

function fromRow(row: RepoRow): Project {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    clientId: row.client_id as string,
    name: row.name as string,
    description: row.description as string,
    status: row.status as Project["status"],
    priority: row.priority as Project["priority"],
    color: row.color as string,
    tags: fromJSON<string[]>(row.tags, []),
    notes: row.notes as string,
    ...syncFromRow(row),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export const projectRepo = createRepository<Project>({
  table: "projects",
  columns: COLUMNS,
  toRow,
  fromRow,
});

export function listProjectsByClient(clientId: string): Project[] {
  return projectRepo.where("client_id = ?", [clientId]);
}
