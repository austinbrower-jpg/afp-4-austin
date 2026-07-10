import "server-only";
import type { Workspace } from "@/types/domain";
import {
  createRepository,
  RepoRow,
  SYNC_COLUMNS,
  syncFromRow,
  syncToRow,
} from "../repository";

const COLUMNS = [
  "id",
  "name",
  "slug",
  "notion_workspace_name",
  ...SYNC_COLUMNS,
  "created_at",
  "updated_at",
];

function toRow(e: Workspace): RepoRow {
  return {
    id: e.id,
    name: e.name,
    slug: e.slug,
    notion_workspace_name: e.notionWorkspaceName,
    ...syncToRow(e),
    created_at: e.createdAt,
    updated_at: e.updatedAt,
  };
}

function fromRow(row: RepoRow): Workspace {
  return {
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    notionWorkspaceName: (row.notion_workspace_name as string) ?? null,
    ...syncFromRow(row),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export const workspaceRepo = createRepository<Workspace>({
  table: "workspaces",
  columns: COLUMNS,
  toRow,
  fromRow,
});
