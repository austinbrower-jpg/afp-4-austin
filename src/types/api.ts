/**
 * Shared API DTOs used by both route handlers and feature client wrappers.
 * Keep these out of app API routes and feature api modules so neither layer owns types.
 */

import type { InvoiceTimelineEvent } from "@/lib/invoices/timeline";
import type {
  Client,
  HoursEntry,
  InvoiceReport,
  KnowledgePage,
  Project,
  WorkLog,
  Workspace,
} from "./domain";

// ---------------------------------------------------------------------------
// Hours
// ---------------------------------------------------------------------------

/** Hours entry as returned by /api/hours - row plus denormalized display fields. */
export interface HoursEntryWithRelations extends HoursEntry {
  projectName: string | null;
  workLogTitle: string | null;
  invoiceReportLabel?: string | null;
  superseded?: boolean;
}

/** Payload accepted by POST /api/hours and PATCH /api/hours/[id]. */
export interface HoursEntryInput {
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  hourlyRate: number;
  billable: boolean;
  location: string;
  projectId: string | null;
  relatedWorkLogId: string | null;
  notes: string;
  source: HoursEntry["source"];
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export interface DashboardSummary {
  workspaceName: string | null;
  client: Client | null;
  today: { hours: number; date: string };
  week: { hours: number; start: string; end: string };
  month: { hours: number; start: string; end: string };
  currentHourlyRate: number;
  currentInvoiceAmount: number;
  unbilledSince: string | null;
  activeProject: Project | null;
  recentWorkEntries: WorkLog[];
  recentNotes: KnowledgePage[];
  upcomingTasks: WorkLog[];
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

export interface WorkPerformedRow {
  workLogId: string;
  title: string;
  description: string;
  hours: number;
  /** Link to the live work log detail page, or null if it was deleted. */
  href: string | null;
}

export interface InvoiceDetailResponse extends InvoiceReport {
  clientName: string;
  /**
   * Line items augmented with the current work log title/description when
   * that work log still exists locally; falls back to the snapshot taken at
   * generation time if it was deleted.
   */
  workPerformed: WorkPerformedRow[];
  sessionIds: string[];
  workLogIds: string[];
  includedHoursCount: number;
  includedWorkDoneCount: number;
  relationWarnings: string[];
  liveDriftWarnings: string[];
  immutableTotals: {
    totalHours: number;
    totalAmount: number;
    hourlyRate: number;
  };
  notionPageUrl: string | null;
  timeline: InvoiceTimelineEvent[];
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface SettingsResponse {
  workspace: Workspace | null;
  client: Client | null;
}

export interface UpdateClientSettingsInput {
  name?: string;
  defaultHourlyRate?: number;
  timezone?: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export interface SearchResultItem {
  id: string;
  type: "hours" | "worklog" | "project" | "knowledge" | "invoice";
  title: string;
  subtitle: string;
  href: string;
}
