import "server-only";
import type { KnowledgePage } from "@/types/domain";
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
  "project_id",
  "type",
  "title",
  "content",
  "tags",
  "parent_id",
  "backlink_ids",
  ...SYNC_COLUMNS,
  "created_at",
  "updated_at",
];

function toRow(e: KnowledgePage): RepoRow {
  return {
    id: e.id,
    workspace_id: e.workspaceId,
    client_id: e.clientId,
    project_id: e.projectId,
    type: e.type,
    title: e.title,
    content: e.content,
    tags: toJSON(e.tags),
    parent_id: e.parentId,
    backlink_ids: toJSON(e.backlinkIds),
    ...syncToRow(e),
    created_at: e.createdAt,
    updated_at: e.updatedAt,
  };
}

function fromRow(row: RepoRow): KnowledgePage {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    clientId: (row.client_id as string) ?? null,
    projectId: (row.project_id as string) ?? null,
    type: row.type as KnowledgePage["type"],
    title: row.title as string,
    content: row.content as string,
    tags: fromJSON<string[]>(row.tags, []),
    parentId: (row.parent_id as string) ?? null,
    backlinkIds: fromJSON<string[]>(row.backlink_ids, []),
    ...syncFromRow(row),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export const knowledgeRepo = createRepository<KnowledgePage>({
  table: "knowledge_pages",
  columns: COLUMNS,
  toRow,
  fromRow,
});

export function listKnowledgeByType(type: string): KnowledgePage[] {
  return knowledgeRepo.where("type = ?", [type], "title ASC");
}

export function listKnowledgeChildren(parentId: string): KnowledgePage[] {
  return knowledgeRepo.where("parent_id = ?", [parentId], "title ASC");
}
