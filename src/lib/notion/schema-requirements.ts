import type { SyncEntityType } from "@/types/domain";
import {
  PHASE11_RELATIONAL_SCHEMA_PROPOSAL,
  type ProposedProperty,
  type RelationTarget,
} from "./relational-schema-proposal";

/**
 * Pure data + pure validation logic for the read-only database mapping
 * feature (Phase 3). Deliberately has no "server-only" import and never
 * touches the network, so it can be unit tested directly. The actual Notion
 * API calls live in ./verify-databases.ts, which imports from here.
 *
 * Property names/types below must stay in sync with the push builders in
 * ./mappers.ts (NOTION_SCHEMA + *ToNotionProperties) - they describe the
 * same six databases from the read side instead of the write side.
 */

export type NotionPropertyType =
  | "title"
  | "rich_text"
  | "select"
  | "multi_select"
  | "number"
  | "checkbox"
  | "date"
  | "url"
  | "relation";

export interface PropertyRequirement {
  /** Domain field name (matches the key in mappers.ts's NOTION_SCHEMA). */
  field: string;
  /** Exact Notion column name expected. */
  notionName: string;
  /** Notion property type expected for that column. */
  expectedType: NotionPropertyType;
}

export interface ProposedSchemaChange {
  entity: "worklog" | "knowledge";
  databaseLabel: string;
  notionName: string;
  expectedType: NotionPropertyType;
  status: "proposed" | "deferred";
  reason?: string;
}

/** Additive Phase 8 preview. No schema mutation implementation exists. */
export const PROPOSED_NOTION_SCHEMA_CHANGES: ProposedSchemaChange[] = [
  { entity: "worklog", databaseLabel: "Work Done", notionName: "Client Visible", expectedType: "checkbox", status: "proposed" },
  { entity: "worklog", databaseLabel: "Work Done", notionName: "Include in Invoice", expectedType: "checkbox", status: "proposed" },
  { entity: "worklog", databaseLabel: "Work Done", notionName: "Include in Work Report", expectedType: "checkbox", status: "proposed" },
  { entity: "worklog", databaseLabel: "Work Done", notionName: "Detailed Work Description", expectedType: "rich_text", status: "proposed" },
  { entity: "worklog", databaseLabel: "Work Done", notionName: "Internal Notes", expectedType: "rich_text", status: "proposed" },
  { entity: "worklog", databaseLabel: "Work Done", notionName: "Evidence Links", expectedType: "rich_text", status: "proposed" },
  { entity: "worklog", databaseLabel: "Work Done", notionName: "Related Hours", expectedType: "relation", status: "deferred", reason: "Deferred until the existing Hours relation can be confirmed without altering live schema." },
  { entity: "knowledge", databaseLabel: "Knowledge", notionName: "Client Visible", expectedType: "checkbox", status: "proposed" },
  { entity: "knowledge", databaseLabel: "Knowledge", notionName: "Include in Work Report", expectedType: "checkbox", status: "proposed" },
  { entity: "knowledge", databaseLabel: "Knowledge", notionName: "Report Summary", expectedType: "rich_text", status: "proposed" },
  { entity: "knowledge", databaseLabel: "Knowledge", notionName: "Project", expectedType: "relation", status: "proposed" },
  { entity: "knowledge", databaseLabel: "Knowledge", notionName: "Source Page", expectedType: "url", status: "proposed" },
];

