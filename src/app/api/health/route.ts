import { NextResponse } from "next/server";
import { getRuntimeConfig } from "@/lib/data/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const config = getRuntimeConfig();
  return NextResponse.json(
    {
      ok: config.errors.length === 0,
      dataSource: config.mode,
      sqliteAllowed: config.sqliteAllowed,
      notionConfigured: config.mode === "notion" && config.missingEnvironmentVariables.length === 0,
      generalSyncEnabled: config.syncEnabled,
      accessProtection: config.accessProtection,
      environment: config.isVercelProduction ? "vercel-production" : config.isVercel ? "vercel-preview" : "local",
      errors: config.errors,
      warnings: config.warnings,
    },
    {
      status: config.errors.length === 0 ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
