/**
 * Phase 6 one-time historical import: writes the Phase 5 dry-run's proposed
 * client/projects/hours/work-logs to live Notion, once, with duplicate
 * protection. Deliberately separate from src/lib/notion/sync-engine.ts (the
 * general push/pull engine) and does not read or depend on
 * NOTION_SYNC_ENABLED - see isSyncDisabledForImport() below for why it
 * actively *requires* that flag to stay false instead.
 *
 * Every Notion call this module makes is passed in via an injected
 * NotionWriteClient rather than constructed internally, so runPreflight()/
 * runImport() are fully unit-testable with a mock client and contain zero
 * "server-only" imports themselves - the real client (from getNotionClient()
 * in ./client.ts) is only ever constructed by the API route, which is the
 * one place this module is wired to production.
 *
 * Write surface, exhaustively: notion.dataSources.update() (additive
 * schema only) and notion.pages.create() (new pages only). No page-mutation,
 * page-relocation, or archive/delete/trash endpoint is called anywhere in
 * this file - see one-time-import.test.ts's static assertion of this.
 */
import { nanoid } from "nanoid";
import {
  MIGRATION_NAMESPACE,
  clientMigrationKey,
  hoursMigrationKey,
  projectMigrationKey,
  workLogMigrationKey,
} from "./write-keys";
import {
  MIGRATION_KEY_PROPERTY_NAME,
  NEEDS_PROJECT_RELATION,
  PROJECT_RELATION_PROPERTY_NAME,
  buildClientProperties,
  buildHoursProperties,
  buildProjectProperties,
  buildWorkLogProperties,
  hasMigrationKeyProperty,
  hasProjectRelationProperty,
  migrationKeyPropertyPatch,
  projectRelationPropertyPatch,
  type MigrationSchemaEntityType,
  type NotionPropertyLike,
} from "./write-schema";
import { buildMigrationDryRun } from "./dry-run";
import { EMPTY_SNAPSHOT, type MigrationDryRunResult, type ProjectKey } from "./types";

export const IMPORT_CONFIRMATION_PHRASE = "IMPORT AFP JULY 8-10 V2";

export function isValidConfirmationPhrase(input: unknown): boolean {
  return typeof input === "string" && input === IMPORT_CONFIRMATION_PHRASE;
}

const EXPECTED_TOTALS = {
  billableMinutes: 987,
  billableHours: 16.45,
  nonBillableMinutes: 120,
  nonBillableHours: 2,
  invoiceAmount: 493.5,
};
const EXPECTED_COUNTS = { client: 1, projects: 5, hours: 5, workLogs: 3 };

// ---------------------------------------------------------------------------
// Injected Notion client surface. Structurally compatible with the real
// @notionhq/client Client (which has more methods than this), so
// getNotionClient()'s return value is assignable here without adapting it.
// ---------------------------------------------------------------------------

export interface NotionDatabaseLike {
  data_sources?: Array<{ id: string }>;
  title?: Array<{ plain_text?: string }>;
}
export interface NotionDataSourceLike {
  properties: Record<string, NotionPropertyLike>;
}
export interface NotionPageLike {
  id: string;
  url?: string;
  properties?: Record<string, unknown>;
}
export interface NotionQueryResultLike {
  results: NotionPageLike[];
  has_more: boolean;
  next_cursor: string | null;
}

export interface NotionWriteClient {
  databases: {
    retrieve: (args: { database_id: string }) => Promise<NotionDatabaseLike>;
  };
  dataSources: {
    retrieve: (args: { data_source_id: string }) => Promise<NotionDataSourceLike>;
    update: (args: { data_source_id: string; properties: Record<string, unknown> }) => Promise<unknown>;
    query: (args: {
      data_source_id: string;
      filter?: unknown;
      start_cursor?: string;
    }) => Promise<NotionQueryResultLike>;
  };
  pages: {
    create: (args: { parent: { database_id: string }; properties: unknown }) => Promise<NotionPageLike>;
  };
}

