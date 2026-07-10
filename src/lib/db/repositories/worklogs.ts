import "server-only";
import type { Attachment, WorkLog } from "@/types/domain";
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
  "title",
  "date",
  "summary",
  "detailed_notes",
  "invoice_description",
  "status",
  "priority",
  "related_hours_ids",
  "related_knowledge_ids",
  "evidence",
  "github_link",
  "attachments",
  ...SYNC_COLUMNS,
  "created_at",
  "updated_at",
];

function toRow(e: WorkLog): RepoRow {
  return {
    id: e.id,
    workspace_id: e.workspaceId,
    client_id: e.clientId,
    project_id: e.projectId,
    title: e.title,
    date: e.date,
    summary: e.summary,
    detailed_notes: e.detailedNotes,
    invoice_description: e.invoiceDescription,
    status: e.status,
    priority: e.priority,
    related_hours_ids: toJSON(e.relatedHoursIds),
    related_knowledge_ids: toJSON(e.relatedKnowledgeIds),
    evidence: toJSON(e.evidence),
    github_link: e.githubLink,
    attachments: toJSON(e.attachments),
    ...syncToRow(e),
    created_at: e.createdAt,
    updated_at: e.updatedAt,
  };
}

function fromRow(row: RepoRow): WorkLog {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    clientId: row.client_id as string,
    projectId: (row.project_id as string) ?? null,
    title: row.title as string,
    date: row.date as string,
    summary: row.summary as string,
    detailedNotes: row.detailed_notes as string,
    invoiceDescription: row.invoice_description as string,
    status: row.status as WorkLog["status"],
    priority: row.priority as WorkLog["priority"],
    relatedHoursIds: fromJSON<string[]>(row.related_hours_ids, []),
    relatedKnowledgeIds: fromJSON<string[]>(row.related_knowledge_ids, []),
    evidence: fromJSON<string[]>(row.evidence, []),
    githubLink: (row.github_link as string) ?? null,
    attachments: fromJSON<Attachment[]>(row.attachments, []),
    ...syncFromRow(row),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export const workLogRepo = createRepository<WorkLog>({
  table: "work_logs",
  columns: COLUMNS,
  toRow,
  fromRow,
});

export function listWorkLogsByProject(projectId: string): WorkLog[] {
  return workLogRepo.where("project_id = ?", [projectId], "date DESC");
}
