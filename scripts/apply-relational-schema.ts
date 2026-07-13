/**
 * Phase 12A: apply additive relational Notion schema properties approved in
 * Phase 11. Schema-only — zero row writes.
 *
 * Run: node --env-file=.env.local node_modules/.bin/tsx scripts/apply-relational-schema.ts
 */
import { Client } from "@notionhq/client";
import { toNotionWriteClient } from "../src/lib/notion/migration/one-time-import";
import {
  applyRelationalSchemaSetup,
  allRelationalPropertiesReady,
  reciprocalNamesFromInspection,
  selectOptionsValid,
  type RelationalDatabaseIds,
} from "../src/lib/notion/migration/relational-schema-setup";
import {
  buildRelationBackfillPreview,
  isImmutablePreview,
} from "../src/lib/notion/relation-backfill/preview";
import type { LiveNotionRow } from "../src/lib/notion/relation-backfill/preview";
import { relationalSchemaChecks } from "../src/lib/notion/schema-requirements";
import { JULY8_10_OPERATIONAL_TOTALS } from "../src/lib/notion/relation-backfill/july8-10-source";

function databaseIdsFromEnv(): RelationalDatabaseIds {
  return {
    client: process.env.NOTION_DATABASE_CLIENTS ?? null,
    project: process.env.NOTION_DATABASE_PROJECTS ?? null,
    hours: process.env.NOTION_DATABASE_HOURS ?? null,
    worklog: process.env.NOTION_DATABASE_WORKLOGS ?? null,
    invoice: process.env.NOTION_DATABASE_INVOICES ?? null,
  };
}

function printInspection(label: string, report: Awaited<ReturnType<typeof applyRelationalSchemaSetup>>["inspectionAfter"]) {
  console.log(`\n=== ${label} ===`);
  console.log("missingCount:", report.missingCount);
  for (const row of report.properties) {
    console.log(
      `  ${row.database}.${row.name}: present=${row.present} type=${row.actual?.type ?? "-"} skip=${row.skipReason ?? "-"}`,
    );
    if (row.actual?.selectOptions?.length) {
      console.log(`    selectOptions: ${row.actual.selectOptions.join(", ")}`);
    }
    if (row.actual?.reciprocalPropertyName) {
      console.log(`    reciprocal: ${row.actual.reciprocalPropertyName}`);
    }
  }
}

async function fetchLiveJulyRows(
  notion: NonNullable<ReturnType<typeof toNotionWriteClient>>,
): Promise<LiveNotionRow[]> {
  const ids = databaseIdsFromEnv();
  if (!ids.hours || !ids.worklog) return [];
  const jul = (date: string) => date >= "2026-07-08" && date <= "2026-07-10";
  const liveRows: LiveNotionRow[] = [];

  const hoursDs = (await notion.databases.retrieve({ database_id: ids.hours })).data_sources?.[0]?.id;
  const workDs = (await notion.databases.retrieve({ database_id: ids.worklog })).data_sources?.[0]?.id;
  if (!hoursDs || !workDs) return [];

  const queryAll = async (dataSourceId: string) => {
    const results: Array<{ id: string; url?: string; properties?: Record<string, unknown> }> = [];
    let cursor: string | undefined;
    do {
      const page = await notion.dataSources.query({
        data_source_id: dataSourceId,
        start_cursor: cursor,
      });
      results.push(...page.results);
      cursor = page.has_more ? page.next_cursor ?? undefined : undefined;
    } while (cursor);
    return results;
  };

  const text = (prop: unknown) => {
    const p = prop as { rich_text?: Array<{ plain_text?: string }>; title?: Array<{ plain_text?: string }> };
    const arr = p?.rich_text ?? p?.title;
    return arr?.map((t) => t.plain_text ?? "").join("") ?? "";
  };
  const select = (prop: unknown) => (prop as { select?: { name?: string } })?.select?.name ?? null;
  const rel = (prop: unknown) =>
    ((prop as { relation?: Array<{ id: string }> })?.relation ?? []).map((r) => r.id);

  for (const page of await queryAll(hoursDs)) {
    const props = page.properties ?? {};
    const dateText = text(props.Date) || text(props["Date"]);
    const date = dateText.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? "";
    if (!jul(date)) continue;
    liveRows.push({
      id: page.id,
      url: page.url,
      entity: "hours",
      date,
      startTime: text(props["Start Time"]),
      endTime: text(props["End Time"]),
      migrationKey: text(props["Migration Key"]) || null,
      sessionId: text(props["Session ID"]) || null,
      billingStatus: select(props["Billing Status"]),
      relatedWorkDoneIds: rel(props["Related Work Done"]),
      billable: (props.Billable as { checkbox?: boolean })?.checkbox === true,
    });
  }

  for (const page of await queryAll(workDs)) {
    const props = page.properties ?? {};
    const date = (props.Date as { date?: { start?: string } })?.date?.start ?? "";
    if (!jul(date)) continue;
    liveRows.push({
      id: page.id,
      url: page.url,
      entity: "work-done",
      date,
      title: text(props.Title),
      workLogId: text(props["Work Log ID"]) || null,
      approvalStatus: select(props["Approval Status"]),
      relatedHoursIds: rel(props["Related Hours"]),
    });
  }

  return liveRows;
}

