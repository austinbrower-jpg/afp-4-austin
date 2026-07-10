/**
 * Deterministic migration keys for the Phase 6 one-time historical import.
 * Pure and dependency-free (no Notion, no SQLite) so it's directly
 * unit-testable. Every key is versioned (`-v1` suffix) so a future
 * migration revision can use a new version without colliding with these
 * historical July 8-9 records.
 *
 * Keys are written into a dedicated "Migration Key" rich_text property
 * added additively to the Clients/Projects/Hours Worked/Work Done
 * databases (see write-schema.ts) and are the sole source of truth for
 * duplicate detection against live Notion - not name/date fuzzy matching.
 */
import type { ProjectKey } from "./types";

export const MIGRATION_VERSION = "v1";

const PROJECT_SLUGS: Record<ProjectKey, string> = {
  bolReviewV2: "bol-review-process-v2",
  commandCenter: "command-center-sales-ops-hub",
  powerAutomateDocs: "power-automate-documentation",
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function clientMigrationKey(): string {
  return `afp-client-${MIGRATION_VERSION}`;
}

export function projectMigrationKey(projectKey: ProjectKey): string {
  return `afp-project-${PROJECT_SLUGS[projectKey]}-${MIGRATION_VERSION}`;
}

export interface HoursKeyInput {
  date: string;
  startTime: string;
  endTime: string;
  billable: boolean;
  projectKey: ProjectKey | null;
}

/** date + start + end + billable + project, per the approved duplicate-key strategy. */
export function hoursMigrationKey(input: HoursKeyInput): string {
  const time = `${input.startTime.replace(":", "")}-${input.endTime.replace(":", "")}`;
  const billable = input.billable ? "billable" : "nonbillable";
  const project = input.projectKey ?? "none";
  return `afp-hours-${input.date}-${time}-${billable}-${project}-${MIGRATION_VERSION}`;
}

export interface WorkLogKeyInput {
  date: string;
  title: string;
}

/** date + title, per the approved duplicate-key strategy. */
export function workLogMigrationKey(input: WorkLogKeyInput): string {
  return `afp-worklog-${input.date}-${slugify(input.title)}-${MIGRATION_VERSION}`;
}
