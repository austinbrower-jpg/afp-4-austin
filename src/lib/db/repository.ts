import "server-only";
import { nanoid } from "nanoid";
import { getDb } from "./client";
import type { Syncable } from "@/types/domain";

export type RepoRow = Record<string, unknown>;

export interface RepositoryConfig<T extends { id: string }> {
  table: string;
  /** snake_case columns, in the exact order INSERT/UPDATE bind params by. */
  columns: string[];
  toRow: (entity: T) => RepoRow;
  fromRow: (row: RepoRow) => T;
}

export function createRepository<T extends { id: string }>(
  config: RepositoryConfig<T>,
) {
  const { table, columns, toRow, fromRow } = config;
  const db = () => getDb();

  function all(orderBy = "updated_at DESC"): T[] {
    const rows = db()
      .prepare(`SELECT * FROM ${table} ORDER BY ${orderBy}`)
      .all() as RepoRow[];
    return rows.map(fromRow);
  }

  function findById(id: string): T | null {
    const row = db()
      .prepare(`SELECT * FROM ${table} WHERE id = ?`)
      .get(id) as RepoRow | undefined;
    return row ? fromRow(row) : null;
  }

  function where(
    clause: string,
    params: unknown[] = [],
    orderBy = "updated_at DESC",
  ): T[] {
    const rows = db()
      .prepare(`SELECT * FROM ${table} WHERE ${clause} ORDER BY ${orderBy}`)
      .all(...params) as RepoRow[];
    return rows.map(fromRow);
  }

  function insert(entity: T): T {
    const row = toRow(entity);
    const placeholders = columns.map((c) => `@${c}`).join(", ");
    db()
      .prepare(`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`)
      .run(row);
    return entity;
  }

  function update(id: string, entity: T): T {
    const row = toRow(entity);
    const setCols = columns.filter((c) => c !== "id");
    const setClause = setCols.map((c) => `${c} = @${c}`).join(", ");
    db()
      .prepare(`UPDATE ${table} SET ${setClause} WHERE id = @id`)
      .run(row);
    return entity;
  }

  function remove(id: string): void {
    db().prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
  }

  function count(): number {
    const row = db().prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as {
      c: number;
    };
    return row.c;
  }

  function findByNotionPageId(notionPageId: string): T | null {
    const row = db()
      .prepare(`SELECT * FROM ${table} WHERE notion_page_id = ?`)
      .get(notionPageId) as RepoRow | undefined;
    return row ? fromRow(row) : null;
  }

  return {
    table,
    all,
    findById,
    where,
    insert,
    update,
    remove,
    count,
    findByNotionPageId,
  };
}

export function newId(prefix: string): string {
  return `${prefix}_${nanoid(12)}`;
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function toJSON(value: unknown): string {
  return JSON.stringify(value ?? []);
}

export function fromJSON<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function toBool(value: unknown): boolean {
  return value === 1 || value === true;
}

export function toInt(value: boolean): number {
  return value ? 1 : 0;
}

/** Columns/mapping shared by every syncable entity; splice into each repository. */
export const SYNC_COLUMNS = [
  "notion_page_id",
  "notion_database_id",
  "sync_status",
  "last_synced_at",
  "notion_last_edited_time",
] as const;

export function syncToRow(e: Syncable): RepoRow {
  return {
    notion_page_id: e.notionPageId,
    notion_database_id: e.notionDatabaseId,
    sync_status: e.syncStatus,
    last_synced_at: e.lastSyncedAt,
    notion_last_edited_time: e.notionLastEditedTime,
  };
}

export function syncFromRow(row: RepoRow): Syncable {
  return {
    notionPageId: (row.notion_page_id as string) ?? null,
    notionDatabaseId: (row.notion_database_id as string) ?? null,
    syncStatus: row.sync_status as Syncable["syncStatus"],
    lastSyncedAt: (row.last_synced_at as string) ?? null,
    notionLastEditedTime: (row.notion_last_edited_time as string) ?? null,
  };
}

export function newSyncable(): Syncable {
  return {
    notionPageId: null,
    notionDatabaseId: null,
    syncStatus: "local-only",
    lastSyncedAt: null,
    notionLastEditedTime: null,
  };
}
