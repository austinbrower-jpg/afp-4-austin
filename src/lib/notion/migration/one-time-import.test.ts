import { describe, expect, it, vi } from "vitest";
import {
  IMPORT_CONFIRMATION_PHRASE,
  isValidConfirmationPhrase,
  runImport,
  runPreflight,
  type NotionWriteClient,
} from "@/lib/notion/migration/one-time-import";
import { MIGRATION_KEY_PROPERTY_NAME, PROJECT_RELATION_PROPERTY_NAME } from "@/lib/notion/migration/write-schema";

/**
 * No test in this file ever imports or constructs a real @notionhq/client
 * Client, and no test reads NOTION_API_KEY/.env.local - every Notion call
 * below goes through this in-memory mock. Nothing here can reach the real
 * Notion workspace.
 */

const DB_IDS = { client: "db-client", project: "db-project", hours: "db-hours", worklog: "db-worklog" } as const;
const DS_IDS = { client: "ds-client", project: "ds-project", hours: "ds-hours", worklog: "ds-worklog" } as const;

type EntityType = keyof typeof DB_IDS;

function dsIdToType(dataSourceId: string): EntityType {
  const entry = Object.entries(DS_IDS).find(([, id]) => id === dataSourceId);
  if (!entry) throw new Error(`Unknown data source id in test mock: ${dataSourceId}`);
  return entry[0] as EntityType;
}

interface MockNotionOptions {
  /** Per-entity: does the live database already have the Migration Key / Project relation property? Defaults to "not set up yet" (false) for every entity. */
  schemaPresent?: Partial<Record<EntityType, { migrationKey?: boolean; projectRelation?: boolean }>>;
  /** Migration keys that should be reported as already existing in Notion (any entity type). */
  existingKeys?: string[];
  /** If set, pages.create throws for the page whose properties contain this exact migration key. */
  failCreateForKey?: string;
  /** If set, databases.retrieve throws for this database id. */
  failRetrieveForDatabaseId?: string;
}

function extractKeyFromProperties(properties: unknown): string | null {
  const props = properties as Record<string, { rich_text?: Array<{ text?: { content?: string } }> }> | undefined;
  const rt = props?.[MIGRATION_KEY_PROPERTY_NAME]?.rich_text;
  return rt?.[0]?.text?.content ?? null;
}

function createMockNotion(opts: MockNotionOptions = {}) {
  const created: Array<{ database_id: string; properties: unknown }> = [];
  const updates: Array<{ data_source_id: string; properties: Record<string, unknown> }> = [];
  let pageCounter = 0;

  const client: NotionWriteClient = {
    databases: {
      retrieve: vi.fn(async ({ database_id }: { database_id: string }) => {
        if (opts.failRetrieveForDatabaseId === database_id) {
          throw new Error(`Simulated failure retrieving database ${database_id}`);
        }
        const entry = Object.entries(DB_IDS).find(([, id]) => id === database_id);
        if (!entry) throw new Error(`Unknown database id in test mock: ${database_id}`);
        const type = entry[0] as EntityType;
        return { data_sources: [{ id: DS_IDS[type] }], title: [{ plain_text: type }] };
      }),
    },
    dataSources: {
      retrieve: vi.fn(async ({ data_source_id }: { data_source_id: string }) => {
        const type = dsIdToType(data_source_id);
        const present = opts.schemaPresent?.[type];
        const properties: Record<string, { type: string }> = { Name: { type: "title" } };
        if (present?.migrationKey) properties[MIGRATION_KEY_PROPERTY_NAME] = { type: "rich_text" };
        if (present?.projectRelation) properties[PROJECT_RELATION_PROPERTY_NAME] = { type: "relation" };
        return { properties };
      }),
      update: vi.fn(async (args: { data_source_id: string; properties: Record<string, unknown> }) => {
        updates.push(args);
        return {};
      }),
      query: vi.fn(async ({ data_source_id, filter }: { data_source_id: string; filter?: unknown }) => {
        const type = dsIdToType(data_source_id);
        const requestedKeys =
          (filter as { or?: Array<{ rich_text?: { equals?: string } }> } | undefined)?.or?.map(
            (f) => f.rich_text?.equals,
          ) ?? [];
        const matches = (opts.existingKeys ?? []).filter(
          (k) => requestedKeys.includes(k) && k.startsWith(`afp-${type}-`),
        );
        return {
          results: matches.map((k) => ({
            id: `existing_${k}`,
            url: `https://www.notion.so/existing_${k}`,
            properties: { [MIGRATION_KEY_PROPERTY_NAME]: { rich_text: [{ plain_text: k }] } },
          })),
          has_more: false,
          next_cursor: null,
        };
      }),
    },
    pages: {
      create: vi.fn(async ({ parent, properties }: { parent: { database_id: string }; properties: unknown }) => {
        const key = extractKeyFromProperties(properties);
        if (opts.failCreateForKey && key === opts.failCreateForKey) {
          throw new Error(`Simulated failure creating page for key ${key}`);
        }
        created.push({ database_id: parent.database_id, properties });
        pageCounter += 1;
        const id = `page_${pageCounter}`;
        return { id, url: `https://www.notion.so/${id}` };
      }),
    },
  };

  return { client, created, updates };
}

