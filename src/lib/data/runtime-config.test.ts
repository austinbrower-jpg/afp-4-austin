import { describe, expect, it } from "vitest";
import { assertRuntimeConfig, parseDataSourceMode, resolveRuntimeConfig } from "./runtime-config";

const notionEnv = {
  APP_DATA_SOURCE: "notion",
  NOTION_API_KEY: "secret",
  NOTION_DATABASE_CLIENTS: "clients",
  NOTION_DATABASE_PROJECTS: "projects",
  NOTION_DATABASE_HOURS: "hours",
  NOTION_DATABASE_WORKLOGS: "worklogs",
  NOTION_DATABASE_KNOWLEDGE: "knowledge",
  NOTION_DATABASE_INVOICES: "invoices",
  NOTION_SYNC_ENABLED: "false",
};

describe("runtime mode selection", () => {
  it("defaults local development to mock mode", () => {
    expect(parseDataSourceMode(undefined)).toBe("mock");
  });

  it("accepts only explicit mock and notion values", () => {
    expect(parseDataSourceMode("mock")).toBe("mock");
    expect(parseDataSourceMode("notion")).toBe("notion");
    expect(() => parseDataSourceMode("sqlite")).toThrow(/APP_DATA_SOURCE/);
  });

  it("refuses mock mode in Vercel production", () => {
    const result = resolveRuntimeConfig({
      APP_DATA_SOURCE: "mock",
      VERCEL_ENV: "production",
      VERCEL_DEPLOYMENT_PROTECTION: "true",
    });
    expect(result.productionReady).toBe(false);
    expect(() => assertRuntimeConfig(result)).toThrow(/refuses APP_DATA_SOURCE=mock/);
  });

  it("requires every Notion database in notion mode", () => {
    const result = resolveRuntimeConfig({ APP_DATA_SOURCE: "notion", NOTION_API_KEY: "secret" });
    expect(result.missingEnvironmentVariables).toContain("NOTION_DATABASE_HOURS");
    expect(result.productionReady).toBe(false);
  });

  it("accepts a protected Vercel Notion deployment with sync disabled", () => {
    const result = resolveRuntimeConfig({
      ...notionEnv,
      VERCEL_ENV: "production",
      VERCEL_DEPLOYMENT_PROTECTION: "true",
    });
    expect(result.errors).toEqual([]);
    expect(result.sqliteAllowed).toBe(false);
    expect(result.productionReady).toBe(true);
  });

  it("rejects the general sync engine even in notion mode", () => {
    const result = resolveRuntimeConfig({ ...notionEnv, NOTION_SYNC_ENABLED: "true" });
    expect(result.errors.join(" ")).toMatch(/must remain false/);
  });

  it("requires production access protection", () => {
    const result = resolveRuntimeConfig({ ...notionEnv, VERCEL_ENV: "production" });
    expect(result.errors.join(" ")).toMatch(/access protection/i);
  });
});
