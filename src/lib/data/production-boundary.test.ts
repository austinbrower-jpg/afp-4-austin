import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Notion production boundary", () => {
  it("the Notion provider has no SQLite imports", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/lib/notion/native-provider.ts"), "utf8");
    expect(source).not.toContain("@/lib/db");
    expect(source).not.toContain("better-sqlite3");
  });

  it("SQLite is only dynamically imported after mock mode selection", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/lib/data/provider.ts"), "utf8");
    expect(source).toContain('if (mode === "notion")');
    expect(source).toContain('await import("./mock-provider")');
    expect(source).not.toContain('from "./mock-provider"');
  });

  it("Notion secrets are never referenced by client components", () => {
    const roots = ["src/app", "src/components", "src/features"];
    const clientFiles: string[] = [];
    const visit = (entry: string) => {
      for (const name of fs.readdirSync(entry)) {
        const file = path.join(entry, name);
        const stat = fs.statSync(file);
        if (stat.isDirectory()) visit(file);
        else if (/\.(ts|tsx)$/.test(file) && fs.readFileSync(file, "utf8").startsWith('"use client"')) clientFiles.push(file);
      }
    };
    roots.forEach(visit);
    for (const file of clientFiles) expect(fs.readFileSync(file, "utf8"), file).not.toMatch(/process\.env\.(NOTION_API_KEY|NOTION_DATABASE_)/);
  });
});