/**
 * Narrows the real @notionhq/client Client (whose retrieve/query responses
 * are typed as unions including "partial" variants without `properties`/
 * `data_sources`, the same shape sync-engine.ts and verify-databases.ts
 * narrow with `"data_sources" in database` checks) down to the minimal
 * structural surface this module needs. The real client has strictly more
 * methods and richer response shapes than NotionWriteClient requires, so
 * this is a narrowing cast, not a fabrication - only ever called from API
 * routes (server-only), never from a test, which injects its own mock
 * satisfying NotionWriteClient directly.
 */
export function toNotionWriteClient(client: unknown): NotionWriteClient | null {
  return (client as NotionWriteClient | null) ?? null;
}

// ---------------------------------------------------------------------------
// Preflight
// ---------------------------------------------------------------------------

export interface PreflightCheck {
  code: string;
  passed: boolean;
  message: string;
}

/** Subset of verifyNotionDatabases()'s ReadOnlyMappingReport this module actually needs - kept minimal/structural so tests don't need the real type. */
export interface DatabaseMappingSummary {
  ready: boolean;
}

export interface ExistingKeyMatch {
  migrationKey: string;
  notionPageId: string;
  notionUrl: string;
}

export interface SchemaSetupStatus {
  type: MigrationSchemaEntityType;
  databaseId: string;
  dataSourceId: string | null;
  migrationKeyPropertyPresent: boolean;
  projectRelationPropertyPresent: boolean | null; // null when N/A (client/project)
}

export interface PreflightReport {
  checkedAt: string;
  checks: PreflightCheck[];
  ready: boolean;
  dryRun: MigrationDryRunResult;
  schemaSetup: SchemaSetupStatus[];
  existingByKey: ExistingKeyMatch[];
  dataSourceIds: Partial<Record<MigrationSchemaEntityType, string>>;
  databaseIds: Partial<Record<MigrationSchemaEntityType, string>>;
}

export interface PreflightInput {
  notion: NotionWriteClient | null;
  syncEnabled: boolean;
  mapping: DatabaseMappingSummary;
  databaseIds: {
    client: string | null;
    project: string | null;
    hours: string | null;
    worklog: string | null;
  };
}

function pageUrl(page: NotionPageLike): string {
  return page.url ?? `https://www.notion.so/${page.id.replace(/-/g, "")}`;
}

function extractPlainText(prop: unknown): string {
  const arr = (prop as { rich_text?: Array<{ plain_text?: string }> } | undefined)?.rich_text;
  if (!Array.isArray(arr)) return "";
  return arr.map((t) => t.plain_text ?? "").join("");
}

/**
 * All migration keys the current dry run would need to create, grouped by
 * entity type - the exact set runPreflight()/runImport() check for
 * pre-existing Notion pages against.
 */
export function allExpectedMigrationKeys(dryRun: MigrationDryRunResult): Record<MigrationSchemaEntityType, string[]> {
  return {
    client: [clientMigrationKey()],
    project: dryRun.proposedProjects.map((p) => projectMigrationKey(p.record.key)),
    hours: dryRun.proposedHours.map((h) =>
      hoursMigrationKey({
        date: h.record.date,
        startTime: h.record.startTime,
        endTime: h.record.endTime,
        billable: h.record.billable,
        projectKey: h.record.projectKey,
      }),
    ),
    worklog: dryRun.proposedWorkLogs.map((w) => workLogMigrationKey({ date: w.record.date, title: w.record.title })),
  };
}

/**
 * Hard stop for every known stale-fixture failure mode. runPreflight invokes
 * this before any live schema lookup and runImport cannot bypass preflight.
 */
