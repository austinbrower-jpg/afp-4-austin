import "server-only";
import type { HoursEntry } from "@/types/domain";
import {
  createRepository,
  RepoRow,
  SYNC_COLUMNS,
  syncFromRow,
  syncToRow,
  toBool,
  toInt,
} from "../repository";

const COLUMNS = [
  "id",
  "workspace_id",
  "client_id",
  "project_id",
  "date",
  "start_time",
  "end_time",
  "break_minutes",
  "total_hours",
  "hourly_rate",
  "billable",
  "location",
  "related_work_log_id",
  "notes",
  "source",
  ...SYNC_COLUMNS,
  "created_at",
  "updated_at",
];

function toRow(e: HoursEntry): RepoRow {
  return {
    id: e.id,
    workspace_id: e.workspaceId,
    client_id: e.clientId,
    project_id: e.projectId,
    date: e.date,
    start_time: e.startTime,
    end_time: e.endTime,
    break_minutes: e.breakMinutes,
    total_hours: e.totalHours,
    hourly_rate: e.hourlyRate,
    billable: toInt(e.billable),
    location: e.location,
    related_work_log_id: e.relatedWorkLogId,
    notes: e.notes,
    source: e.source,
    ...syncToRow(e),
    created_at: e.createdAt,
    updated_at: e.updatedAt,
  };
}

function fromRow(row: RepoRow): HoursEntry {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    clientId: row.client_id as string,
    projectId: (row.project_id as string) ?? null,
    date: row.date as string,
    startTime: row.start_time as string,
    endTime: row.end_time as string,
    breakMinutes: row.break_minutes as number,
    totalHours: row.total_hours as number,
    hourlyRate: row.hourly_rate as number,
    billable: toBool(row.billable),
    location: row.location as string,
    relatedWorkLogId: (row.related_work_log_id as string) ?? null,
    notes: row.notes as string,
    source: row.source as HoursEntry["source"],
    ...syncFromRow(row),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export const hoursRepo = createRepository<HoursEntry>({
  table: "hours_entries",
  columns: COLUMNS,
  toRow,
  fromRow,
});

export function listHoursByRange(
  clientId: string,
  startDate: string,
  endDate: string,
): HoursEntry[] {
  return hoursRepo.where(
    "client_id = ? AND date >= ? AND date <= ?",
    [clientId, startDate, endDate],
    "date DESC, start_time DESC",
  );
}

export function listHoursByProject(projectId: string): HoursEntry[] {
  return hoursRepo.where("project_id = ?", [projectId], "date DESC");
}