async function main() {
  if (process.env.NOTION_SYNC_ENABLED === "true") {
    console.error("Refusing: NOTION_SYNC_ENABLED=true");
    process.exit(1);
  }
  if (!process.env.NOTION_API_KEY) {
    console.error("NOTION_API_KEY is not set.");
    process.exit(1);
  }

  const raw = new Client({ auth: process.env.NOTION_API_KEY });
  const notion = toNotionWriteClient(raw);
  if (!notion) {
    console.error("Failed to construct Notion client.");
    process.exit(1);
  }

  const databaseIds = databaseIdsFromEnv();
  const result = await applyRelationalSchemaSetup(notion, databaseIds);

  printInspection("BEFORE", result.inspectionBefore);
  console.log("\nApplied properties:", result.applied);
  if (result.stoppedEarly) {
    console.error("Stopped early:", result.error);
    process.exit(1);
  }
  printInspection("AFTER", result.inspectionAfter);

  const reciprocals = reciprocalNamesFromInspection(result.inspectionAfter);
  console.log("\nReciprocal relation names:");
  for (const r of reciprocals) {
    console.log(`  ${r.database}.${r.property} ↔ ${r.reciprocal ?? "(none)"}`);
  }

  const actualByDatabase: Record<string, Record<string, { type: string }>> = {};
  for (const row of result.inspectionAfter.properties) {
    actualByDatabase[row.database] ??= {};
    if (row.actual) actualByDatabase[row.database][row.name] = { type: row.actual.type };
  }
  const relationalChecks = relationalSchemaChecks(actualByDatabase);
  console.log("\nRelational verifier:");
  console.log("  allPresent:", allRelationalPropertiesReady(result.inspectionAfter));
  console.log("  selectOptionsValid:", selectOptionsValid(result.inspectionAfter));
  console.log(
    "  checks:",
    relationalChecks.map((c) => `${c.database}.${c.name}=${c.status}`).join(", "),
  );

  const liveRows = await fetchLiveJulyRows(notion);
  const previewA = buildRelationBackfillPreview(liveRows);
  const previewB = buildRelationBackfillPreview(liveRows);
  console.log("\nBackfill preview:");
  console.log("  writesPerformed:", previewA.writesPerformed);
  console.log("  totals:", previewA.totals);
  console.log("  matchesExpected:", previewA.totals.matchesExpected);
  console.log("  quarantineRows:", previewA.quarantineRows.length);
  console.log("  ambiguousMatches:", previewA.ambiguousMatches.length);
  console.log("  deterministic:", isImmutablePreview(previewA, previewB));

  const quarantine = previewA.quarantineRows[0];
  if (quarantine) {
    const billing = quarantine.fields.find((f) => f.property === "Billing Status");
    console.log("  quarantine Billing Status proposed:", billing?.proposedValue);
  }

  if (
    previewA.totals.billableMinutes !== JULY8_10_OPERATIONAL_TOTALS.billableMinutes ||
    previewA.totals.nonBillableMinutes !== JULY8_10_OPERATIONAL_TOTALS.nonBillableMinutes ||
    previewA.totals.amount !== JULY8_10_OPERATIONAL_TOTALS.amount
  ) {
    console.error("Totals mismatch against expected operational dataset.");
    process.exit(1);
  }

  console.log("\nNo row writes performed. Schema-only updates:", result.applied.length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
