export const SUPERSEDED_MIGRATION_KEY_PREFIX = "afp-history-v2-superseded-" as const;
export const QUARANTINE_BADGE_LABEL = "Superseded / Do Not Bill" as const;
export const QUARANTINE_DIAGNOSTIC_REASON = "Excluded because it is superseded" as const;

export interface MigrationKeyCarrier {
  externalId?: string | null;
  migrationKey?: string | null;
}

export function resolveMigrationKey(value: string | MigrationKeyCarrier | null | undefined): string | null {
  if (typeof value === "string") return value;
  if (!value) return null;
  return value.migrationKey ?? value.externalId ?? null;
}

export function isSupersededMigrationKey(value: string | MigrationKeyCarrier | null | undefined): boolean {
  const migrationKey = resolveMigrationKey(value);
  return typeof migrationKey === "string" && migrationKey.startsWith(SUPERSEDED_MIGRATION_KEY_PREFIX);
}

export function isQuarantinedRecord(value: MigrationKeyCarrier | string | null | undefined): boolean {
  return isSupersededMigrationKey(value);
}

