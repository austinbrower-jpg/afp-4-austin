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
