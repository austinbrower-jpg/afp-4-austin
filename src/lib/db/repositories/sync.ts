import "server-only";
import { getDb } from "../client";
import { newId, nowISO, RepoRow, toJSON, fromJSON } from "../repository";
import type {
  SyncConflict,
  SyncEntityType,
  SyncLogEntry,
  SyncQueueItem,
} from "@/types/domain";

// ---------------------------------------------------------------------------
// Sync queue
// ---------------------------------------------------------------------------

function queueFromRow(row: RepoRow): SyncQueueItem {
  return {
    id: row.id as string,
    entityType: row.entity_type as SyncEntityType,
    entityId: row.entity_id as string,
    operation: row.operation as SyncQueueItem["operation"],
    attempts: row.attempts as number,
    lastError: (row.last_error as string) ?? null,
    createdAt: row.created_at as string,
  };
}

export function enqueueSync(
  entityType: SyncEntityType,
  entityId: string,
  operation: "push" | "pull",
): SyncQueueItem {
  const db = getDb();
  const existing = db
    .prepare(
      `SELECT * FROM sync_queue WHERE entity_type = ? AND entity_id = ? AND operation = ?`,
    )
    .get(entityType, entityId, operation) as RepoRow | undefined;
  if (existing) return queueFromRow(existing);

  const item: SyncQueueItem = {
    id: newId("sq"),
    entityType,
    entityId,
    operation,
    attempts: 0,
    lastError: null,
    createdAt: nowISO(),
  };
  db.prepare(
    `INSERT INTO sync_queue (id, entity_type, entity_id, operation, attempts, last_error, created_at)
     VALUES (@id, @entityType, @entityId, @operation, @attempts, @lastError, @createdAt)`,
  ).run({
    id: item.id,
    entityType: item.entityType,
    entityId: item.entityId,
    operation: item.operation,
    attempts: item.attempts,
    lastError: item.lastError,
    createdAt: item.createdAt,
  });
  return item;
}

export function listQueue(): SyncQueueItem[] {
  const rows = getDb()
    .prepare(`SELECT * FROM sync_queue ORDER BY created_at ASC`)
    .all() as RepoRow[];
  return rows.map(queueFromRow);
}

export function dequeue(id: string): void {
  getDb().prepare(`DELETE FROM sync_queue WHERE id = ?`).run(id);
}

export function markQueueError(id: string, error: string): void {
  getDb()
    .prepare(
      `UPDATE sync_queue SET attempts = attempts + 1, last_error = ? WHERE id = ?`,
    )
    .run(error, id);
}

// ---------------------------------------------------------------------------
// Sync log
// ---------------------------------------------------------------------------

function logFromRow(row: RepoRow): SyncLogEntry {
  return {
    id: row.id as string,
    startedAt: row.started_at as string,
    finishedAt: (row.finished_at as string) ?? null,
    direction: row.direction as SyncLogEntry["direction"],
    trigger: row.trigger_source as SyncLogEntry["trigger"],
    entitiesSynced: row.entities_synced as number,
    conflicts: row.conflicts as number,
    errors: row.errors as number,
    message: row.message as string,
  };
}

export function startSyncLog(
  direction: SyncLogEntry["direction"],
  trigger: SyncLogEntry["trigger"],
): SyncLogEntry {
  const entry: SyncLogEntry = {
    id: newId("sl"),
    startedAt: nowISO(),
    finishedAt: null,
    direction,
    trigger,
    entitiesSynced: 0,
    conflicts: 0,
    errors: 0,
    message: "Sync started",
  };
  getDb()
    .prepare(
      `INSERT INTO sync_log (id, started_at, finished_at, direction, trigger_source, entities_synced, conflicts, errors, message)
       VALUES (@id, @startedAt, @finishedAt, @direction, @trigger, @entitiesSynced, @conflicts, @errors, @message)`,
    )
    .run({ ...entry, trigger: entry.trigger });
  return entry;
}

