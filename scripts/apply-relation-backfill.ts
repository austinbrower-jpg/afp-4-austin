/**
 * Phase 12B: apply approved July 8–10 relation backfill to live Notion rows.
 *
 * Run: node node_modules/.bin/tsx scripts/apply-relation-backfill.ts
 * Preflight only: node node_modules/.bin/tsx scripts/apply-relation-backfill.ts --preflight-only
 */
import { Client } from "@notionhq/client";
import { toNotionWriteClient } from "../src/lib/notion/migration/one-time-import";
import {
  applyRelationBackfill,
  APPROVED_BILLING_STATUS,
  APPROVED_PROJECT_CLIENT_NAMES,
  JULY8_10_OPERATIONAL_TOTALS,
  runRelationBackfillPreflight,
  type BackfillApplyClient,
} from "../src/lib/notion/migration/relation-backfill-apply";
import type { BackfillDatabaseIds } from "../src/lib/notion/relation-backfill/live-fetch";
import { buildRelationBackfillPreview, isImmutablePreview } from "../src/lib/notion/relation-backfill/preview";

function databaseIdsFromEnv(): BackfillDatabaseIds {
  return {
    client: process.env.NOTION_DATABASE_CLIENTS ?? null,
    project: process.env.NOTION_DATABASE_PROJECTS ?? null,
    hours: process.env.NOTION_DATABASE_HOURS ?? null,
    worklog: process.env.NOTION_DATABASE_WORKLOGS ?? null,
  };
}

function toApplyClient(raw: Client): BackfillApplyClient {
  const base = toNotionWriteClient(raw);
  if (!base) throw new Error("Failed to construct Notion client.");
  return {
    ...base,
    pages: {
      ...base.pages,
      update: (args) =>
        raw.pages.update(args as Parameters<Client["pages"]["update"]>[0]) as Promise<{ id: string; url?: string }>,
    },
  };
}

function printPreflight(preflight: Awaited<ReturnType<typeof runRelationBackfillPreflight>>) {
  console.log("\n=== PREFLIGHT ===");
  console.log("ok:", preflight.ok);
  if (preflight.errors.length) {
    console.log("\nErrors:");
    for (const err of preflight.errors) console.log(`  - ${err}`);
  }
  if (preflight.warnings.length) {
    console.log("\nWarnings:");
    for (const w of preflight.warnings) console.log(`  - ${w}`);
  }

  if (preflight.mapped) {
    console.log("\nResolved page IDs:");
    console.log(`  Client (${preflight.mapped.client.name}): ${preflight.mapped.client.id}`);
    for (const name of APPROVED_PROJECT_CLIENT_NAMES) {
      const p = preflight.mapped.projectsByName.get(name);
      console.log(`  Project ${name}: ${p?.id ?? "MISSING"}`);
    }
    for (const [sourceId, live] of preflight.mapped.hoursBySourceId) {
      console.log(
        `  Hours ${sourceId}: ${live.id} session=${preflight.mapped.sessionIds.get(sourceId)} billing=${APPROVED_BILLING_STATUS[sourceId]}`,
      );
    }
    for (const [sourceId, live] of preflight.mapped.workBySourceId) {
      console.log(
        `  Work ${sourceId}: ${live.id} workLogId=${preflight.mapped.workLogIds.get(sourceId)}`,
      );
    }
  }

  console.log("\nPreview totals:", preflight.preview.totals);
  console.log("ambiguousMatches:", preflight.preview.ambiguousMatches.length);
  console.log("duplicates:", preflight.preview.duplicates.length);

  console.log("\n=== WRITE PLAN ===");
  let actionable = 0;
  let skipped = 0;
  for (const step of preflight.writePlan) {
    const status = step.skip ? "SKIP" : "APPLY";
    if (step.skip) skipped++;
    else actionable++;
    console.log(`  [${status}] ${step.phase} | ${step.label} | ${JSON.stringify(step.values)}${step.skipReason ? ` (${step.skipReason})` : ""}`);
  }
  console.log(`\nPlan summary: ${actionable} to apply, ${skipped} idempotent skips`);
}

