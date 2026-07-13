/**
 * Quarantine / superseded row detection for Hours Worked records.
 * Pure logic — no Notion writes.
 */

export const SUPERSEDED_MIGRATION_KEY_PREFIX = "afp-history-v2-superseded-";

export type HoursBillingStatus =
  | "draft"
  | "reviewed"
  | "ready-to-invoice"
  | "invoiced"
  | "paid"
  | "superseded";

export interface SupersededCheckInput {
  migrationKey?: string | null;
  externalId?: string | null;
  billingStatus?: HoursBillingStatus | string | null;
}

/** Migration key stored in Migration Key or externalId field. */
export function resolveMigrationKey(input: SupersededCheckInput): string | null {
  const key = (input.migrationKey ?? input.externalId ?? "").trim();
  return key || null;
}

export function isSupersededMigrationKey(key: string | null | undefined): boolean {
  if (!key) return false;
  return key.startsWith(SUPERSEDED_MIGRATION_KEY_PREFIX);
}

export function isSupersededBillingStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  const normalized = status.toLowerCase().replace(/\s+/g, "-");
  return normalized === "superseded";
}

/** A row is superseded when its migration key prefix matches or Billing Status is Superseded. */
export function isSupersededHours(input: SupersededCheckInput): boolean {
  const key = resolveMigrationKey(input);
  return isSupersededMigrationKey(key) || isSupersededBillingStatus(input.billingStatus ?? null);
}

export const SUPERSEDED_DIAGNOSTIC_LABEL = "Superseded historical record";

export function supersededDiagnosticReason(input: SupersededCheckInput): string | null {
  if (!isSupersededHours(input)) return null;
  const key = resolveMigrationKey(input);
  if (isSupersededMigrationKey(key)) {
    return `${SUPERSEDED_DIAGNOSTIC_LABEL} (migration key: ${key})`;
  }
  return `${SUPERSEDED_DIAGNOSTIC_LABEL} (Billing Status: Superseded)`;
}