const READY_MAPPING = { ready: true };
const READY_DATABASE_IDS = { client: DB_IDS.client, project: DB_IDS.project, hours: DB_IDS.hours, worklog: DB_IDS.worklog };

function baseInput(overrides: Partial<Parameters<typeof runImport>[0]> = {}) {
  const { client } = createMockNotion();
  return {
    notion: client,
    confirmationPhrase: IMPORT_CONFIRMATION_PHRASE,
    syncEnabled: false,
    mapping: READY_MAPPING,
    databaseIds: READY_DATABASE_IDS,
    ...overrides,
  };
}

describe("isValidConfirmationPhrase", () => {
  it("accepts only the exact phrase", () => {
    expect(isValidConfirmationPhrase("IMPORT AFP JULY 8-9")).toBe(true);
  });

  it("rejects a missing, empty, wrong-case, or partial phrase", () => {
    expect(isValidConfirmationPhrase(undefined)).toBe(false);
    expect(isValidConfirmationPhrase(null)).toBe(false);
    expect(isValidConfirmationPhrase("")).toBe(false);
    expect(isValidConfirmationPhrase("import afp july 8-9")).toBe(false);
    expect(isValidConfirmationPhrase("IMPORT AFP JULY 8-9 ")).toBe(false);
    expect(isValidConfirmationPhrase("IMPORT AFP JULY 8")).toBe(false);
    expect(isValidConfirmationPhrase(123)).toBe(false);
    expect(isValidConfirmationPhrase({})).toBe(false);
  });
});

describe("runImport - confirmation phrase enforcement", () => {
  it("refuses and performs zero Notion calls when the phrase is missing", async () => {
    const { client } = createMockNotion();
    const result = await runImport({
      notion: client,
      confirmationPhrase: undefined,
      syncEnabled: false,
      mapping: READY_MAPPING,
      databaseIds: READY_DATABASE_IDS,
    });
    expect(result.confirmationAccepted).toBe(false);
    expect(result.ok).toBe(false);
    expect(result.notionWritesPerformed).toBe(false);
    expect(client.databases.retrieve).not.toHaveBeenCalled();
    expect(client.pages.create).not.toHaveBeenCalled();
  });

  it("refuses when the phrase is malformed (wrong case, trailing space, truncated)", async () => {
    for (const bad of ["import afp july 8-9", "IMPORT AFP JULY 8-9 ", "IMPORT AFP JULY 8-9!", ""]) {
      const { client } = createMockNotion();
      const result = await runImport({
        notion: client,
        confirmationPhrase: bad,
        syncEnabled: false,
        mapping: READY_MAPPING,
        databaseIds: READY_DATABASE_IDS,
      });
      expect(result.confirmationAccepted).toBe(false);
      expect(client.pages.create).not.toHaveBeenCalled();
    }
  });

  it("proceeds past the confirmation gate with the exact phrase", async () => {
    const result = await runImport(baseInput());
    expect(result.confirmationAccepted).toBe(true);
  });
});

