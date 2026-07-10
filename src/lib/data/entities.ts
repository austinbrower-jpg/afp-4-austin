import type { BaseEntity } from "@/types/domain";

export function newEntityBase(prefix: string, timestamp = new Date().toISOString()): BaseEntity {
  return {
    id: `${prefix}_${crypto.randomUUID()}`,
    notionPageId: null,
    notionDatabaseId: null,
    notionUrl: null,
    syncStatus: "local-only",
    lastSyncedAt: null,
    notionLastEditedTime: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