export const NOTION_PROPERTY_REQUIREMENTS: Record<SyncEntityType, PropertyRequirement[]> = {
  client: [
    { field: "title", notionName: "Name", expectedType: "title" },
    { field: "status", notionName: "Status", expectedType: "select" },
    { field: "defaultHourlyRate", notionName: "Default Hourly Rate", expectedType: "number" },
    { field: "color", notionName: "Color", expectedType: "rich_text" },
    { field: "timezone", notionName: "Timezone", expectedType: "rich_text" },
    { field: "notes", notionName: "Notes", expectedType: "rich_text" },
  ],
  project: [
    { field: "title", notionName: "Name", expectedType: "title" },
    { field: "status", notionName: "Status", expectedType: "select" },
    { field: "priority", notionName: "Priority", expectedType: "select" },
    { field: "description", notionName: "Description", expectedType: "rich_text" },
    { field: "tags", notionName: "Tags", expectedType: "multi_select" },
    { field: "color", notionName: "Color", expectedType: "rich_text" },
  ],
  hours: [
    // "Date" doubles as the required title column - see hoursToNotionProperties
    // in mappers.ts, which only ever writes it via title(), never date().
    { field: "title", notionName: "Date", expectedType: "title" },
    { field: "startTime", notionName: "Start Time", expectedType: "rich_text" },
    { field: "endTime", notionName: "End Time", expectedType: "rich_text" },
    { field: "breakMinutes", notionName: "Break (min)", expectedType: "number" },
    { field: "totalHours", notionName: "Total Hours", expectedType: "number" },
    { field: "hourlyRate", notionName: "Hourly Rate", expectedType: "number" },
    { field: "billable", notionName: "Billable", expectedType: "checkbox" },
    { field: "location", notionName: "Location", expectedType: "rich_text" },
    { field: "notes", notionName: "Notes", expectedType: "rich_text" },
    { field: "project", notionName: "Project", expectedType: "relation" },
  ],
  worklog: [
    { field: "title", notionName: "Title", expectedType: "title" },
    { field: "date", notionName: "Date", expectedType: "date" },
    { field: "status", notionName: "Status", expectedType: "select" },
    { field: "priority", notionName: "Priority", expectedType: "select" },
    { field: "summary", notionName: "Summary", expectedType: "rich_text" },
    { field: "invoiceDescription", notionName: "Invoice Description", expectedType: "rich_text" },
    { field: "githubLink", notionName: "GitHub Link", expectedType: "url" },
    { field: "clientVisible", notionName: "Client Visible", expectedType: "checkbox" },
    { field: "includeInInvoice", notionName: "Include in Invoice", expectedType: "checkbox" },
    { field: "includeInWorkReport", notionName: "Include in Work Report", expectedType: "checkbox" },
    { field: "detailedWorkDescription", notionName: "Detailed Work Description", expectedType: "rich_text" },
    { field: "internalNotes", notionName: "Internal Notes", expectedType: "rich_text" },
    { field: "evidenceLinks", notionName: "Evidence Links", expectedType: "rich_text" },
  ],
  knowledge: [
    { field: "title", notionName: "Title", expectedType: "title" },
    { field: "type", notionName: "Type", expectedType: "select" },
    { field: "tags", notionName: "Tags", expectedType: "multi_select" },
    { field: "clientVisible", notionName: "Client Visible", expectedType: "checkbox" },
    { field: "includeInWorkReport", notionName: "Include in Work Report", expectedType: "checkbox" },
    { field: "reportSummary", notionName: "Report Summary", expectedType: "rich_text" },
    { field: "project", notionName: "Project", expectedType: "relation" },
    { field: "sourcePage", notionName: "Source Page", expectedType: "url" },
  ],
  invoice: [
    { field: "title", notionName: "Invoice Number", expectedType: "title" },
    { field: "periodStart", notionName: "Period Start", expectedType: "date" },
    { field: "periodEnd", notionName: "Period End", expectedType: "date" },
    { field: "hourlyRate", notionName: "Hourly Rate", expectedType: "number" },
    { field: "totalHours", notionName: "Total Hours", expectedType: "number" },
    { field: "totalAmount", notionName: "Total Amount", expectedType: "number" },
    { field: "status", notionName: "Status", expectedType: "select" },
    { field: "summary", notionName: "Summary", expectedType: "rich_text" },
  ],
};

export interface DatabaseEnvVar {
  envVar: string;
  label: string;
}

/** The six databases the app's sync engine knows about, and the env var that configures each. */
export const NOTION_DATABASE_ENV_VARS: Record<SyncEntityType, DatabaseEnvVar> = {
  client: { envVar: "NOTION_DATABASE_CLIENTS", label: "Clients" },
  project: { envVar: "NOTION_DATABASE_PROJECTS", label: "Projects" },
  hours: { envVar: "NOTION_DATABASE_HOURS", label: "Hours" },
  worklog: { envVar: "NOTION_DATABASE_WORKLOGS", label: "Work Logs" },
  knowledge: { envVar: "NOTION_DATABASE_KNOWLEDGE", label: "Knowledge" },
  invoice: { envVar: "NOTION_DATABASE_INVOICES", label: "Invoices" },
};

export type PropertyCheckStatus = "ok" | "missing" | "wrong-type";

export interface PropertyCheckResult extends PropertyRequirement {
  status: PropertyCheckStatus;
  actualType?: string;
}

/** Minimal shape we need out of a Notion data source's property config. */
export interface NotionPropertyLike {
  type: string;
}

function missingResult(req: PropertyRequirement): PropertyCheckResult {
  return { ...req, status: "missing" };
}

/**
 * Pure comparison: given the properties Notion actually reports for a data
 * source (or null/undefined when unreachable) and the requirements for an
 * entity, returns a per-property verdict. Never touches the network.
 */
export function validateProperties(
  actual: Record<string, NotionPropertyLike> | null | undefined,
  requirements: PropertyRequirement[],
): PropertyCheckResult[] {
  return requirements.map((req) => {
    const found = actual?.[req.notionName];
    if (!found) return missingResult(req);
    if (found.type !== req.expectedType) {
      return { ...req, status: "wrong-type", actualType: found.type };
    }
    return { ...req, status: "ok" };
  });
}

