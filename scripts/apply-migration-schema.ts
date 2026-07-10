/**
 * One-time, standalone operational script: applies ONLY the two additive
 * Notion schema properties the Phase 6 historical import needs (Migration
 * Key rich_text, Project relation) to the four relevant live databases.
 * Creates zero client/project/hours/work-log records - that remains gated
 * behind the confirmation-phrase-protected POST /api/notion/migration-import
 * endpoint, which this script never calls.
 *
 * Deliberately outside the Next.js app: src/lib/notion/client.ts and
 * config.ts are `import "server-only"`, which throws immediately outside a
 * bundler's react-server condition, so this script talks to Notion
 * directly and re-derives the same read-only schema check
 * (schema-requirements.ts is plain/pure, safe to import here) rather than
 * importing verify-databases.ts. The actual write call
 * (applySchemaSetup) and the preflight logic (runPreflight) ARE imported
 * from the real, tested application module - not reimplemented - so this
 * script exercises the exact same code the app itself would run.
 *
 * Run with: node --env-file=.env.local node_modules/.bin/tsx scripts/apply-migration-schema.ts
 */
import { Client } from "@notionhq/client";
import {
  NOTION_PROPERTY_REQUIREMENTS,
  validateProperties,
  isSchemaValid,
  type PropertyCheckResult,
} from "../src/lib/notion/schema-requirements";
import {
  runPreflight,
  applySchemaSetup,
  toNotionWriteClient,
  type DatabaseMappingSummary,
} from "../src/lib/notion/migration/one-time-import";

const ENTITY_ENV_VARS = {
  client: "NOTION_DATABASE_CLIENTS",
  project: "NOTION_DATABASE_PROJECTS",
  hours: "NOTION_DATABASE_HOURS",
  worklog: "NOTION_DATABASE_WORKLOGS",
  knowledge: "NOTION_DATABASE_KNOWLEDGE",
  invoice: "NOTION_DATABASE_INVOICES",
} as const;

async function computeMappingReady(notion: Client): Promise<DatabaseMappingSummary> {
  const apiKeyConfigured = Boolean(process.env.NOTION_API_KEY);
  const results: boolean[] = [];

  for (const [type, envVar] of Object.entries(ENTITY_ENV_VARS)) {
    const databaseId = process.env[envVar];
    if (!databaseId) {
      results.push(false);
      continue;
    }
    try {
      const database = await notion.databases.retrieve({ database_id: databaseId });
      const dataSourceId = "data_sources" in database ? database.data_sources[0]?.id : undefined;
      if (!dataSourceId) {
        results.push(false);
        continue;
      }
      const dataSource = await notion.dataSources.retrieve({ data_source_id: dataSourceId });
      const requirements = NOTION_PROPERTY_REQUIREMENTS[type as keyof typeof NOTION_PROPERTY_REQUIREMENTS];
      const checked: PropertyCheckResult[] = validateProperties(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (dataSource as any).properties,
        requirements,
      );
      results.push(isSchemaValid(checked));
    } catch {
      results.push(false);
    }
  }

  return { ready: apiKeyConfigured && results.length === 6 && results.every(Boolean) };
}

function printSchemaSetup(label: string, report: Awaited<ReturnType<typeof runPreflight>>) {
  console.log(`\n--- ${label} ---`);
  console.log("ready:", report.ready);
  console.log(
    "checks:",
    report.checks.map((c) => `${c.code}=${c.passed}`).join(", "),
  );
  console.log("schemaSetup:");
  for (const s of report.schemaSetup) {
    console.log(
      `  ${s.type}: migrationKey=${s.migrationKeyPropertyPresent} projectRelation=${s.projectRelationPropertyPresent}`,
    );
  }
  console.log("existingByKey count:", report.existingByKey.length);
  console.log(
    "proposed counts: client=1 project=" +
      report.dryRun.proposedProjects.length +
      " hours=" +
      report.dryRun.proposedHours.length +
      " worklog=" +
      report.dryRun.proposedWorkLogs.length,
  );
  console.log(
    "totals: billable=" +
      report.dryRun.totals.totalBillableHours +
      " nonBillable=" +
      report.dryRun.totals.totalNonBillableHours +
      " amount=" +
      report.dryRun.totals.totalInvoiceAmount,
  );
}

async function main() {
  if (process.env.NOTION_SYNC_ENABLED === "true") {
    console.error("Refusing to run: NOTION_SYNC_ENABLED=true. This script only runs while general sync stays disabled.");
    process.exit(1);
  }
  if (!process.env.NOTION_API_KEY) {
    console.error("NOTION_API_KEY is not set.");
    process.exit(1);
  }

  const rawClient = new Client({ auth: process.env.NOTION_API_KEY });
  const notion = toNotionWriteClient(rawClient);
  if (!notion) {
    console.error("Failed to construct Notion client.");
    process.exit(1);
  }

  const databaseIds = {
    client: process.env.NOTION_DATABASE_CLIENTS ?? null,
    project: process.env.NOTION_DATABASE_PROJECTS ?? null,
    hours: process.env.NOTION_DATABASE_HOURS ?? null,
    worklog: process.env.NOTION_DATABASE_WORKLOGS ?? null,
  };

  const mapping = await computeMappingReady(rawClient);
  const syncEnabled = process.env.NOTION_SYNC_ENABLED === "true";

  const before = await runPreflight({ notion, syncEnabled, mapping, databaseIds });
  printSchemaSetup("BEFORE", before);

  const missing = before.schemaSetup.some(
    (s) => !s.migrationKeyPropertyPresent || s.projectRelationPropertyPresent === false,
  );

  if (!missing) {
    console.log("\nNothing to apply - all properties already present. No write performed.");
    return;
  }

  console.log("\nApplying additive schema changes (Migration Key / Project relation where missing)...");
  const applied = await applySchemaSetup(notion, before);
  console.log("Applied:", applied);

  const after = await runPreflight({ notion, syncEnabled, mapping, databaseIds });
  printSchemaSetup("AFTER", after);
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