export function correctedDatasetChecks(dryRun: MigrationDryRunResult): PreflightCheck[] {
  const hours = dryRun.proposedHours;
  const workLogs = dryRun.proposedWorkLogs;
  const allKeys = Object.values(allExpectedMigrationKeys(dryRun)).flat();
  const hasJuly10Hours = hours.some((row) => row.record.date === "2026-07-10");
  const hasJuly10WorkLog = workLogs.some((row) => row.record.date === "2026-07-10");
  const hasCorrectedAfternoon = hours.some(
    (row) => row.record.date === "2026-07-08" && row.record.startTime === "14:00" && row.record.endTime === "17:49",
  );
  const hasObsoleteSplit = hours.some(
    (row) => row.record.date === "2026-07-08" &&
      ((row.record.startTime === "14:05" && row.record.endTime === "17:00") ||
        (row.record.startTime === "17:10" && row.record.endTime === "17:49")),
  );
  const usesOnlyV2Namespace = allKeys.length > 0 && allKeys.every(
    (key) => key.startsWith(`${MIGRATION_NAMESPACE}-`) && !key.endsWith("-v1") && !key.includes("afp-client-v1"),
  );

  return [
    {
      code: "obsolete-311-fixture-rejected",
      passed: dryRun.totals.totalInvoiceAmount !== 311 && dryRun.totals.totalInvoiceAmount === EXPECTED_TOTALS.invoiceAmount,
      message: `Corrected invoice total must be $493.50 and must never be the obsolete $311.00 value; received $${dryRun.totals.totalInvoiceAmount.toFixed(2)}.`,
    },
    {
      code: "july-10-required",
      passed: hasJuly10Hours && hasJuly10WorkLog,
      message: "Corrected data requires both the July 10 Hours row and July 10 Work Done row.",
    },
    {
      code: "continuous-july-8-afternoon-required",
      passed: hasCorrectedAfternoon && !hasObsoleteSplit,
      message: "July 8 afternoon must be one continuous 14:00-17:49 row; obsolete split rows are forbidden.",
    },
    {
      code: "three-worklogs-required",
      passed: workLogs.length === EXPECTED_COUNTS.workLogs,
      message: `Corrected data requires exactly ${EXPECTED_COUNTS.workLogs} Work Done rows; received ${workLogs.length}.`,
    },
    {
      code: "v2-migration-namespace-required",
      passed: usesOnlyV2Namespace,
      message: `Every corrected migration key must use the ${MIGRATION_NAMESPACE} namespace; v1 keys are forbidden.`,
    },
  ];
}

