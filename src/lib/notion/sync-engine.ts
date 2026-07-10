import "server-only";
import { getNotionClient } from "./client";
import { getNotionConfig, isNotionConfigured, databaseIdFor } from "./config";
import type { SyncLogEntry } from "@/types/domain";
import { newId, nowISO } from "@/lib/db/repository";
import { clientRepo } from "@/lib/db/repositories/clients";
import { projectRepo } from "@/lib/db/repositories/projects";
import { hoursRepo } from "@/lib/db/repositories/hours";
import { workLogRepo } from "@/lib/db/repositories/worklogs";
import { knowledgeRepo } from "@/lib/db/repositories/knowledge";
import { invoiceRepo } from "@/lib/db/repositories/invoices";
import { workspaceRepo } from "@/lib/db/repositories/workspaces";
import {
  enqueueSync,
  listQueue,
  dequeue,
  markQueueError,
  startSyncLog,
  finishSyncLog,
  recordConflict,
  listOpenConflicts,
  latestSyncLog,
} from "@/lib/db/repositories/sync";
import {
  clientToNotionProperties,
  clientFromNotionProperties,
  projectToNotionProperties,
  projectFromNotionProperties,
  hoursToNotionProperties,
  hoursFromNotionProperties,
  worklogToNotionProperties,
  worklogFromNotionProperties,
  knowledgeToNotionProperties,
  knowledgeFromNotionProperties,
  invoiceToNotionProperties,
  invoiceFromNotionProperties,
} from "./mappers";

const ADAPTERS = {
  client: {
    repo: clientRepo,
    toProps: clientToNotionProperties,
    fromProps: clientFromNotionProperties,
  },
  project: {
    repo: projectRepo,
    toProps: projectToNotionProperties,
    fromProps: projectFromNotionProperties,
  },
  hours: {
    repo: hoursRepo,
    toProps: hoursToNotionProperties,
    fromProps: hoursFromNotionProperties,
  },
  worklog: {
    repo: workLogRepo,
    toProps: worklogToNotionProperties,
    fromProps: worklogFromNotionProperties,
  },
  knowledge: {
    repo: knowledgeRepo,
    toProps: knowledgeToNotionProperties,
    fromProps: knowledgeFromNotionProperties,
  },
  invoice: {
    repo: invoiceRepo,
    toProps: invoiceToNotionProperties,
    fromProps: invoiceFromNotionProperties,
  },
} as const;

export type SyncableEntityType = keyof typeof ADAPTERS;