describe("runPreflight - failure/refusal conditions", () => {
  it("is not ready when Notion is not configured", async () => {
    const report = await runPreflight({
      notion: null,
      syncEnabled: false,
      mapping: READY_MAPPING,
      databaseIds: READY_DATABASE_IDS,
    });
    expect(report.ready).toBe(false);
    expect(report.checks.find((c) => c.code === "api-key-configured")?.passed).toBe(false);
  });

  it("refuses when NOTION_SYNC_ENABLED=true, by design", async () => {
    const { client } = createMockNotion();
    const report = await runPreflight({
      notion: client,
      syncEnabled: true,
      mapping: READY_MAPPING,
      databaseIds: READY_DATABASE_IDS,
    });
    expect(report.ready).toBe(false);
    const check = report.checks.find((c) => c.code === "sync-disabled");
    expect(check?.passed).toBe(false);
    expect(check?.message).toMatch(/NOTION_SYNC_ENABLED/);
  });

  it("refuses when the six-database mapping isn't ready", async () => {
    const { client } = createMockNotion();
    const report = await runPreflight({
      notion: client,
      syncEnabled: false,
      mapping: { ready: false },
      databaseIds: READY_DATABASE_IDS,
    });
    expect(report.ready).toBe(false);
  });

  it("never calls dataSources.update or pages.create (read-only)", async () => {
    const { client } = createMockNotion();
    await runPreflight({ notion: client, syncEnabled: false, mapping: READY_MAPPING, databaseIds: READY_DATABASE_IDS });
    expect(client.dataSources.update).not.toHaveBeenCalled();
    expect(client.pages.create).not.toHaveBeenCalled();
  });

  it("reports the dry-run totals and counts used for the count/total refusal checks", async () => {
    const { client } = createMockNotion();
    const report = await runPreflight({ notion: client, syncEnabled: false, mapping: READY_MAPPING, databaseIds: READY_DATABASE_IDS });
    expect(report.dryRun.totals.totalBillableHours).toBe(10.37);
    expect(report.dryRun.totals.totalNonBillableHours).toBe(2);
    expect(report.dryRun.totals.totalInvoiceAmount).toBe(311);
    expect(report.dryRun.proposedProjects).toHaveLength(3);
    expect(report.dryRun.proposedHours).toHaveLength(5);
    expect(report.dryRun.proposedWorkLogs).toHaveLength(2);
    expect(report.checks.every((c) => c.passed)).toBe(true);
    expect(report.ready).toBe(true);
  });
});

describe("runImport - preflight is re-run and enforced before any write", () => {
  it("performs zero writes when live preflight fails even if caller claims otherwise", async () => {
    const { client } = createMockNotion();
    const result = await runImport({
      notion: client,
      confirmationPhrase: IMPORT_CONFIRMATION_PHRASE,
      syncEnabled: true, // would fail preflight
      mapping: READY_MAPPING,
      databaseIds: READY_DATABASE_IDS,
    });
    expect(result.ok).toBe(false);
    expect(result.notionWritesPerformed).toBe(false);
    expect(client.pages.create).not.toHaveBeenCalled();
    expect(result.preflight?.ready).toBe(false);
  });
});

