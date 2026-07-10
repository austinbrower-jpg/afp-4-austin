import "server-only";
import type { SyncEntityType } from "@/types/domain";

export interface NotionDatabaseMap {
  client: string | null;
  project: string | null;
  hours: string | null;
  worklog: string | null;
  knowledge: string | null;
  invoice: string | null;
}

export interface NotionConfig {
  apiKey: string | null;
  databases: NotionDatabaseMap;
  syncIntervalMinutes: number;
  /**
   * Master switch for row-level sync (push-on-edit + pull-on-startup/
   * interval/manual). Defaults to false/off - setting NOTION_API_KEY and a
   * database id only enables the read-only schema mapping check
   * (src/lib/notion/verify-databases.ts), never push or pull. This has to be
   * a separate flag from "database id is set" because Phase 3 needs real
   * database ids configured for schema verification before anyone has
   * explicitly approved a real sync (see docs/notion-migration-plan.md).
   */
  syncEnabled: boolean;
}

export function getNotionConfig(): NotionConfig {
  return {
    apiKey: process.env.NOTION_API_KEY || null,
    databases: {
      client: process.env.NOTION_DATABASE_CLIENTS || null,
      project: process.env.NOTION_DATABASE_PROJECTS || null,
      hours: process.env.NOTION_DATABASE_HOURS || null,
      worklog: process.env.NOTION_DATABASE_WORKLOGS || null,
      knowledge: process.env.NOTION_DATABASE_KNOWLEDGE || null,
      invoice: process.env.NOTION_DATABASE_INVOICES || null,
    },
    syncIntervalMinutes: Number(process.env.NOTION_SYNC_INTERVAL_MINUTES || 5),
    syncEnabled: process.env.NOTION_SYNC_ENABLED === "true",
  };
}

export function isNotionConfigured(): boolean {
  return Boolean(getNotionConfig().apiKey);
}

export function databaseIdFor(
  entityType: SyncEntityType,
  config: NotionConfig = getNotionConfig(),
): string | null {
  const map: Record<SyncEntityType, string | null> = {
    client: config.databases.client,
    project: config.databases.project,
    hours: config.databases.hours,
    worklog: config.databases.worklog,
    knowledge: config.databases.knowledge,
    invoice: config.databases.invoice,
  };
  return map[entityType];
}
