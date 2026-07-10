/**
 * Core domain model.
 *
 * The app is modeled around generic contractor-workspace entities rather than
 * anything AFP-specific, so additional clients/workspaces can be added later
 * without restructuring data: Workspace -> Client -> Project -> {Hours, WorkLog,
 * Knowledge, Invoice}.
 */

export type ID = string;

export type SyncStatus =
  | "synced"
  | "pending"
  | "syncing"
  | "conflict"
  | "error"
  | "local-only";

/** Fields shared by every entity that can sync with Notion. */
export interface Syncable {
  notionPageId: string | null;
  notionDatabaseId: string | null;
  syncStatus: SyncStatus;
  lastSyncedAt: string | null;
  notionLastEditedTime: string | null;
}

export interface BaseEntity extends Syncable {
  id: ID;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Workspace / Client
// ---------------------------------------------------------------------------

export interface Workspace extends BaseEntity {
  name: string;
  slug: string;
  notionWorkspaceName: string | null;
}

export type ClientStatus = "active" | "paused" | "archived";

export interface Client extends BaseEntity {
  workspaceId: ID;
  name: string;
  color: string;
  status: ClientStatus;
  defaultHourlyRate: number;
  timezone: string;
  notes: string;
}

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

export type ProjectStatus = "active" | "on-hold" | "completed" | "archived";
export type Priority = "low" | "medium" | "high" | "urgent";

export interface Project extends BaseEntity {
  workspaceId: ID;
  clientId: ID;
  name: string;
  description: string;
  status: ProjectStatus;
  priority: Priority;
  color: string;
  tags: string[];
  notes: string;
}

// ---------------------------------------------------------------------------
// Hours
// ---------------------------------------------------------------------------

export type HoursEntrySource = "timer" | "manual";

export interface HoursEntry extends BaseEntity {
  workspaceId: ID;
  clientId: ID;
  projectId: ID | null;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm (24h)
  endTime: string; // HH:mm (24h)
  breakMinutes: number;
  totalHours: number; // derived, persisted for fast querying
  hourlyRate: number;
  billable: boolean;
  location: string;
  relatedWorkLogId: ID | null;
  notes: string;
  source: HoursEntrySource;
}

// ---------------------------------------------------------------------------
// Work Log ("Work Done")
// ---------------------------------------------------------------------------

export type WorkLogStatus = "not-started" | "in-progress" | "blocked" | "done";

export interface Attachment {
  id: ID;
  name: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  addedAt: string;
}

export interface WorkLog extends BaseEntity {
  workspaceId: ID;
  clientId: ID;
  projectId: ID | null;
  title: string;
  date: string; // YYYY-MM-DD
  summary: string;
  detailedNotes: string; // engineering notes (markdown)
  invoiceDescription: string; // client-facing description, edited separately
  status: WorkLogStatus;
  priority: Priority;
  relatedHoursIds: ID[];
  relatedKnowledgeIds: ID[];
  evidence: string[]; // free-text evidence notes / links
  githubLink: string | null;
  attachments: Attachment[];
}

// ---------------------------------------------------------------------------
// Knowledge base ("Work Stuff")
// ---------------------------------------------------------------------------

export type KnowledgeType =
  | "project-note"
  | "documentation"
  | "notes"
  | "flow-map"
  | "research"
  | "meeting-notes"
  | "idea"
  | "sop"
  | "reference";

export interface KnowledgePage extends BaseEntity {
  workspaceId: ID;
  clientId: ID | null;
  projectId: ID | null;
  type: KnowledgeType;
  title: string;
  content: string; // markdown
  tags: string[];
  parentId: ID | null; // nested pages
  backlinkIds: ID[]; // pages this page links to
}

// ---------------------------------------------------------------------------
// Invoice
// ---------------------------------------------------------------------------

export type InvoiceStatus = "draft" | "sent" | "paid" | "void";

export interface InvoiceLineItem {
  workLogId: ID;
  title: string;
  description: string;
  hours: number;
}

export interface InvoiceReport extends BaseEntity {
  workspaceId: ID;
  clientId: ID;
  invoiceNumber: string;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD
  hourlyRate: number;
  totalHours: number;
  totalAmount: number;
  summary: string;
  lineItems: InvoiceLineItem[];
  hoursEntryIds: ID[];
  status: InvoiceStatus;
}

// ---------------------------------------------------------------------------
// Sync engine bookkeeping
// ---------------------------------------------------------------------------

export type SyncEntityType =
  | "client"
  | "project"
  | "hours"
  | "worklog"
  | "knowledge"
  | "invoice";

export interface SyncQueueItem {
  id: ID;
  entityType: SyncEntityType;
  entityId: ID;
  operation: "push" | "pull";
  attempts: number;
  lastError: string | null;
  createdAt: string;
}

export interface SyncLogEntry {
  id: ID;
  startedAt: string;
  finishedAt: string | null;
  direction: "push" | "pull" | "both";
  trigger: "startup" | "manual" | "background" | "on-edit";
  entitiesSynced: number;
  conflicts: number;
  errors: number;
  message: string;
}

export interface SyncConflict {
  id: ID;
  entityType: SyncEntityType;
  entityId: ID;
  localUpdatedAt: string;
  notionUpdatedAt: string;
  localSnapshot: unknown;
  notionSnapshot: unknown;
  detectedAt: string;
  resolvedAt: string | null;
  resolution: "kept-local" | "kept-notion" | "merged" | null;
}
