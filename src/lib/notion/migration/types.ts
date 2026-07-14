/**
 * Types for the Phase 5 historical-migration dry run. Nothing in this tree
 * (types, source-data, calculations, project-matcher, dry-run) touches
 * Notion or SQLite - see read-existing.ts for the one file that reads
 * (never writes) local SQLite for duplicate detection.
 */

export type ProjectKey =
  | "bolReviewV2"
  | "commandCenter"
  | "powerAutomateDocs"
  | "invoiceWorkspace"
  | "digitalSystemsAudit";

/** Points back at the exact live Notion page a proposed value was read from. */
export interface SourceProvenance {
  pageId: string;
  pageTitle: string;
  pageUrl: string;
  section?: string;
  quote?: string;
}

export interface SourcePageRef {
  id: string;
  title: string;
  url: string;
  /** When this page's content was read via Notion's read-only fetch for this dry run. */
  fetchedAt: string;
}

export type MigrationAction = "create" | "skip-existing";

export interface MigrationWarning {
  code: string;
  severity: "info" | "warning";
  message: string;
  relatedIds: string[];
}

export interface ProposedRecord<T> {
  syntheticId: string;
  action: MigrationAction;
  existingMatchId?: string | null;
  record: T;
  provenance: SourceProvenance[];
  warnings: string[];
}

export interface ProposedClientRecord {
  name: string;
  status: "active" | "paused" | "archived";
  defaultHourlyRate: number;
  timezone: string;
  notes: string;
}

export interface ProposedProjectRecord {
  key: ProjectKey;
  name: string;
  status: "active" | "on-hold" | "completed" | "archived";
  priority: "low" | "medium" | "high" | "urgent";
  description: string;
  tags: string[];
}

export interface ProposedHoursRecord {
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  /**
   * Exact hours = elapsed minutes / 60, per the approved billing convention
   * (2026-07-10 decision): amounts are derived from exact elapsed minutes,
   * never from hours pre-rounded to hundredths. This is the authoritative,
   * proposed value - not rounded for storage.
   */
  totalHours: number;
  hourlyRate: number;
  billable: boolean;
  location: string;
  notes: string;
  clientName: string;
  projectKey: ProjectKey | null;
  /** exactMinutes/60 x hourlyRate, rounded only at this row's display value (never from rounded hours). */
  expectedAmount: number;
  /**
   * Informational only, NOT used to compute expectedAmount or any total:
   * what this app's existing computeTotalHours/computeAmount pipeline
   * (rounds hours to hundredths, then multiplies by rate) would have
   * produced for this row. Retained to document why that convention was
   * evaluated and explicitly rejected for this migration - see the
   * "billing-convention-approved" warning.
   */
  referenceAppRoundedHours: number;
  referenceAppRoundedAmount: number;
  workstream: string;
  status: string;
}

export interface ProposedWorkLogRecord {
  title: string;
  date: string;
  status: "not-started" | "in-progress" | "blocked" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  summary: string;
  detailedWorkDescription: string;
  detailedSourceReference: string;
  invoiceDescription: string;
  internalNotes: string;
  evidenceLinks: string[];
  clientVisible: true;
  includeInInvoice: true;
  includeInWorkReport: true;
  clientName: string;
  /** Main/primary project, per approved assignment. */
  projectKey: ProjectKey | null;
  /**
   * Other projects this day's work touched, preserved as metadata since the
   * domain WorkLog schema only supports a single `projectId` today. Not
   * silently dropped - see relatedProjectsNote for the human-readable form.
   */
  relatedProjectKeys: ProjectKey[];
  /** Human-readable note cross-referencing relatedProjectKeys, meant to sit alongside summary/invoiceDescription. */
  relatedProjectsNote: string;
  relatedHoursSyntheticIds: string[];
}

export interface DayTotals {
  date: string;
  billableHours: number;
  nonBillableHours: number;
  amount: number;
}

export interface SessionTotal {
  syntheticId: string;
  billable: boolean;
  hours: number;
  amount: number;
}

export interface ReconciliationTotals {
  totalBillableMinutes: number;
  totalNonBillableMinutes: number;
  totalBillableHours: number;
  totalNonBillableHours: number;
  /** Sum of exact-minute session amounts. Must equal $493.50 for this dataset. */
  totalInvoiceAmount: number;
  perDay: DayTotals[];
  perSession: SessionTotal[];
  sourceStated: {
    totalBillableHours: number;
    totalInvoiceAmount: number;
    perDay: Record<string, { hours: number; amount: number }>;
  };
  /**
   * Informational only: what totalInvoiceAmount would have been under the
   * app's default per-entry rounded-hours convention (rejected - see the
   * "billing-convention-approved" warning). Not used anywhere else.
   */
  referenceAppConventionTotal: number;
  /** True when the recalculation matches every source-stated figure. */
  matchesSourceStated: boolean;
  /** Any remaining unresolved mismatches against the source-stated figures - expected to be empty for this dataset. */
  discrepancies: string[];
}

export interface MigrationDryRunResult {
  schemaVersion: 3;
  generatedAt: string;
  writesPerformed: false;
  notionWritesPerformed: false;
  sqliteWritesPerformed: false;
  sourcePages: SourcePageRef[];
  proposedClient: ProposedRecord<ProposedClientRecord>;
  proposedProjects: ProposedRecord<ProposedProjectRecord>[];
  proposedHours: ProposedRecord<ProposedHoursRecord>[];
  proposedWorkLogs: ProposedRecord<ProposedWorkLogRecord>[];
  totals: ReconciliationTotals;
  warnings: MigrationWarning[];
  skipped: Array<{ type: string; syntheticId: string; reason: string }>;
}

/** Read-only snapshot of existing local records, used only for duplicate detection. */
export interface ExistingRecordsSnapshot {
  clientNamesLower: string[];
  projectNamesLower: string[];
  /** `${clientNameLower}|${date}|${startTime}|${endTime}` */
  hoursKeys: string[];
  /** `${clientNameLower}|${date}|${titleLower}` */
  workLogKeys: string[];
}

export const EMPTY_SNAPSHOT: ExistingRecordsSnapshot = {
  clientNamesLower: [],
  projectNamesLower: [],
  hoursKeys: [],
  workLogKeys: [],
};
