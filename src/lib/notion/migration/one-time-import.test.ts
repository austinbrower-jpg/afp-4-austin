import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { buildMigrationDryRun } from "./dry-run";
import {
  IMPORT_CONFIRMATION_PHRASE,
  allExpectedMigrationKeys,
  correctedDatasetChecks,
  isValidConfirmationPhrase,
  runImport,
  runPreflight,
  type NotionWriteClient,
} from "./one-time-import";
import { MIGRATION_KEY_PROPERTY_NAME, PROJECT_RELATION_PROPERTY_NAME } from "./write-schema";

const DB_IDS = { client: "db-client", project: "db-project", hours: "db-hours", worklog: "db-worklog" } as const;
const DS_IDS = { client: "ds-client", project: "ds-project", hours: "ds-hours", worklog: "ds-worklog" } as const;
type EntityType = keyof typeof DB_IDS;

function extractKey(properties: unknown): string {
  const props = properties as Record<string, { rich_text?: Array<{ text?: { content?: string } }> }>;
  return props[MIGRATION_KEY_PROPERTY_NAME]?.rich_text?.[0]?.text?.content ?? "";
}

function createMockNotion(options: { existingKeys?: string[]; failKey?: string; schemaReady?: boolean } = {}) {
  const created: Array<{ databaseId: string; key: string; properties: unknown }> = [];
  const updates: unknown[] = [];
  let pageNumber = 0;
  const client: NotionWriteClient = {
    databases: {
      retrieve: vi.fn(async ({ database_id }) => {
        const type = (Object.entries(DB_IDS).find(([, id]) => id === database_id)?.[0] ?? "") as EntityType;
        return { data_sources: [{ id: DS_IDS[type] }] };
      }),
    },
    dataSources: {
      retrieve: vi.fn(async () => ({
        properties: (options.schemaReady
          ? { [MIGRATION_KEY_PROPERTY_NAME]: { type: "rich_text" }, [PROJECT_RELATION_PROPERTY_NAME]: { type: "relation" } }
          : {}) as Record<string, { type: string }>,
      })),
      update: vi.fn(async (args) => { updates.push(args); return {}; }),
      query: vi.fn(async ({ filter }) => {
        const requested = (filter as { or?: Array<{ rich_text?: { equals?: string } }> })?.or?.map((item) => item.rich_text?.equals) ?? [];
        const matches = (options.existingKeys ?? []).filter((key) => requested.includes(key));
        return {
          results: matches.map((key) => ({
            id: `existing-${key}`,
            url: `https://notion.so/existing-${key}`,
            properties: { [MIGRATION_KEY_PROPERTY_NAME]: { rich_text: [{ plain_text: key }] } },
          })),
          has_more: false,
          next_cursor: null,
        };
      }),
    },
    pages: {
      create: vi.fn(async ({ parent, properties }) => {
        const key = extractKey(properties);
        if (key === options.failKey) throw new Error(`simulated failure: ${key}`);
        created.push({ databaseId: parent.database_id, key, properties });
        pageNumber += 1;
        return { id: `page-${pageNumber}`, url: `https://notion.so/page-${pageNumber}` };
      }),
    },
  };
  return { client, created, updates };
}

const READY_MAPPING = { ready: true };
const READY_DATABASE_IDS = { client: DB_IDS.client, project: DB_IDS.project, hours: DB_IDS.hours, worklog: DB_IDS.worklog };
function input(notion: NotionWriteClient, overrides: Partial<Parameters<typeof runImport>[0]> = {}) {
  return { notion, confirmationPhrase: IMPORT_CONFIRMATION_PHRASE, syncEnabled: false, mapping: READY_MAPPING, databaseIds: READY_DATABASE_IDS, ...overrides };
}

