import "server-only";
import type { Client } from "@/types/domain";
import {
  createRepository,
  RepoRow,
  SYNC_COLUMNS,
  syncFromRow,
  syncToRow,
} from "../repository";

const COLUMNS = [
  "id",
  "workspace_id",
  "name",
  "color",
  "status",
  "default_hourly_rate",
  "timezone",
  "notes",
  ...SYNC_COLUMNS,
  "created_at",
  "updated_at",
];

function toRow(e: Client): RepoRow {
  return {
    id: e.id,
    workspace_id: e.workspaceId,
    name: e.name,
    color: e.color,
    status: e.status,
    default_hourly_rate: e.defaultHourlyRate,
    timezone: e.timezone,
    notes: e.notes,
    ...syncToRow(e),
    created_at: e.createdAt,
    updated_at: e.updatedAt,
  };
}

function fromRow(row: RepoRow): Client {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    name: row.name as string,
    color: row.color as string,
    status: row.status as Client["status"],
    defaultHourlyRate: row.default_hourly_rate as number,
    timezone: row.timezone as string,
    notes: row.notes as string,
    ...syncFromRow(row),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export const clientRepo = createRepository<Client>({
  table: "clients",
  columns: COLUMNS,
  toRow,
  fromRow,
});

export function listClientsByWorkspace(workspaceId: string): Client[] {
  return clientRepo.where("workspace_id = ?", [workspaceId]);
}
