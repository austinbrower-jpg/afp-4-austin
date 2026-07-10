import "server-only";
import { getNotionClient } from "./client";
import { getNotionConfig, databaseIdFor } from "./config";
import {
  NOTION_PROPERTY_REQUIREMENTS,
  NOTION_DATABASE_ENV_VARS,
  validateProperties,
  isSchemaValid,
  isMappingReady,
  type PropertyCheckResult,
} from "./schema-requirements";
import type { SyncEntityType } from "@/types/domain";

export interface DatabaseVerification {
  type: SyncEntityType;
  label: string;
  envVar: string;
  databaseId: string | null;
  /** Was NOTION_DATABASE_* set for this entity? */
  configured: boolean;
  /** Could the integration retrieve the database at all? null = not checked. */
  accessible: boolean | null;
  databaseName: string | null;
  /** Do all required properties exist with the expected type? null = not checked. */
  schemaValid: boolean | null;
  properties: PropertyCheckResult[];
  error?: string;
}

export interface ReadOnlyMappingReport {
  apiKeyConfigured: boolean;
  /** True only when every one of the six databases is configured, accessible, and schema-valid. */
  ready: boolean;
  databases: DatabaseVerification[];
}

function extractTitleText(title: Array<{ plain_text?: string }> | undefined): string | null {
  if (!title || title.length === 0) return null;
  const text = title.map((t) => t.plain_text ?? "").join("");
  return text || null;
}

function unreachableProperties(type: SyncEntityType): PropertyCheckResult[] {
  return NOTION_PROPERTY_REQUIREMENTS[type].map((req) => ({ ...req, status: "missing" as const }));
}

/**
 * Read-only check for a single database: two GET calls (databases.retrieve,
 * dataSources.retrieve), no queries against actual rows and no writes.
 */
async function verifyOne(
  type: SyncEntityType,
  notion: NonNullable<ReturnType<typeof getNotionClient>>,
  databaseId: string,
): Promise<Omit<DatabaseVerification, "type" | "label" | "envVar" | "configured" | "databaseId">> {
  const requirements = NOTION_PROPERTY_REQUIREMENTS[type];

  try {
    const database = await notion.databases.retrieve({ database_id: databaseId });

    if (!("data_sources" in database)) {
      return {
        accessible: true,
        databaseName: null,
        schemaValid: false,
        properties: unreachableProperties(type),
        error: "Integration can see this database but not its full schema (partial access).",
      };
    }

    const databaseName = extractTitleText(database.title);
    const dataSourceId = database.data_sources[0]?.id;
    if (!dataSourceId) {
      return {
        accessible: true,
        databaseName,
        schemaValid: false,
        properties: unreachableProperties(type),
        error: "Database has no queryable data source.",
      };
    }

    const dataSource = await notion.dataSources.retrieve({ data_source_id: dataSourceId });
    const properties = validateProperties(dataSource.properties, requirements);

    return {
      accessible: true,
      databaseName,
      schemaValid: isSchemaValid(properties),
      properties,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error contacting Notion";
    return {
      accessible: false,
      databaseName: null,
      schemaValid: null,
      properties: unreachableProperties(type),
      error: message,
    };
  }
}

/**
 * Checks every configured NOTION_DATABASE_* id: can the integration read it,
 * and does its schema match what the app expects? Read-only - never calls
 * dataSources.query (which would read row data) or any create/update/
 * archive endpoint. Safe to call regardless of NOTION_SYNC_ENABLED.
 */
export async function verifyNotionDatabases(): Promise<ReadOnlyMappingReport> {
  const config = getNotionConfig();
  const notion = getNotionClient();
  const apiKeyConfigured = Boolean(config.apiKey);

  const databases: DatabaseVerification[] = [];

  for (const type of Object.keys(NOTION_PROPERTY_REQUIREMENTS) as SyncEntityType[]) {
    const { envVar, label } = NOTION_DATABASE_ENV_VARS[type];
    const databaseId = databaseIdFor(type, config);

    if (!notion || !databaseId) {
      databases.push({
        type,
        label,
        envVar,
        databaseId,
        configured: Boolean(databaseId),
        accessible: null,
        databaseName: null,
        schemaValid: null,
        properties: unreachableProperties(type),
        error: !notion ? "NOTION_API_KEY is not set." : `${envVar} is not set.`,
      });
      continue;
    }

    const result = await verifyOne(type, notion, databaseId);
    databases.push({ type, label, envVar, databaseId, configured: true, ...result });
  }

  return {
    apiKeyConfigured,
    ready: isMappingReady(
      apiKeyConfigured,
      databases.map((d) => ({
        configured: d.configured,
        accessible: d.accessible,
        schemaValid: d.schemaValid,
      })),
    ),
    databases,
  };
}
