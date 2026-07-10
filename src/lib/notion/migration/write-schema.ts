/**
 * Additive Notion schema for the Phase 6 one-time import, and the pure
 * (no network) property-object builders used when creating pages. Kept
 * separate from src/lib/notion/mappers.ts deliberately - this migration is
 * self-contained and never touches the general sync engine's push/pull
 * code, per Phase 6 goal 1 ("must be separate from the general sync
 * engine").
 *
 * Two additive-only properties are introduced:
 *
 * - "Migration Key" (rich_text) - added to Clients, Projects, Hours Worked,
 *   and Work Done databases. Sole source of truth for duplicate detection
 *   against live Notion (see write-keys.ts) - never inferred from name/date
 *   text matching.
 * - "Project" (relation -> Projects data source) - added to Hours Worked
 *   and Work Done databases. NOTION_SCHEMA.hours.project /
 *   NOTION_SCHEMA.worklog.project in mappers.ts already reserve this exact
 *   property name (it was defined but never populated by the general
 *   sync engine's push functions) - this migration is the first to
 *   actually write it, which is why the property needs adding, not
 *   renaming.
 *
 * Both are additive: adding a new column to an existing Notion database
 * never touches any existing row's other data (same non-destructive
 * guarantee documented in docs/notion-migration-plan.md for the general
 * sync engine).
 */
import type {
  ProposedClientRecord,
  ProposedHoursRecord,
  ProposedProjectRecord,
  ProposedWorkLogRecord,
} from "./types";

/**
 * Property names mirrored from NOTION_SCHEMA in ../mappers.ts (not imported
 * directly - that file is `import "server-only"`, which would make this
 * module, and anything that tests it, unimportable under plain-node vitest;
 * same reasoning as schema-requirements.ts in Phase 3). Keep these four
 * names in sync with NOTION_SCHEMA.client/project/hours by hand if that
 * object ever changes.
 */
export const ENTITY_PROPERTY_NAMES = {
  client: {
    title: "Name",
    status: "Status",
    defaultHourlyRate: "Default Hourly Rate",
    color: "Color",
    timezone: "Timezone",
    notes: "Notes",
  },
  project: {
    title: "Name",
    status: "Status",
    priority: "Priority",
    description: "Description",
    tags: "Tags",
    color: "Color",
  },
  hours: {
    title: "Date",
    startTime: "Start Time",
    endTime: "End Time",
    breakMinutes: "Break (min)",
    totalHours: "Total Hours",
    hourlyRate: "Hourly Rate",
    billable: "Billable",
    location: "Location",
    notes: "Notes",
    project: "Project",
  },
  worklog: {
    title: "Title",
    date: "Date",
    status: "Status",
    priority: "Priority",
    summary: "Summary",
    invoiceDescription: "Invoice Description",
    project: "Project",
  },
} as const;

export const MIGRATION_KEY_PROPERTY_NAME = "Migration Key";
export const PROJECT_RELATION_PROPERTY_NAME = ENTITY_PROPERTY_NAMES.hours.project; // "Project" - same name reserved in NOTION_SCHEMA.worklog.project in mappers.ts

export type MigrationSchemaEntityType = "client" | "project" | "hours" | "worklog";

/** Which of the four migration-relevant entities also need the Project relation property (client/project don't relate to themselves). */
export const NEEDS_PROJECT_RELATION: Record<MigrationSchemaEntityType, boolean> = {
  client: false,
  project: false,
  hours: true,
  worklog: true,
};

/** Minimal shape of a single Notion property definition, as returned by dataSources.retrieve(). */
export interface NotionPropertyLike {
  type: string;
}

export function hasMigrationKeyProperty(
  properties: Record<string, NotionPropertyLike> | null | undefined,
): boolean {
  return properties?.[MIGRATION_KEY_PROPERTY_NAME]?.type === "rich_text";
}

export function hasProjectRelationProperty(
  properties: Record<string, NotionPropertyLike> | null | undefined,
): boolean {
  return properties?.[PROJECT_RELATION_PROPERTY_NAME]?.type === "relation";
}

/** The dataSources.update() body that additively adds the Migration Key column. Idempotent - only call when hasMigrationKeyProperty() is false. */
export function migrationKeyPropertyPatch(): Record<string, unknown> {
  return { [MIGRATION_KEY_PROPERTY_NAME]: { type: "rich_text", rich_text: {} } };
}