function getDefaultScope() {
  const workspace = workspaceRepo.all()[0];
  const client = clientRepo.all()[0];
  return { workspaceId: workspace?.id ?? "", clientId: client?.id ?? "" };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildDefaultEntity(type: SyncableEntityType): any {
  const { workspaceId, clientId } = getDefaultScope();
  const now = nowISO();
  const today = now.slice(0, 10);
  const common = { id: newId(type.slice(0, 3)), createdAt: now, updatedAt: now };
  switch (type) {
    case "client":
      return {
        ...common,
        workspaceId,
        name: "",
        color: "#6366f1",
        status: "active",
        defaultHourlyRate: 0,
        timezone: "America/New_York",
        notes: "",
      };
    case "project":
      return {
        ...common,
        workspaceId,
        clientId,
        name: "",
        description: "",
        status: "active",
        priority: "medium",
        color: "#6366f1",
        tags: [],
        notes: "",
      };
    case "hours":
      return {
        ...common,
        workspaceId,
        clientId,
        projectId: null,
        date: today,
        startTime: "09:00",
        endTime: "17:00",
        breakMinutes: 0,
        totalHours: 0,
        hourlyRate: 0,
        billable: true,
        location: "",
        relatedWorkLogId: null,
        notes: "",
        source: "manual",
      };
    case "worklog":
      return {
        ...common,
        workspaceId,
        clientId,
        projectId: null,
        title: "",
        date: today,
        summary: "",
        detailedNotes: "",
        invoiceDescription: "",
        status: "not-started",
        priority: "medium",
        relatedHoursIds: [],
        relatedKnowledgeIds: [],
        evidence: [],
        githubLink: null,
        attachments: [],
      };
    case "knowledge":
      return {
        ...common,
        workspaceId,
        clientId,
        projectId: null,
        type: "notes",
        title: "",
        content: "",
        tags: [],
        parentId: null,
        backlinkIds: [],
      };
    case "invoice":
      return {
        ...common,
        workspaceId,
        clientId,
        invoiceNumber: "",
        periodStart: today,
        periodEnd: today,
        hourlyRate: 0,
        totalHours: 0,
        totalAmount: 0,
        summary: "",
        lineItems: [],
        hoursEntryIds: [],
        status: "draft",
      };
  }
}

export interface PushResult {
  ok: boolean;
  error?: string;
}

/** Creates or updates the Notion page for a local entity. */
export async function pushEntity(
  type: SyncableEntityType,
  id: string,
): Promise<PushResult> {
  const notion = getNotionClient();
  if (!notion) return { ok: false, error: "Notion is not configured" };
  if (!getNotionConfig().syncEnabled) {
    return { ok: false, error: "Notion write sync is disabled (set NOTION_SYNC_ENABLED=true to enable)." };
  }

  const adapter = ADAPTERS[type];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entity = adapter.repo.findById(id) as any;
  if (!entity) return { ok: false, error: "Entity not found locally" };

  const databaseId = databaseIdFor(type);
  if (!databaseId) return { ok: false, error: `No Notion database configured for "${type}"` };

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const properties = (adapter.toProps as (e: any) => any)(entity);
    const page = entity.notionPageId
      ? await notion.pages.update({ page_id: entity.notionPageId, properties })
      : await notion.pages.create({ parent: { database_id: databaseId }, properties });

    const lastEditedTime =
      "last_edited_time" in page ? (page.last_edited_time as string) : nowISO();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adapter.repo.update as any)(id, {
      ...entity,
      notionPageId: page.id,
      notionDatabaseId: databaseId,
      syncStatus: "synced",
      lastSyncedAt: nowISO(),
      notionLastEditedTime: lastEditedTime,
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error pushing to Notion";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adapter.repo.update as any)(id, { ...entity, syncStatus: "error" });
    return { ok: false, error: message };
  }
}

export interface PullResult {
  ok: boolean;
  pulled: number;
  conflicts: number;
  error?: string;
}

/** Pulls every page in the configured database for `type` into the local cache. */
export async function pullDatabase(type: SyncableEntityType): Promise<PullResult> {
  const notion = getNotionClient();
  if (!notion) return { ok: false, pulled: 0, conflicts: 0, error: "Notion is not configured" };
  if (!getNotionConfig().syncEnabled) {
    return {
      ok: false,
      pulled: 0,
      conflicts: 0,
      error: "Notion write sync is disabled (set NOTION_SYNC_ENABLED=true to enable).",
    };
  }

  const adapter = ADAPTERS[type];
  const databaseId = databaseIdFor(type);
  if (!databaseId) {
    return { ok: false, pulled: 0, conflicts: 0, error: `No Notion database configured for "${type}"` };
  }

  let pulled = 0;
  let conflicts = 0;
  let cursor: string | undefined;

  try {
    // Notion API 2025-09+ queries data sources, not databases directly - a
    // database can have multiple data sources, so resolve the first one.
    const database = await notion.databases.retrieve({ database_id: databaseId });
    const dataSourceId =
      "data_sources" in database ? database.data_sources[0]?.id : undefined;
    if (!dataSourceId) {
      return {
        ok: false,
        pulled: 0,
        conflicts: 0,
        error: `Database "${databaseId}" has no queryable data source`,
      };
    }

    do {
      const res = await notion.dataSources.query({
        data_source_id: dataSourceId,
        start_cursor: cursor,
      });

      for (const page of res.results) {
        if (page.object !== "page" || !("properties" in page) || !("last_edited_time" in page)) {
          continue;
        }
        const notionLastEdited = page.last_edited_time;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const local = adapter.repo.findByNotionPageId(page.id) as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const parsed = (adapter.fromProps as (p: any) => any)(page.properties);

        if (!local) {
          const base = buildDefaultEntity(type);
          const entity = {
            ...base,
            ...parsed,
            notionPageId: page.id,
            notionDatabaseId: databaseId,
            syncStatus: "synced",
            lastSyncedAt: nowISO(),
            notionLastEditedTime: notionLastEdited,
          };
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (adapter.repo.insert as any)(entity);
          pulled++;
          continue;
        }

        const localChangedSinceSync =
          !local.lastSyncedAt || local.updatedAt > local.lastSyncedAt;
        const notionChangedSinceSync = local.notionLastEditedTime !== notionLastEdited;

        if (localChangedSinceSync && notionChangedSinceSync) {
          recordConflict({
            entityType: type,
            entityId: local.id,
            localUpdatedAt: local.updatedAt,
            notionUpdatedAt: notionLastEdited,
            localSnapshot: local,
            notionSnapshot: parsed,
          });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (adapter.repo.update as any)(local.id, { ...local, syncStatus: "conflict" });
          conflicts++;
          continue;
        }

        if (notionChangedSinceSync) {
          const merged = {
            ...local,
            ...parsed,
            notionLastEditedTime: notionLastEdited,
            lastSyncedAt: nowISO(),
            syncStatus: "synced",
          };
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (adapter.repo.update as any)(local.id, merged);
          pulled++;
        }
      }

      cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
    } while (cursor);

    return { ok: true, pulled, conflicts };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error pulling from Notion";
    return { ok: false, pulled, conflicts, error: message };
  }
}

/**
 * Queues a push for `id` and, if Notion is configured, pushes immediately
 * (spec: "When a local edit occurs, push to Notion immediately"). Safe to
 * call unconditionally from route handlers after every local write - it
 * degrades to "stays queued, local-only" when Notion isn't configured.
 */
export async function syncEntityNow(
  type: SyncableEntityType,
  id: string,
): Promise<void> {
  const queued = enqueueSync(type, id, "push");
  if (!isNotionConfigured()) return;

  const result = await pushEntity(type, id);
  if (result.ok) {
    dequeue(queued.id);
  } else if (result.error) {
    markQueueError(queued.id, result.error);
  }
}

export async function runFullSync(trigger: SyncLogEntry["trigger"]) {
  const log = startSyncLog("both", trigger);

  if (!isNotionConfigured()) {
    finishSyncLog(log.id, {
      message: "Notion is not configured - set NOTION_API_KEY to enable sync.",
    });
    return { ...log, configured: false };
  }

  if (!getNotionConfig().syncEnabled) {
    finishSyncLog(log.id, {
      message:
        'Notion sync is disabled (NOTION_SYNC_ENABLED is not "true"). Configured database ids are used only for the read-only schema check in Settings - see docs/notion-migration-plan.md before enabling real sync.',
    });
    return { ...log, configured: true };
  }

  let entitiesSynced = 0;
  let conflictCount = 0;
  let errorCount = 0;
  const messages: string[] = [];

  // Pull first so a stale local push doesn't clobber a fresh Notion edit.
  for (const type of Object.keys(ADAPTERS) as SyncableEntityType[]) {
    if (!databaseIdFor(type)) continue;
    const res = await pullDatabase(type);
    if (!res.ok) {
      errorCount++;
      messages.push(`${type} pull: ${res.error}`);
      continue;
    }
    entitiesSynced += res.pulled;
    conflictCount += res.conflicts;
  }

  // Flush queued local edits.
  for (const item of listQueue()) {
    if (item.operation !== "push") continue;
    const res = await pushEntity(item.entityType as SyncableEntityType, item.entityId);
    if (res.ok) {
      dequeue(item.id);
      entitiesSynced++;
    } else {
      markQueueError(item.id, res.error ?? "Unknown error");
      errorCount++;
      messages.push(`${item.entityType} push: ${res.error}`);
    }
  }

  finishSyncLog(log.id, {
    entitiesSynced,
    conflicts: conflictCount,
    errors: errorCount,
    message: errorCount
      ? `Completed with ${errorCount} error(s): ${messages.join("; ")}`
      : conflictCount
        ? `Completed with ${conflictCount} conflict(s) needing review`
        : "Sync completed",
  });

  return { ...log, configured: true };
}

export function getSyncStatusSummary() {
  const config = getNotionConfig();
  const configured = isNotionConfigured();
  const configuredDatabases = Object.entries(config.databases)
    .filter(([, v]) => Boolean(v))
    .map(([k]) => k);

  return {
    configured,
    syncEnabled: config.syncEnabled,
    configuredDatabases,
    missingDatabases: (Object.keys(ADAPTERS) as SyncableEntityType[]).filter(
      (t) => !databaseIdFor(t, config),
    ),
    lastSync: latestSyncLog(),
    queueLength: listQueue().length,
    openConflicts: listOpenConflicts().length,
    syncIntervalMinutes: config.syncIntervalMinutes,
  };
}