export function finishSyncLog(
  id: string,
  updates: Partial<
    Pick<SyncLogEntry, "entitiesSynced" | "conflicts" | "errors" | "message">
  >,
): void {
  const current = getDb()
    .prepare(`SELECT * FROM sync_log WHERE id = ?`)
    .get(id) as RepoRow | undefined;
  if (!current) return;
  const merged = { ...logFromRow(current), ...updates, finishedAt: nowISO() };
  getDb()
    .prepare(
      `UPDATE sync_log SET finished_at = @finishedAt, entities_synced = @entitiesSynced,
        conflicts = @conflicts, errors = @errors, message = @message WHERE id = @id`,
    )
    .run({
      id,
      finishedAt: merged.finishedAt,
      entitiesSynced: merged.entitiesSynced,
      conflicts: merged.conflicts,
      errors: merged.errors,
      message: merged.message,
    });
}

export function listRecentSyncLogs(limit = 20): SyncLogEntry[] {
  const rows = getDb()
    .prepare(`SELECT * FROM sync_log ORDER BY started_at DESC LIMIT ?`)
    .all(limit) as RepoRow[];
  return rows.map(logFromRow);
}

export function latestSyncLog(): SyncLogEntry | null {
  const rows = listRecentSyncLogs(1);
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Conflicts
// ---------------------------------------------------------------------------

function conflictFromRow(row: RepoRow): SyncConflict {
  return {
    id: row.id as string,
    entityType: row.entity_type as SyncEntityType,
    entityId: row.entity_id as string,
    localUpdatedAt: row.local_updated_at as string,
    notionUpdatedAt: row.notion_updated_at as string,
    localSnapshot: fromJSON(row.local_snapshot, null),
    notionSnapshot: fromJSON(row.notion_snapshot, null),
    detectedAt: row.detected_at as string,
    resolvedAt: (row.resolved_at as string) ?? null,
    resolution: (row.resolution as SyncConflict["resolution"]) ?? null,
  };
}

export function recordConflict(
  input: Omit<SyncConflict, "id" | "detectedAt" | "resolvedAt" | "resolution">,
): SyncConflict {
  const conflict: SyncConflict = {
    ...input,
    id: newId("sc"),
    detectedAt: nowISO(),
    resolvedAt: null,
    resolution: null,
  };
  getDb()
    .prepare(
      `INSERT INTO sync_conflicts (id, entity_type, entity_id, local_updated_at, notion_updated_at, local_snapshot, notion_snapshot, detected_at, resolved_at, resolution)
       VALUES (@id, @entityType, @entityId, @localUpdatedAt, @notionUpdatedAt, @localSnapshot, @notionSnapshot, @detectedAt, @resolvedAt, @resolution)`,
    )
    .run({
      id: conflict.id,
      entityType: conflict.entityType,
      entityId: conflict.entityId,
      localUpdatedAt: conflict.localUpdatedAt,
      notionUpdatedAt: conflict.notionUpdatedAt,
      localSnapshot: toJSON(conflict.localSnapshot),
      notionSnapshot: toJSON(conflict.notionSnapshot),
      detectedAt: conflict.detectedAt,
      resolvedAt: conflict.resolvedAt,
      resolution: conflict.resolution,
    });
  return conflict;
}

export function listOpenConflicts(): SyncConflict[] {
  const rows = getDb()
    .prepare(`SELECT * FROM sync_conflicts WHERE resolved_at IS NULL ORDER BY detected_at DESC`)
    .all() as RepoRow[];
  return rows.map(conflictFromRow);
}

export function resolveConflict(
  id: string,
  resolution: NonNullable<SyncConflict["resolution"]>,
): void {
  getDb()
    .prepare(
      `UPDATE sync_conflicts SET resolved_at = ?, resolution = ? WHERE id = ?`,
    )
    .run(nowISO(), resolution, id);
}