/** The dataSources.update() body that additively adds the Project relation column, pointed at the Projects data source. Idempotent - only call when hasProjectRelationProperty() is false. */
export function projectRelationPropertyPatch(projectsDataSourceId: string): Record<string, unknown> {
  return {
    [PROJECT_RELATION_PROPERTY_NAME]: {
      type: "relation",
      relation: { data_source_id: projectsDataSourceId, type: "single_property", single_property: {} },
    },
  };
}

// ---------------------------------------------------------------------------
// Pure Notion property-value builders (push direction only - this migration
// never reads row content back, only writes new pages).
// ---------------------------------------------------------------------------

const title = (text: string) => ({
  title: [{ type: "text" as const, text: { content: text.slice(0, 2000) } }],
});
const richText = (text: string) => ({
  rich_text: [{ type: "text" as const, text: { content: (text || "").slice(0, 2000) } }],
});
const select = (name: string) => ({ select: { name } });
const multiSelect = (names: string[]) => ({ multi_select: names.map((name) => ({ name })) });
const number = (n: number) => ({ number: n });
const checkbox = (b: boolean) => ({ checkbox: b });
const date = (isoDate: string) => ({ date: { start: isoDate } });
const relation = (pageIds: string[]) => ({ relation: pageIds.map((id) => ({ id })) });

const DEFAULT_COLOR = "#6366f1";

export function buildClientProperties(
  record: ProposedClientRecord,
  migrationKey: string,
): Record<string, unknown> {
  const s = ENTITY_PROPERTY_NAMES.client;
  return {
    [s.title]: title(record.name),
    [s.status]: select(record.status),
    [s.defaultHourlyRate]: number(record.defaultHourlyRate),
    [s.color]: richText(DEFAULT_COLOR),
    [s.timezone]: richText(record.timezone),
    [s.notes]: richText(record.notes),
    [MIGRATION_KEY_PROPERTY_NAME]: richText(migrationKey),
  };
}

export function buildProjectProperties(
  record: ProposedProjectRecord,
  migrationKey: string,
): Record<string, unknown> {
  const s = ENTITY_PROPERTY_NAMES.project;
  return {
    [s.title]: title(record.name),
    [s.status]: select(record.status),
    [s.priority]: select(record.priority),
    [s.description]: richText(record.description),
    [s.tags]: multiSelect(record.tags),
    [s.color]: richText(DEFAULT_COLOR),
    [MIGRATION_KEY_PROPERTY_NAME]: richText(migrationKey),
  };
}

export function buildHoursProperties(
  record: ProposedHoursRecord,
  migrationKey: string,
  projectPageId: string | null,
): Record<string, unknown> {
  const s = ENTITY_PROPERTY_NAMES.hours;
  const props: Record<string, unknown> = {
    [s.title]: title(record.date),
    [s.startTime]: richText(record.startTime),
    [s.endTime]: richText(record.endTime),
    [s.breakMinutes]: number(record.breakMinutes),
    [s.totalHours]: number(record.totalHours),
    [s.hourlyRate]: number(record.hourlyRate),
    [s.billable]: checkbox(record.billable),
    [s.location]: richText(record.location),
    [s.notes]: richText(record.notes),
    [MIGRATION_KEY_PROPERTY_NAME]: richText(migrationKey),
  };
  if (projectPageId) props[PROJECT_RELATION_PROPERTY_NAME] = relation([projectPageId]);
  return props;
}

/**
 * Appends relatedProjectsNote (if any) as a trailing paragraph on the
 * Notion Summary property - this is how "preserve references to related
 * projects in the detailed summary" (Phase 6 goal, July 9 work log) is
 * satisfied concretely. The JSON-facing ProposedWorkLogRecord.summary stays
 * pure/verbatim for audit purposes; only the Notion property text gets the
 * appended note.
 */
export function buildWorkLogSummaryText(record: ProposedWorkLogRecord): string {
  if (!record.relatedProjectsNote) return record.summary;
  return `${record.summary}\n\n${record.relatedProjectsNote}`;
}

export function buildWorkLogProperties(
  record: ProposedWorkLogRecord,
  migrationKey: string,
  projectPageId: string | null,
): Record<string, unknown> {
  const s = ENTITY_PROPERTY_NAMES.worklog;
  const props: Record<string, unknown> = {
    [s.title]: title(record.title),
    [s.date]: date(record.date),
    [s.status]: select(record.status),
    [s.priority]: select(record.priority),
    [s.summary]: richText(buildWorkLogSummaryText(record)),
    [s.invoiceDescription]: richText(record.invoiceDescription),
    [MIGRATION_KEY_PROPERTY_NAME]: richText(migrationKey),
  };
  if (projectPageId) props[PROJECT_RELATION_PROPERTY_NAME] = relation([projectPageId]);
  return props;
}