/** A database's schema is valid only when every required property is present with the right type. */
export function isSchemaValid(results: PropertyCheckResult[]): boolean {
  return results.length > 0 && results.every((r) => r.status === "ok");
}

/** Properties that need attention, for surfacing "specific missing properties" in the UI. */
export function invalidProperties(results: PropertyCheckResult[]): PropertyCheckResult[] {
  return results.filter((r) => r.status !== "ok");
}

export interface DatabaseConfigInput {
  apiKey: string | null;
  databaseId: string | null;
}

export interface DatabaseConfigStatus {
  apiKeyConfigured: boolean;
  databaseConfigured: boolean;
}

/** Pure config-detection logic: does this entity have what it needs to even attempt a check? */
export function detectDatabaseConfiguration(input: DatabaseConfigInput): DatabaseConfigStatus {
  return {
    apiKeyConfigured: Boolean(input.apiKey),
    databaseConfigured: Boolean(input.databaseId),
  };
}

export interface DatabaseReadinessInput {
  configured: boolean;
  accessible: boolean | null;
  schemaValid: boolean | null;
}

/** A single database is "ready" only once it's configured, reachable, and its schema checks out. */
export function isDatabaseReady(input: DatabaseReadinessInput): boolean {
  return input.configured && input.accessible === true && input.schemaValid === true;
}

/**
 * Overall "Read-only mapping ready" status: every one of the six databases
 * must be configured, accessible, and schema-valid, and the API key itself
 * must be present. An empty database list is never "ready".
 */
export function isMappingReady(
  apiKeyConfigured: boolean,
  databases: DatabaseReadinessInput[],
): boolean {
  return apiKeyConfigured && databases.length > 0 && databases.every(isDatabaseReady);
}

// ---------------------------------------------------------------------------
// Phase 11 relational schema verification (read-only, additive proposal)
// ---------------------------------------------------------------------------

export interface RelationalPropertyCheck {
  database: string;
  name: string;
  expectedType: NotionPropertyType;
  status: PropertyCheckStatus;
  actualType?: string;
  relationTarget?: RelationTarget;
  expectedRelationTarget?: RelationTarget;
  selectOptions?: string[];
  expectedSelectOptions?: string[];
  reciprocal?: string;
}

const ENTITY_TO_DATABASE: Record<string, string> = {
  hours: "Hours Worked",
  worklog: "Work Done",
  invoice: "Invoice Reports",
  project: "Projects",
};

function proposedToRequirement(prop: ProposedProperty): {
  notionName: string;
  expectedType: NotionPropertyType;
  relationTarget?: RelationTarget;
  selectOptions?: string[];
  reciprocal?: string;
} {
  if (prop.type === "relation") {
    return {
      notionName: prop.name,
      expectedType: "relation",
      relationTarget: prop.target,
      reciprocal: prop.reciprocal,
    };
  }
  if (prop.type === "select") {
    return {
      notionName: prop.name,
      expectedType: "select",
      selectOptions: prop.options.map((o) => o.name),
    };
  }
  return { notionName: prop.name, expectedType: prop.type };
}

export function relationalSchemaChecks(
  actualByDatabase: Record<string, Record<string, NotionPropertyLike> | null | undefined>,
): RelationalPropertyCheck[] {
  const checks: RelationalPropertyCheck[] = [];
  for (const db of PHASE11_RELATIONAL_SCHEMA_PROPOSAL) {
    const actual = actualByDatabase[db.database];
    for (const prop of db.properties) {
      const req = proposedToRequirement(prop);
      const found = actual?.[req.notionName];
      if (!found) {
        checks.push({
          database: db.database,
          name: req.notionName,
          expectedType: req.expectedType,
          status: "missing",
          expectedRelationTarget: req.relationTarget,
          expectedSelectOptions: req.selectOptions,
          reciprocal: req.reciprocal,
        });
        continue;
      }
      if (found.type !== req.expectedType) {
        checks.push({
          database: db.database,
          name: req.notionName,
          expectedType: req.expectedType,
          actualType: found.type,
          status: "wrong-type",
          expectedRelationTarget: req.relationTarget,
          expectedSelectOptions: req.selectOptions,
          reciprocal: req.reciprocal,
        });
        continue;
      }
      checks.push({
        database: db.database,
        name: req.notionName,
        expectedType: req.expectedType,
        status: "ok",
        actualType: found.type,
        expectedRelationTarget: req.relationTarget,
        expectedSelectOptions: req.selectOptions,
        reciprocal: req.reciprocal,
      });
    }
  }
  return checks;
}

export function mapEntityTypeToDatabaseLabel(type: SyncEntityType): string | null {
  return ENTITY_TO_DATABASE[type] ?? null;
}

export { PHASE11_RELATIONAL_SCHEMA_PROPOSAL };