function printApplyResult(result: Awaited<ReturnType<typeof applyRelationBackfill>>) {
  printPreflight(result.preflight);
  console.log("\n=== APPLY RESULT ===");
  console.log("stoppedEarly:", result.stoppedEarly);
  if (result.error) console.log("error:", result.error);

  console.log("\nApplied updates:", result.applied.length);
  for (const row of result.applied) {
    console.log(`  ${row.phase} | ${row.label} | ${JSON.stringify(row.values)}`);
  }

  console.log("\nSkipped/idempotent:", result.skipped.length);
  for (const row of result.skipped) {
    console.log(`  ${row.phase} | ${row.label} | ${JSON.stringify(row.values)}`);
  }

  if (result.postPreview) {
    console.log("\n=== POST-APPLY PREVIEW ===");
    console.log("writesPerformed:", result.postPreview.writesPerformed);
    console.log("totals:", result.postPreview.totals);
    console.log("ambiguousMatches:", result.postPreview.ambiguousMatches.length);
    console.log("duplicates:", result.postPreview.duplicates.length);

    const sessionFields = result.postPreview.rows
      .filter((r) => r.entity === "hours")
      .map((r) => r.fields.find((f) => f.property === "Session ID"))
      .filter(Boolean);
    const workFields = result.postPreview.rows
      .filter((r) => r.entity === "work-done")
      .map((r) => r.fields.find((f) => f.property === "Work Log ID"))
      .filter(Boolean);
    console.log("\nSession IDs current vs proposed:");
    for (const f of sessionFields) {
      console.log(`  current=${f!.currentValue} proposed=${f!.proposedValue} match=${f!.currentValue === f!.proposedValue}`);
    }
    console.log("Work Log IDs current vs proposed:");
    for (const f of workFields) {
      console.log(`  current=${f!.currentValue} proposed=${f!.proposedValue} match=${f!.currentValue === f!.proposedValue}`);
    }
  }

  if (result.reportVerification) {
    console.log("\n=== REPORT BUILDER (canonical dataset) ===");
    console.log(result.reportVerification);
  }
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

  const preflightOnly = process.argv.includes("--preflight-only");
  const raw = new Client({ auth: process.env.NOTION_API_KEY });
  const notion = toApplyClient(raw);
  const databaseIds = databaseIdsFromEnv();

  if (preflightOnly) {
    const preflight = await runRelationBackfillPreflight(notion, databaseIds);
    printPreflight(preflight);
    process.exit(preflight.ok ? 0 : 1);
  }

  const result = await applyRelationBackfill(notion, databaseIds);
  printApplyResult(result);

  if (result.stoppedEarly) {
    process.exit(1);
  }

  if (result.postPreview) {
    const a = result.postPreview;
    const b = buildRelationBackfillPreview(
      [...result.preflight.mapped!.hoursBySourceId.entries(), ...result.preflight.mapped!.workBySourceId.entries()].map(
        ([sourceId, live]) => ({ ...live, id: sourceId }),
      ),
    );
    console.log("\nPreview deterministic:", isImmutablePreview(a, b));

    const allFieldsMatch = result.postPreview.rows.every((row) =>
      row.fields.every((f) => f.currentValue === f.proposedValue || (f.currentValue && f.proposedValue && f.currentValue === f.proposedValue)),
    );
    console.log("All proposed fields match live:", allFieldsMatch);

    if (
      result.postPreview.totals.billableMinutes !== JULY8_10_OPERATIONAL_TOTALS.billableMinutes ||
      result.postPreview.totals.nonBillableMinutes !== JULY8_10_OPERATIONAL_TOTALS.nonBillableMinutes ||
      result.postPreview.totals.amount !== JULY8_10_OPERATIONAL_TOTALS.amount
    ) {
      console.error("Post-apply totals mismatch.");
      process.exit(1);
    }
  }

  console.log("\nNo invoice metadata saved. Row updates:", result.applied.length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
