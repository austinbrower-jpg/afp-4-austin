/**
 * Phase 12A additive relational schema setup for live Notion databases.
 * Schema-only writes via dataSources.update — never touches row data.
 */
import {
  PHASE11_RELATIONAL_SCHEMA_PROPOSAL,
  type ProposedProperty,
  type RelationTarget,
} from "../relational-schema-proposal";
import type { NotionWriteClient } from "./one-time-import";

export const RELATIONAL_DATABASE_ENV = {
  "Hours Worked": "NOTION_DATABASE_HOURS",
  "Work Done": "NOTION_DATABASE_WORKLOGS",
  "Invoice Reports": "NOTION_DATABASE_INVOICES",
  Projects: "NOTION_DATABASE_PROJECTS",
  Clients: "NOTION_DATABASE_CLIENTS",
} as const;

export type RelationalDatabaseLabel = keyof typeof RELATIONAL_DATABASE_ENV;

export interface RelationalDatabaseIds {
  client: string | null;
  project: string | null;
  hours: string | null;
  worklog: string | null;
  invoice: string | null;
}

export interface RelationalDataSourceIds {
  client: string | null;
  project: string | null;
  hours: string | null;
  worklog: string | null;
  invoice: string | null;
}

export interface LivePropertySnapshot {
  type: string;
  selectOptions?: string[];
  relationDataSourceId?: string;
  reciprocalPropertyName?: string;
}

export interface RelationalPropertyInspection {
  database: RelationalDatabaseLabel;
  name: string;
  expectedType: string;
  present: boolean;
  actual?: LivePropertySnapshot;
  expectedSelectOptions?: string[];
  expectedRelationTarget?: RelationTarget;
  expectedReciprocal?: string;
  /** When true the property already exists and must not be modified. */
  skipReason?: string;
}

export interface RelationalSchemaInspectionReport {
  dataSourceIds: RelationalDataSourceIds;
  properties: RelationalPropertyInspection[];
  missingCount: number;
}

export interface AppliedRelationalProperty {
  database: RelationalDatabaseLabel;
  property: string;
}

export interface RelationalSchemaApplyResult {
  applied: AppliedRelationalProperty[];
  inspectionBefore: RelationalSchemaInspectionReport;
  inspectionAfter: RelationalSchemaInspectionReport;
  stoppedEarly: boolean;
  error?: string;
}

function targetDataSourceId(
  target: RelationTarget,
  ids: RelationalDataSourceIds,
): string | null {
  switch (target) {
    case "Clients":
      return ids.client;
    case "Projects":
      return ids.project;
    case "Hours Worked":
      return ids.hours;
    case "Work Done":
      return ids.worklog;
    case "Invoice Reports":
      return ids.invoice;
    default:
      return null;
  }
}

function readPropertySnapshot(raw: Record<string, unknown> | undefined): LivePropertySnapshot | undefined {
  if (!raw || typeof raw.type !== "string") return undefined;
  const snapshot: LivePropertySnapshot = { type: raw.type };
  if (raw.type === "select" && raw.select && typeof raw.select === "object") {
    const options = (raw.select as { options?: Array<{ name?: string }> }).options ?? [];
    snapshot.selectOptions = options.map((o) => o.name ?? "").filter(Boolean);
  }
  if (raw.type === "relation" && raw.relation && typeof raw.relation === "object") {
    const rel = raw.relation as {
      data_source_id?: string;
      dual_property?: { synced_property_name?: string };
    };
    snapshot.relationDataSourceId = rel.data_source_id;
    snapshot.reciprocalPropertyName = rel.dual_property?.synced_property_name;
  }
  return snapshot;
}

export function propertyPatch(
  prop: ProposedProperty,
  dataSourceIds: RelationalDataSourceIds,
): Record<string, unknown> | null {
  switch (prop.type) {
    case "rich_text":
      return { [prop.name]: { type: "rich_text", rich_text: {} } };
    case "date":
      return { [prop.name]: { type: "date", date: {} } };
    case "url":
      return { [prop.name]: { type: "url", url: {} } };
    case "select":
      return {
        [prop.name]: {
          type: "select",
          select: {
            options: prop.options.map((o) => ({ name: o.name, color: "default" })),
          },
        },
      };
    case "relation": {
      const targetId = targetDataSourceId(prop.target, dataSourceIds);
      if (!targetId) return null;
      if (prop.reciprocal) {
        return {
          [prop.name]: {
            type: "relation",
            relation: {
              data_source_id: targetId,
              type: "dual_property",
              dual_property: { synced_property_name: prop.reciprocal },
            },
          },
        };
      }
      return {
        [prop.name]: {
          type: "relation",
          relation: {
            data_source_id: targetId,
            type: "single_property",
            single_property: {},
          },
        },
      };
    }
    default:
      return null;
  }
}