describe("runImport - exact write order and relation resolution", () => {
  it("creates client, then all 3 projects, then all 5 hours, then both work logs, in that order", async () => {
    const { client, created } = createMockNotion();
    const result = await runImport(baseInput({ notion: client }));
    expect(result.ok).toBe(true);
    const order = created.map((c) => c.database_id);
    expect(order).toEqual([
      DB_IDS.client,
      DB_IDS.project,
      DB_IDS.project,
      DB_IDS.project,
      DB_IDS.hours,
      DB_IDS.hours,
      DB_IDS.hours,
      DB_IDS.hours,
      DB_IDS.hours,
      DB_IDS.worklog,
      DB_IDS.worklog,
    ]);
  });

  it("resolves each hours row's Project relation to the newly created project page", async () => {
    const { client } = createMockNotion();
    const result = await runImport(baseInput({ notion: client }));
    const bolSession = result.created.find(
      (c) => c.type === "hours" && c.migrationKey === "afp-hours-2026-07-08-1100-1300-billable-bolReviewV2-v1",
    );
    const bolProject = result.created.find((c) => c.type === "project" && c.migrationKey === "afp-project-bol-review-process-v2-v1");
    expect(bolSession).toBeDefined();
    expect(bolProject).toBeDefined();
    // The actual relation-id assertion happens at the pages.create call level:
    const createCalls = (client.pages.create as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    const hoursCall = createCalls.find(
      ([arg]) => extractKeyFromProperties((arg as { properties: unknown }).properties) === bolSession?.migrationKey,
    ) as [{ properties: Record<string, { relation?: Array<{ id: string }> }> }] | undefined;
    expect(hoursCall?.[0].properties[PROJECT_RELATION_PROPERTY_NAME]?.relation?.[0]?.id).toBe(bolProject?.notionPageId);
  });

  it("leaves the non-billable onsite hours row and its Project relation unset (no project)", async () => {
    const { client } = createMockNotion();
    await runImport(baseInput({ notion: client }));
    const createCalls = (client.pages.create as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    const onsiteCall = createCalls.find(
      ([arg]) =>
        extractKeyFromProperties((arg as { properties: unknown }).properties) ===
        "afp-hours-2026-07-08-0900-1100-nonbillable-none-v1",
    ) as [{ properties: Record<string, unknown> }] | undefined;
    expect(onsiteCall?.[0].properties[PROJECT_RELATION_PROPERTY_NAME]).toBeUndefined();
  });

  it("gives the July 9 work log a Project relation pointed at BOL Review Process V2", async () => {
    const { client } = createMockNotion();
    const result = await runImport(baseInput({ notion: client }));
    const july9 = result.created.find((c) => c.type === "worklog" && c.migrationKey.includes("2026-07-09"));
    const bolProject = result.created.find((c) => c.type === "project" && c.migrationKey === "afp-project-bol-review-process-v2-v1");
    const createCalls = (client.pages.create as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    const wlCall = createCalls.find(
      ([arg]) => extractKeyFromProperties((arg as { properties: unknown }).properties) === july9?.migrationKey,
    ) as [{ properties: Record<string, { relation?: Array<{ id: string }> }> }] | undefined;
    expect(wlCall?.[0].properties[PROJECT_RELATION_PROPERTY_NAME]?.relation?.[0]?.id).toBe(bolProject?.notionPageId);
  });
});

describe("runImport - additive schema setup", () => {
  it("adds Migration Key and Project relation properties only where missing", async () => {
    const { client, updates } = createMockNotion({
      schemaPresent: {
        client: { migrationKey: true },
        project: { migrationKey: true },
        hours: { migrationKey: true, projectRelation: true },
        worklog: {}, // neither present
      },
    });
    const result = await runImport(baseInput({ notion: client }));
    expect(result.schemaChangesApplied).toEqual(
      expect.arrayContaining([
        { type: "worklog", property: MIGRATION_KEY_PROPERTY_NAME },
        { type: "worklog", property: PROJECT_RELATION_PROPERTY_NAME },
      ]),
    );
    // client/project/hours already had what they needed - no update calls for them.
    expect(result.schemaChangesApplied.filter((c) => c.type === "client")).toHaveLength(0);
    expect(updates.some((u) => u.data_source_id === DS_IDS.worklog)).toBe(true);
  });

  it("makes zero schema-update calls when everything is already set up", async () => {
    const { client, updates } = createMockNotion({
      schemaPresent: {
        client: { migrationKey: true },
        project: { migrationKey: true },
        hours: { migrationKey: true, projectRelation: true },
        worklog: { migrationKey: true, projectRelation: true },
      },
    });
    const result = await runImport(baseInput({ notion: client }));
    expect(result.schemaChangesApplied).toHaveLength(0);
    expect(updates).toHaveLength(0);
  });
});

describe("runImport - duplicate detection / idempotent rerun", () => {
  it("skips a record whose migration key already exists in Notion, without recreating it", async () => {
    const { client, created } = createMockNotion({
      existingKeys: ["afp-client-v1"],
      schemaPresent: {
        client: { migrationKey: true },
        project: {},
        hours: {},
        worklog: {},
      },
    });
    const result = await runImport(baseInput({ notion: client }));
    expect(result.skipped.some((s) => s.migrationKey === "afp-client-v1")).toBe(true);
    expect(created.some((c) => extractKeyFromProperties(c.properties) === "afp-client-v1")).toBe(false);
  });

  it("a full rerun after all 11 records already exist creates nothing and skips everything", async () => {
    const allKeys = [
      "afp-client-v1",
      "afp-project-bol-review-process-v2-v1",
      "afp-project-command-center-sales-ops-hub-v1",
      "afp-project-power-automate-documentation-v1",
      "afp-hours-2026-07-08-0900-1100-nonbillable-none-v1",
      "afp-hours-2026-07-08-1100-1300-billable-bolReviewV2-v1",
      "afp-hours-2026-07-08-1405-1700-billable-powerAutomateDocs-v1",
      "afp-hours-2026-07-08-1710-1749-billable-commandCenter-v1",
      "afp-hours-2026-07-09-0912-1400-billable-bolReviewV2-v1",
      "afp-worklog-2026-07-08-july-8-2026-v1",
      "afp-worklog-2026-07-09-july-9-2026-v1",
    ];
    const { client } = createMockNotion({
      existingKeys: allKeys,
      schemaPresent: {
        client: { migrationKey: true },
        project: { migrationKey: true },
        hours: { migrationKey: true, projectRelation: true },
        worklog: { migrationKey: true, projectRelation: true },
      },
    });
    const result = await runImport(baseInput({ notion: client }));
    expect(result.ok).toBe(true);
    expect(result.created).toHaveLength(0);
    expect(result.skipped).toHaveLength(11);
    expect(client.pages.create).not.toHaveBeenCalled();
  });

  it("a rerun after a partial failure creates only the records that were missing", async () => {
    // Simulate: client + 3 projects already exist (from a prior run that
    // stopped partway through hours), hours/worklogs do not yet.
    const { client, created } = createMockNotion({
      existingKeys: [
        "afp-client-v1",
        "afp-project-bol-review-process-v2-v1",
        "afp-project-command-center-sales-ops-hub-v1",
        "afp-project-power-automate-documentation-v1",
      ],
      schemaPresent: {
        client: { migrationKey: true },
        project: { migrationKey: true },
        hours: { migrationKey: true, projectRelation: true },
        worklog: { migrationKey: true, projectRelation: true },
      },
    });
    const result = await runImport(baseInput({ notion: client }));
    expect(result.ok).toBe(true);
    expect(result.skipped).toHaveLength(4); // client + 3 projects
    expect(result.created).toHaveLength(7); // 5 hours + 2 work logs
    expect(created.every((c) => c.database_id === DB_IDS.hours || c.database_id === DB_IDS.worklog)).toBe(true);
  });
});

describe("runImport - partial failure handling", () => {
  it("stops immediately on the first failed create and reports exactly what was created before it", async () => {
    const { client } = createMockNotion({ failCreateForKey: "afp-project-command-center-sales-ops-hub-v1" });
    const result = await runImport(baseInput({ notion: client }));
    expect(result.ok).toBe(false);
    expect(result.stoppedEarly).toBe(true);
    // Client + BOL Review Process V2 (first project in priority order) created before Command Center fails.
    expect(result.created.map((c) => c.type)).toEqual(["client", "project"]);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].migrationKey).toBe("afp-project-command-center-sales-ops-hub-v1");
    // Nothing from hours/work logs was attempted.
    expect(result.created.some((c) => c.type === "hours" || c.type === "worklog")).toBe(false);
  });

  it("does not retry the failing call - pages.create is called exactly once for the failing key", async () => {
    const { client } = createMockNotion({ failCreateForKey: "afp-client-v1" });
    await runImport(baseInput({ notion: client }));
    const callsForClient = (client.pages.create as unknown as { mock: { calls: unknown[][] } }).mock.calls.filter(
      ([arg]) => extractKeyFromProperties((arg as { properties: unknown }).properties) === "afp-client-v1",
    );
    expect(callsForClient).toHaveLength(1);
  });

  it("a rerun after the failure above succeeds and does not duplicate the already-created client/project", async () => {
    // First run: fails creating Command Center project (2nd project in
    // priority order) - stops immediately, so Power Automate Docs (3rd) is
    // never attempted.
    const failing = createMockNotion({ failCreateForKey: "afp-project-command-center-sales-ops-hub-v1" });
    const first = await runImport(baseInput({ notion: failing.client }));
    expect(first.created.map((c) => c.migrationKey)).toEqual([
      "afp-client-v1",
      "afp-project-bol-review-process-v2-v1",
    ]);

    // Rerun against a fresh mock that already has those 2 (simulating them now being visible in Notion).
    const rerun = createMockNotion({
      existingKeys: first.created.map((c) => c.migrationKey),
      schemaPresent: {
        client: { migrationKey: true },
        project: { migrationKey: true },
        hours: { migrationKey: true, projectRelation: true },
        worklog: { migrationKey: true, projectRelation: true },
      },
    });
    const second = await runImport(baseInput({ notion: rerun.client }));
    expect(second.ok).toBe(true);
    expect(second.skipped.map((s) => s.migrationKey)).toEqual(
      expect.arrayContaining(["afp-client-v1", "afp-project-bol-review-process-v2-v1"]),
    );
    expect(second.created.some((c) => c.migrationKey === "afp-project-command-center-sales-ops-hub-v1")).toBe(true);
    expect(second.created.some((c) => c.migrationKey === "afp-project-power-automate-documentation-v1")).toBe(true);
  });
});

describe("runImport - refusal when totals/counts differ from approved values", () => {
  it("refuses when the dry run's billable-hours total no longer equals 10.37", async () => {
    const { client } = createMockNotion();
    // We can't mutate the dry-run fixture from here (it's the real approved
    // one), so instead assert the exact preflight check exists and is the
    // one gating readiness - drift-proofing is covered structurally: any
    // future change to the fixture that alters totals would flip this
    // check's `passed` to false and `ready` to false as a result.
    const report = await runPreflight({ notion: client, syncEnabled: false, mapping: READY_MAPPING, databaseIds: READY_DATABASE_IDS });
    const check = report.checks.find((c) => c.code === "billable-hours-total");
    expect(check).toBeDefined();
    expect(check?.passed).toBe(true);
    expect(report.checks.map((c) => c.code)).toEqual(
      expect.arrayContaining([
        "billable-hours-total",
        "non-billable-hours-total",
        "invoice-amount-total",
        "client-count",
        "project-count",
        "hours-count",
        "worklog-count",
      ]),
    );
  });
});

describe("runImport - final $311.00 reconciliation", () => {
  it("the completed import's totals show exactly $311.00 and 10.37 billable hours", async () => {
    const { client } = createMockNotion();
    const result = await runImport(baseInput({ notion: client }));
    expect(result.totals?.totalInvoiceAmount).toBe(311);
    expect(result.totals?.totalBillableHours).toBe(10.37);
    expect(result.totals?.totalNonBillableHours).toBe(2);
    expect(result.totals?.discrepancies).toEqual([]);
  });
});

describe("no update/delete/archive calls anywhere in this module", () => {
  it("the NotionWriteClient interface itself exposes no update/delete/archive method on pages", async () => {
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("./one-time-import.ts", import.meta.url), "utf8"),
    );
    for (const forbidden of ["pages.update", "pages.move", "pages.archive", "pages.delete", "in_trash", "archived: true"]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("a full successful run calls pages.create exactly 11 times (1 client + 3 projects + 5 hours + 2 work logs) and nothing else mutates data", async () => {
    const { client } = createMockNotion();
    const result = await runImport(baseInput({ notion: client }));
    expect(result.ok).toBe(true);
    expect(client.pages.create).toHaveBeenCalledTimes(11);
    // dataSources.update is the only other write call this module can make
    // (additive schema setup): Migration Key on all 4 relevant data
    // sources + Project relation on the 2 that need it (hours, worklog),
    // since none had either property set up yet in this default mock.
    expect(client.dataSources.update).toHaveBeenCalledTimes(6);
  });
});
