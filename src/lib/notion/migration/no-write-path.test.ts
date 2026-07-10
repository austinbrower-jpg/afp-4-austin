import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Static proof that the dry-run engine and its API route never call a
 * Notion or SQLite write path. This is a source-text scan rather than a
 * mocked runtime call, deliberately: importing read-existing.ts (which
 * pulls in "server-only" repository modules) throws outside a
 * react-server/webpack context, so it can't be exercised directly under
 * plain-node vitest - see read-existing.ts's own comment. A regex/substring
 * scan is a real, fast, deterministic guardrail: it fails the build the
 * moment anyone adds an insert/update/delete or a Notion pages.create/
 * update/pushEntity/pullDatabase/syncEntityNow call anywhere in this tree.
 */

const here = dirname(fileURLToPath(import.meta.url));

const PURE_ENGINE_FILES = [
  "types.ts",
  "source-data.ts",
  "calculations.ts",
  "project-matcher.ts",
  "dry-run.ts",
  "read-existing.ts",
];

const FORBIDDEN_PATTERNS = [
  ".insert(",
  ".update(",
  ".delete(",
  ".remove(",
  "pushEntity",
  "pullDatabase",
  "syncEntityNow",
  "runFullSync",
  "pages.create",
  "pages.update",
  "dataSources.query",
];

describe("migration preview - no write path is invoked", () => {
  it.each(PURE_ENGINE_FILES)("%s contains no Notion/SQLite write call", (file) => {
    const source = readFileSync(join(here, file), "utf8");
    for (const pattern of FORBIDDEN_PATTERNS) {
      expect(source).not.toContain(pattern);
    }
  });

  it("the preview API route contains no write call and only wires the two read-only builders", () => {
    const routePath = join(here, "../../../app/api/notion/migration-preview/route.ts");
    const source = readFileSync(routePath, "utf8");
    for (const pattern of FORBIDDEN_PATTERNS) {
      expect(source).not.toContain(pattern);
    }
    expect(source).toContain("loadExistingRecordsSnapshot");
    expect(source).toContain("buildMigrationDryRun");
  });

  it("read-existing.ts only reads via repo.all(), never a mutation method", () => {
    const source = readFileSync(join(here, "read-existing.ts"), "utf8");
    expect(source).toMatch(/\.all\(\)/);
    expect(source).not.toMatch(/\.(insert|update|delete|remove)\(/);
  });

  it("buildMigrationDryRun's result always self-reports zero writes", () => {
    const source = readFileSync(join(here, "dry-run.ts"), "utf8");
    expect(source).toContain("writesPerformed: false");
    expect(source).toContain("notionWritesPerformed: false");
    expect(source).toContain("sqliteWritesPerformed: false");
  });
});