export function inspectRelationalSchema(
  propertiesByDatabase: Record<RelationalDatabaseLabel, Record<string, unknown>>,
  dataSourceIds: RelationalDataSourceIds,
): RelationalSchemaInspectionReport {
  const properties: RelationalPropertyInspection[] = [];

  for (const db of PHASE11_RELATIONAL_SCHEMA_PROPOSAL) {
    const label = db.database as RelationalDatabaseLabel;
    const actual = propertiesByDatabase[label] ?? {};
    for (const prop of db.properties) {
      const raw = actual[prop.name] as Record<string, unknown> | undefined;
      const snapshot = readPropertySnapshot(raw);
      const inspection: RelationalPropertyInspection = {
        database: label,
        name: prop.name,
        expectedType: prop.type,
        present: Boolean(snapshot),
        actual: snapshot,
        expectedSelectOptions: prop.type === "select" ? prop.options.map((o) => o.name) : undefined,
        expectedRelationTarget: prop.type === "relation" ? prop.target : undefined,
        expectedReciprocal: prop.type === "relation" ? prop.reciprocal : undefined,
      };
      if (snapshot) {
        inspection.skipReason = "Already present — no modification performed";
        if (snapshot.type !== prop.type) {
          inspection.skipReason = `Already present with type ${snapshot.type} — refusing to change`;
        }
        if (prop.type === "select" && snapshot.selectOptions) {
          const missing = (inspection.expectedSelectOptions ?? []).filter(
            (o) => !snapshot.selectOptions!.includes(o),
          );
          if (missing.length > 0) {
            inspection.skipReason = `Select exists but missing options: ${missing.join(", ")} — not modified`;
          }
        }
      } else if (prop.type === "relation") {
        const targetId = targetDataSourceId(prop.target, dataSourceIds);
        if (!targetId) {
          inspection.skipReason = `Cannot create relation — target data source for ${prop.target} is unavailable`;
        }
      }
      properties.push(inspection);
    }
  }

  return {
    dataSourceIds,
    properties,
    missingCount: properties.filter((p) => !p.present && !p.skipReason?.startsWith("Cannot")).length,
  };
}

export function missingRelationalPatches(
  inspection: RelationalSchemaInspectionReport,
): Array<{ database: RelationalDatabaseLabel; property: string; patch: Record<string, unknown> }> {
  const patches: Array<{ database: RelationalDatabaseLabel; property: string; patch: Record<string, unknown> }> = [];
  for (const db of PHASE11_RELATIONAL_SCHEMA_PROPOSAL) {
    const label = db.database as RelationalDatabaseLabel;
    for (const prop of db.properties) {
      const row = inspection.properties.find((p) => p.database === label && p.name === prop.name);
      if (!row || row.present) continue;
      if (row.skipReason?.startsWith("Cannot")) continue;
      const patch = propertyPatch(prop, inspection.dataSourceIds);
      if (!patch) continue;
      patches.push({ database: label, property: prop.name, patch });
    }
  }
  return patches;
}

export function allRelationalPropertiesReady(inspection: RelationalSchemaInspectionReport): boolean {
  return inspection.properties.every((p) => p.present && p.actual?.type === p.expectedType);
}

export function selectOptionsValid(inspection: RelationalSchemaInspectionReport): boolean {
  return inspection.properties
    .filter((p) => p.expectedSelectOptions && p.present)
    .every((p) => {
      if (!p.actual?.selectOptions) return p.actual?.type === "select";
      if (p.skipReason?.includes("Already present")) {
        return p.actual.type === "select";
      }
      if (p.skipReason?.includes("missing options")) {
        return false;
      }
      return p.expectedSelectOptions!.every((o) => p.actual!.selectOptions!.includes(o));
    });
}