async function findExistingByMigrationKeys(
  notion: NotionWriteClient,
  dataSourceId: string,
  keys: string[],
): Promise<ExistingKeyMatch[]> {
  if (keys.length === 0) return [];
  const matches: ExistingKeyMatch[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion.dataSources.query({
      data_source_id: dataSourceId,
      filter: { or: keys.map((k) => ({ property: MIGRATION_KEY_PROPERTY_NAME, rich_text: { equals: k } })) },
      start_cursor: cursor,
    });
    for (const page of res.results) {
      const text = extractPlainText(page.properties?.[MIGRATION_KEY_PROPERTY_NAME]);
      if (text && keys.includes(text)) {
        matches.push({ migrationKey: text, notionPageId: page.id, notionUrl: pageUrl(page) });
      }
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return matches;
}

/**
 * Read-only: resolves database -> data source ids, checks for the
 * Migration Key / Project relation properties, and scans for pre-existing
 * migration-key matches. Never calls dataSources.update or pages.create.
 */
export async function runPreflight(input: PreflightInput): Promise<PreflightReport> {
  const dryRun = buildMigrationDryRun(EMPTY_SNAPSHOT);
  const checks: PreflightCheck[] = [];
  const push = (code: string, passed: boolean, message: string) => checks.push({ code, passed, message });

  push("api-key-configured", input.notion !== null, "NOTION_API_KEY must be configured.");
  push(
    "billable-minutes-total",
    dryRun.totals.totalBillableMinutes === EXPECTED_TOTALS.billableMinutes,
    `Dry-run billable minutes: ${dryRun.totals.totalBillableMinutes} (expected ${EXPECTED_TOTALS.billableMinutes}).`,
  );
  push(
    "sync-disabled",
    input.syncEnabled === false,
    input.syncEnabled
      ? "NOTION_SYNC_ENABLED=true - this one-time import is intentionally scoped to run only while general live sync stays disabled, so a general push/pull can never interleave with this narrowly-scoped write. Set NOTION_SYNC_ENABLED=false and retry."
      : "NOTION_SYNC_ENABLED=false, as required.",
  );
  push(
    "non-billable-minutes-total",
    dryRun.totals.totalNonBillableMinutes === EXPECTED_TOTALS.nonBillableMinutes,
    `Dry-run non-billable minutes: ${dryRun.totals.totalNonBillableMinutes} (expected ${EXPECTED_TOTALS.nonBillableMinutes}).`,
  );
  push(
    "all-databases-ready",
    input.mapping.ready,
    input.mapping.ready
      ? "All six Notion databases are configured, accessible, and schema-valid."
      : "One or more of the six configured Notion databases is not accessible or schema-valid - run Settings > Notion Database Mapping first.",
  );
  push(
    "billable-hours-total",
    dryRun.totals.totalBillableHours === EXPECTED_TOTALS.billableHours,
    `Dry-run billable hours: ${dryRun.totals.totalBillableHours} (expected ${EXPECTED_TOTALS.billableHours}).`,
  );
  checks.push(...correctedDatasetChecks(dryRun));
  push(
    "non-billable-hours-total",
    dryRun.totals.totalNonBillableHours === EXPECTED_TOTALS.nonBillableHours,
    `Dry-run non-billable hours: ${dryRun.totals.totalNonBillableHours} (expected ${EXPECTED_TOTALS.nonBillableHours}).`,
  );
  push(
    "invoice-amount-total",
    dryRun.totals.totalInvoiceAmount === EXPECTED_TOTALS.invoiceAmount,
    `Dry-run invoice amount: $${dryRun.totals.totalInvoiceAmount} (expected $${EXPECTED_TOTALS.invoiceAmount}).`,
  );
  push("client-count", 1 === EXPECTED_COUNTS.client, "1 proposed client, as expected.");
  push(
    "project-count",
    dryRun.proposedProjects.length === EXPECTED_COUNTS.projects,
    `Dry-run proposed projects: ${dryRun.proposedProjects.length} (expected ${EXPECTED_COUNTS.projects}).`,
  );
  push(
    "hours-count",
    dryRun.proposedHours.length === EXPECTED_COUNTS.hours,
    `Dry-run proposed hours rows: ${dryRun.proposedHours.length} (expected ${EXPECTED_COUNTS.hours}).`,
  );
  push(
    "worklog-count",
    dryRun.proposedWorkLogs.length === EXPECTED_COUNTS.workLogs,
    `Dry-run proposed work logs: ${dryRun.proposedWorkLogs.length} (expected ${EXPECTED_COUNTS.workLogs}).`,
  );

  const readySoFar = checks.every((c) => c.passed);

  const schemaSetup: SchemaSetupStatus[] = [];
  const existingByKey: ExistingKeyMatch[] = [];
  const dataSourceIds: Partial<Record<MigrationSchemaEntityType, string>> = {};
  const databaseIds: Partial<Record<MigrationSchemaEntityType, string>> = {};

  if (input.notion && readySoFar) {
    const notion = input.notion;
    const entities: MigrationSchemaEntityType[] = ["client", "project", "hours", "worklog"];
    const expectedKeys = allExpectedMigrationKeys(dryRun);

    try {
      for (const type of entities) {
        const databaseId = input.databaseIds[type];
        if (!databaseId) {
          push(`database-resolved-${type}`, false, `No database id configured for "${type}".`);
          continue;
        }
        databaseIds[type] = databaseId;
        const database = await notion.databases.retrieve({ database_id: databaseId });
        const dataSourceId = database.data_sources?.[0]?.id;
        if (!dataSourceId) {
          push(`database-resolved-${type}`, false, `Database "${databaseId}" has no queryable data source.`);
          continue;
        }
        dataSourceIds[type] = dataSourceId;

        const dataSource = await notion.dataSources.retrieve({ data_source_id: dataSourceId });
        const migrationKeyPresent = hasMigrationKeyProperty(dataSource.properties);
        const projectRelationPresent = NEEDS_PROJECT_RELATION[type]
          ? hasProjectRelationProperty(dataSource.properties)
          : null;
        schemaSetup.push({
          type,
          databaseId,
          dataSourceId,
          migrationKeyPropertyPresent: migrationKeyPresent,
          projectRelationPropertyPresent: projectRelationPresent,
        });

        if (migrationKeyPresent) {
          const matches = await findExistingByMigrationKeys(notion, dataSourceId, expectedKeys[type]);
          existingByKey.push(...matches);
        }
      }
    } catch (err) {
      push("live-schema-check", false, err instanceof Error ? err.message : "Unknown error checking Notion schema.");
    }
  }

  return {
    checkedAt: new Date().toISOString(),
    checks,
    ready: checks.every((c) => c.passed),
    dryRun,
    schemaSetup,
    existingByKey,
    dataSourceIds,
    databaseIds,
  };
}

// ---------------------------------------------------------------------------
// Import (write path)
// ---------------------------------------------------------------------------

export type RecordType = MigrationSchemaEntityType;

export interface CreatedRecord {
  type: RecordType;
  syntheticId: string;
  migrationKey: string;
  notionPageId: string;
  notionUrl: string;
}
export interface SkippedRecord {
  type: RecordType;
  syntheticId: string;
  migrationKey: string;
  notionPageId: string;
  notionUrl: string;
  reason: "duplicate-migration-key";
}
export interface FailedRecord {
  type: RecordType;
  syntheticId: string;
  migrationKey: string;
  error: string;
}

export interface ImportResult {
  runId: string;
  startedAt: string;
  finishedAt: string;
  ok: boolean;
  confirmationAccepted: boolean;
  confirmationError?: string;
  preflight: PreflightReport | null;
  schemaChangesApplied: Array<{ type: RecordType; property: string }>;
  created: CreatedRecord[];
  skipped: SkippedRecord[];
  failed: FailedRecord[];
  stoppedEarly: boolean;
  notionWritesPerformed: boolean;
  totals: MigrationDryRunResult["totals"] | null;
}

function emptyResult(runId: string, startedAt: string, overrides: Partial<ImportResult>): ImportResult {
  return {
    runId,
    startedAt,
    finishedAt: new Date().toISOString(),
    ok: false,
    confirmationAccepted: false,
    preflight: null,
    schemaChangesApplied: [],
    created: [],
    skipped: [],
    failed: [],
    stoppedEarly: false,
    notionWritesPerformed: false,
    totals: null,
    ...overrides,
  };
}

/**
 * Additive-only, idempotent: adds the Migration Key property (and, for
 * hours/worklog, the Project relation property) wherever runPreflight()
 * reported it missing. Never removes or renames a property, never touches
 * an existing row. Safe to call on every run - a no-op once the schema is
 * already in place.
 */
export async function applySchemaSetup(
  notion: NotionWriteClient,
  preflight: PreflightReport,
): Promise<Array<{ type: RecordType; property: string }>> {
  const applied: Array<{ type: RecordType; property: string }> = [];
  const projectsDataSourceId = preflight.dataSourceIds.project;

  for (const status of preflight.schemaSetup) {
    if (!status.migrationKeyPropertyPresent) {
      await notion.dataSources.update({
        data_source_id: status.dataSourceId as string,
        properties: migrationKeyPropertyPatch(),
      });
      applied.push({ type: status.type, property: MIGRATION_KEY_PROPERTY_NAME });
    }
    if (
      NEEDS_PROJECT_RELATION[status.type] &&
      status.projectRelationPropertyPresent === false &&
      projectsDataSourceId
    ) {
      await notion.dataSources.update({
        data_source_id: status.dataSourceId as string,
        properties: projectRelationPropertyPatch(projectsDataSourceId),
      });
      applied.push({ type: status.type, property: PROJECT_RELATION_PROPERTY_NAME });
    }
  }
  return applied;
}

export interface RunImportInput {
  notion: NotionWriteClient | null;
  confirmationPhrase: unknown;
  syncEnabled: boolean;
  mapping: DatabaseMappingSummary;
  databaseIds: PreflightInput["databaseIds"];
}

/**
 * The one write entry point for this entire migration. Order:
 * confirmation phrase -> full preflight re-run -> additive schema setup ->
 * client -> projects -> hours -> work logs. Stops entirely on the first
 * failed pages.create call (no partial-step retries); already-created
 * records from this or a prior run are detected via their migration key
 * and skipped, so a rerun after a partial failure is safe.
 */
export async function runImport(input: RunImportInput): Promise<ImportResult> {
  const runId = `mig_${nanoid(10)}`;
  const startedAt = new Date().toISOString();

  if (!isValidConfirmationPhrase(input.confirmationPhrase)) {
    return emptyResult(runId, startedAt, {
      confirmationAccepted: false,
      confirmationError: `Confirmation phrase missing or incorrect. Expected exactly "${IMPORT_CONFIRMATION_PHRASE}".`,
    });
  }

  const preflight = await runPreflight({
    notion: input.notion,
    syncEnabled: input.syncEnabled,
    mapping: input.mapping,
    databaseIds: input.databaseIds,
  });

  if (!preflight.ready || !input.notion) {
    return emptyResult(runId, startedAt, {
      confirmationAccepted: true,
      preflight,
      totals: preflight.dryRun.totals,
    });
  }
  const notion = input.notion;

  let schemaChangesApplied: Array<{ type: RecordType; property: string }> = [];
  try {
    schemaChangesApplied = await applySchemaSetup(notion, preflight);
  } catch (err) {
    return emptyResult(runId, startedAt, {
      confirmationAccepted: true,
      preflight,
      totals: preflight.dryRun.totals,
      failed: [
        {
          type: "client",
          syntheticId: "schema-setup",
          migrationKey: "-",
          error: err instanceof Error ? err.message : "Unknown error applying additive schema changes.",
        },
      ],
      stoppedEarly: true,
    });
  }

  const existingByKey = new Map(preflight.existingByKey.map((m) => [m.migrationKey, m]));
  const dryRun = preflight.dryRun;
  const created: CreatedRecord[] = [];
  const skipped: SkippedRecord[] = [];
  const failed: FailedRecord[] = [];
  let stoppedEarly = false;

  const databaseId = (type: RecordType) => preflight.databaseIds[type] as string;

  // 1. Client (created first; nothing downstream relates to it by page id
  // today - hours/work logs only relate to Project - so its page id isn't
  // threaded further, only recorded in created/skipped).
  {
    const key = clientMigrationKey();
    const existing = existingByKey.get(key);
    if (existing) {
      skipped.push({ type: "client", syntheticId: dryRun.proposedClient.syntheticId, migrationKey: key, notionPageId: existing.notionPageId, notionUrl: existing.notionUrl, reason: "duplicate-migration-key" });
    } else {
      try {
        const page = await notion.pages.create({
          parent: { database_id: databaseId("client") },
          properties: buildClientProperties(dryRun.proposedClient.record, key),
        });
        created.push({ type: "client", syntheticId: dryRun.proposedClient.syntheticId, migrationKey: key, notionPageId: page.id, notionUrl: pageUrl(page) });
      } catch (err) {
        failed.push({ type: "client", syntheticId: dryRun.proposedClient.syntheticId, migrationKey: key, error: err instanceof Error ? err.message : "Unknown error creating client." });
        stoppedEarly = true;
      }
    }
  }

  // 2. Projects
  const projectPageIdByKey = new Map<ProjectKey, string>();
  if (!stoppedEarly) {
    for (const p of dryRun.proposedProjects) {
      const key = projectMigrationKey(p.record.key);
      const existing = existingByKey.get(key);
      if (existing) {
        projectPageIdByKey.set(p.record.key, existing.notionPageId);
        skipped.push({ type: "project", syntheticId: p.syntheticId, migrationKey: key, notionPageId: existing.notionPageId, notionUrl: existing.notionUrl, reason: "duplicate-migration-key" });
        continue;
      }
      try {
        const page = await notion.pages.create({
          parent: { database_id: databaseId("project") },
          properties: buildProjectProperties(p.record, key),
        });
        projectPageIdByKey.set(p.record.key, page.id);
        created.push({ type: "project", syntheticId: p.syntheticId, migrationKey: key, notionPageId: page.id, notionUrl: pageUrl(page) });
      } catch (err) {
        failed.push({ type: "project", syntheticId: p.syntheticId, migrationKey: key, error: err instanceof Error ? err.message : "Unknown error creating project." });
        stoppedEarly = true;
        break;
      }
    }
  }

  // 3. Hours
  if (!stoppedEarly) {
    for (const h of dryRun.proposedHours) {
      const key = hoursMigrationKey({
        date: h.record.date,
        startTime: h.record.startTime,
        endTime: h.record.endTime,
        billable: h.record.billable,
        projectKey: h.record.projectKey,
      });
      const existing = existingByKey.get(key);
      if (existing) {
        skipped.push({ type: "hours", syntheticId: h.syntheticId, migrationKey: key, notionPageId: existing.notionPageId, notionUrl: existing.notionUrl, reason: "duplicate-migration-key" });
        continue;
      }
      const projectPageId = h.record.projectKey ? (projectPageIdByKey.get(h.record.projectKey) ?? null) : null;
      try {
        const page = await notion.pages.create({
          parent: { database_id: databaseId("hours") },
          properties: buildHoursProperties(h.record, key, projectPageId),
        });
        created.push({ type: "hours", syntheticId: h.syntheticId, migrationKey: key, notionPageId: page.id, notionUrl: pageUrl(page) });
      } catch (err) {
        failed.push({ type: "hours", syntheticId: h.syntheticId, migrationKey: key, error: err instanceof Error ? err.message : "Unknown error creating hours row." });
        stoppedEarly = true;
        break;
      }
    }
  }

  // 4. Work logs
  if (!stoppedEarly) {
    for (const w of dryRun.proposedWorkLogs) {
      const key = workLogMigrationKey({ date: w.record.date, title: w.record.title });
      const existing = existingByKey.get(key);
      if (existing) {
        skipped.push({ type: "worklog", syntheticId: w.syntheticId, migrationKey: key, notionPageId: existing.notionPageId, notionUrl: existing.notionUrl, reason: "duplicate-migration-key" });
        continue;
      }
      const projectPageId = w.record.projectKey ? (projectPageIdByKey.get(w.record.projectKey) ?? null) : null;
      try {
        const page = await notion.pages.create({
          parent: { database_id: databaseId("worklog") },
          properties: buildWorkLogProperties(w.record, key, projectPageId),
        });
        created.push({ type: "worklog", syntheticId: w.syntheticId, migrationKey: key, notionPageId: page.id, notionUrl: pageUrl(page) });
      } catch (err) {
        failed.push({ type: "worklog", syntheticId: w.syntheticId, migrationKey: key, error: err instanceof Error ? err.message : "Unknown error creating work log." });
        stoppedEarly = true;
        break;
      }
    }
  }

  return {
    runId,
    startedAt,
    finishedAt: new Date().toISOString(),
    ok: failed.length === 0,
    confirmationAccepted: true,
    preflight,
    schemaChangesApplied,
    created,
    skipped,
    failed,
    stoppedEarly,
    notionWritesPerformed: created.length > 0 || schemaChangesApplied.length > 0,
    totals: dryRun.totals,
  };
}