describe("corrected import gate", () => {
  it("accepts only the exact July 8-10 v2 phrase", () => {
    expect(IMPORT_CONFIRMATION_PHRASE).toBe("IMPORT AFP JULY 8-10 V2");
    expect(isValidConfirmationPhrase(IMPORT_CONFIRMATION_PHRASE)).toBe(true);
    for (const invalid of [undefined, "", "IMPORT AFP JULY 8-9", "IMPORT AFP JULY 8-10", "IMPORT AFP JULY 8-10 V2 "]) {
      expect(isValidConfirmationPhrase(invalid)).toBe(false);
    }
  });

  it("rejects a missing confirmation before any Notion call", async () => {
    const { client } = createMockNotion();
    const result = await runImport(input(client, { confirmationPhrase: "" }));
    expect(result.confirmationAccepted).toBe(false);
    expect(result.notionWritesPerformed).toBe(false);
    expect(client.databases.retrieve).not.toHaveBeenCalled();
    expect(client.pages.create).not.toHaveBeenCalled();
  });

  it("preflight requires corrected totals, counts, continuous session, July 10, and v2 keys", async () => {
    const { client } = createMockNotion();
    const report = await runPreflight({ notion: client, syncEnabled: false, mapping: READY_MAPPING, databaseIds: READY_DATABASE_IDS });
    expect(report.ready).toBe(true);
    expect(report.dryRun.totals).toMatchObject({ totalBillableMinutes: 987, totalNonBillableMinutes: 120, totalBillableHours: 16.45, totalInvoiceAmount: 493.5 });
    expect(report.dryRun.proposedHours).toHaveLength(5);
    expect(report.dryRun.proposedWorkLogs).toHaveLength(3);
    expect(report.dryRun.proposedProjects).toHaveLength(5);
    for (const code of ["obsolete-311-fixture-rejected", "july-10-required", "continuous-july-8-afternoon-required", "three-worklogs-required", "v2-migration-namespace-required"]) {
      expect(report.checks.find((check) => check.code === code)?.passed).toBe(true);
    }
    expect(client.pages.create).not.toHaveBeenCalled();
    expect(client.dataSources.update).not.toHaveBeenCalled();
  });

  it("explicitly rejects the old $311 fixture, missing July 10, and split July 8 data", () => {
    const current = buildMigrationDryRun();
    const oldTotal = structuredClone(current);
    oldTotal.totals.totalInvoiceAmount = 311;
    expect(correctedDatasetChecks(oldTotal).find((check) => check.code === "obsolete-311-fixture-rejected")?.passed).toBe(false);

    const missingJuly10 = structuredClone(current);
    missingJuly10.proposedHours = missingJuly10.proposedHours.filter((row) => row.record.date !== "2026-07-10");
    missingJuly10.proposedWorkLogs = missingJuly10.proposedWorkLogs.filter((row) => row.record.date !== "2026-07-10");
    expect(correctedDatasetChecks(missingJuly10).find((check) => check.code === "july-10-required")?.passed).toBe(false);

    const split = structuredClone(current);
    const afternoon = split.proposedHours.find((row) => row.syntheticId === "hrs-2026-07-08-afternoon")!;
    afternoon.record.startTime = "14:05";
    afternoon.record.endTime = "17:00";
    expect(correctedDatasetChecks(split).find((check) => check.code === "continuous-july-8-afternoon-required")?.passed).toBe(false);
  });

  it("refuses while general Notion sync is enabled and performs no writes", async () => {
    const { client } = createMockNotion();
    const result = await runImport(input(client, { syncEnabled: true }));
    expect(result.ok).toBe(false);
    expect(result.notionWritesPerformed).toBe(false);
    expect(client.pages.create).not.toHaveBeenCalled();
    expect(client.dataSources.update).not.toHaveBeenCalled();
  });
});

describe("corrected import behavior with an in-memory Notion mock", () => {
  it("creates 1 client, 5 projects, 5 Hours rows, then 3 Work Done rows", async () => {
    const { client, created } = createMockNotion();
    const result = await runImport(input(client));
    expect(result.ok).toBe(true);
    expect(created.map((row) => row.databaseId)).toEqual([
      DB_IDS.client,
      ...Array(5).fill(DB_IDS.project),
      ...Array(5).fill(DB_IDS.hours),
      ...Array(3).fill(DB_IDS.worklog),
    ]);
    expect(result.totals).toMatchObject({ totalBillableMinutes: 987, totalInvoiceAmount: 493.5 });
  });

  it("writes only afp-history-v2 keys and resolves the onsite row without a project", async () => {
    const { client, created } = createMockNotion();
    await runImport(input(client));
    expect(created.every((row) => row.key.startsWith("afp-history-v2-"))).toBe(true);
    expect(created.some((row) => row.key.endsWith("-v1"))).toBe(false);
    const onsite = created.find((row) => row.key.includes("0900-1100-nonbillable-none"));
    expect((onsite?.properties as Record<string, unknown>)[PROJECT_RELATION_PROPERTY_NAME]).toBeUndefined();
  });

  it("is idempotent by exact v2 migration key", async () => {
    const dryRun = buildMigrationDryRun();
    const allKeys = Object.values(allExpectedMigrationKeys(dryRun)).flat();
    const { client } = createMockNotion({ existingKeys: allKeys, schemaReady: true });
    const result = await runImport(input(client));
    expect(result.ok).toBe(true);
    expect(result.created).toHaveLength(0);
    expect(result.skipped).toHaveLength(14);
    expect(client.pages.create).not.toHaveBeenCalled();
  });

  it("stops on the first failed create and can safely retry around existing keys", async () => {
    const failKey = "afp-history-v2-project-command-center-sales-ops-hub";
    const firstMock = createMockNotion({ failKey });
    const first = await runImport(input(firstMock.client));
    expect(first.ok).toBe(false);
    expect(first.stoppedEarly).toBe(true);
    expect(first.failed[0].migrationKey).toBe(failKey);

    const retryMock = createMockNotion({ existingKeys: first.created.map((row) => row.migrationKey), schemaReady: true });
    const retry = await runImport(input(retryMock.client));
    expect(retry.ok).toBe(true);
    expect(retry.skipped.length).toBe(first.created.length);
    expect(retry.created.some((row) => row.migrationKey === failKey)).toBe(true);
  });
});

describe("Notion mutation surface", () => {
  it("exposes no page update/delete/archive path", () => {
    const source = readFileSync(new URL("./one-time-import.ts", import.meta.url), "utf8");
    for (const forbidden of ["pages.update", "pages.delete", "pages.archive", "pages.move", "archived: true", "in_trash"]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