export async function resolveDataSourceIds(
  notion: NotionWriteClient,
  databaseIds: RelationalDatabaseIds,
): Promise<RelationalDataSourceIds> {
  const resolve = async (databaseId: string | null): Promise<string | null> => {
    if (!databaseId) return null;
    const database = await notion.databases.retrieve({ database_id: databaseId });
    return database.data_sources?.[0]?.id ?? null;
  };
  const [client, project, hours, worklog, invoice] = await Promise.all([
    resolve(databaseIds.client),
    resolve(databaseIds.project),
    resolve(databaseIds.hours),
    resolve(databaseIds.worklog),
    resolve(databaseIds.invoice),
  ]);
  return { client, project, hours, worklog, invoice };
}

export async function fetchDatabaseProperties(
  notion: NotionWriteClient,
  dataSourceId: string,
): Promise<Record<string, unknown>> {
  const dataSource = await notion.dataSources.retrieve({ data_source_id: dataSourceId });
  return dataSource.properties as Record<string, unknown>;
}

export async function inspectLiveRelationalSchema(
  notion: NotionWriteClient,
  databaseIds: RelationalDatabaseIds,
): Promise<RelationalSchemaInspectionReport> {
  const dataSourceIds = await resolveDataSourceIds(notion, databaseIds);
  const labels: RelationalDatabaseLabel[] = [
    "Hours Worked",
    "Work Done",
    "Invoice Reports",
    "Projects",
  ];
  const idByLabel: Record<RelationalDatabaseLabel, string | null> = {
    Clients: dataSourceIds.client,
    Projects: dataSourceIds.project,
    "Hours Worked": dataSourceIds.hours,
    "Work Done": dataSourceIds.worklog,
    "Invoice Reports": dataSourceIds.invoice,
  };
  const propertiesByDatabase = {} as Record<RelationalDatabaseLabel, Record<string, unknown>>;
  for (const label of labels) {
    const dsId = idByLabel[label];
    propertiesByDatabase[label] = dsId ? await fetchDatabaseProperties(notion, dsId) : {};
  }
  return inspectRelationalSchema(propertiesByDatabase, dataSourceIds);
}

/**
 * Applies missing relational properties one at a time. Stops on the first
 * dataSources.update error. Never modifies existing properties or rows.
 */
export async function applyRelationalSchemaSetup(
  notion: NotionWriteClient,
  databaseIds: RelationalDatabaseIds,
): Promise<RelationalSchemaApplyResult> {
  const before = await inspectLiveRelationalSchema(notion, databaseIds);
  const toApply = missingRelationalPatches(before);
  const applied: AppliedRelationalProperty[] = [];

  const dataSourceIdForDatabase = (label: RelationalDatabaseLabel): string | null => {
    switch (label) {
      case "Hours Worked":
        return before.dataSourceIds.hours;
      case "Work Done":
        return before.dataSourceIds.worklog;
      case "Invoice Reports":
        return before.dataSourceIds.invoice;
      case "Projects":
        return before.dataSourceIds.project;
      default:
        return null;
    }
  };

  for (const item of toApply) {
    const dataSourceId = dataSourceIdForDatabase(item.database);
    if (!dataSourceId) {
      return {
        applied,
        inspectionBefore: before,
        inspectionAfter: before,
        stoppedEarly: true,
        error: `Missing data source for ${item.database}`,
      };
    }
    try {
      await notion.dataSources.update({
        data_source_id: dataSourceId,
        properties: item.patch,
      });
      applied.push({ database: item.database, property: item.property });
    } catch (err) {
      return {
        applied,
        inspectionBefore: before,
        inspectionAfter: await inspectLiveRelationalSchema(notion, databaseIds),
        stoppedEarly: true,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  const after = await inspectLiveRelationalSchema(notion, databaseIds);
  return { applied, inspectionBefore: before, inspectionAfter: after, stoppedEarly: false };
}

export function reciprocalNamesFromInspection(
  inspection: RelationalSchemaInspectionReport,
): Array<{ database: string; property: string; reciprocal: string | null }> {
  return inspection.properties
    .filter((p) => p.expectedType === "relation" && p.present)
    .map((p) => ({
      database: p.database,
      property: p.name,
      reciprocal: p.actual?.reciprocalPropertyName ?? p.expectedReciprocal ?? null,
    }));
}
