export type AppDataSourceMode = "mock" | "notion";

export const REQUIRED_NOTION_ENV_VARS = [
  "NOTION_API_KEY",
  "NOTION_DATABASE_CLIENTS",
  "NOTION_DATABASE_PROJECTS",
  "NOTION_DATABASE_HOURS",
  "NOTION_DATABASE_WORKLOGS",
  "NOTION_DATABASE_KNOWLEDGE",
  "NOTION_DATABASE_INVOICES",
] as const;

export interface RuntimeEnvironment {
  APP_DATA_SOURCE?: string;
  NOTION_SYNC_ENABLED?: string;
  VERCEL_ENV?: string;
  VERCEL_DEPLOYMENT_PROTECTION?: string;
  APP_ACCESS_PASSWORD?: string;
  [key: string]: string | undefined;
}
export interface RuntimeConfigResult {
  mode: AppDataSourceMode;
  isVercel: boolean;
  isVercelProduction: boolean;
  syncEnabled: boolean;
  sqliteAllowed: boolean;
  accessProtection: "basic-auth" | "vercel-deployment-protection" | "development-only";
  missingEnvironmentVariables: string[];
  errors: string[];
  warnings: string[];
  productionReady: boolean;
}

export function parseDataSourceMode(value: string | undefined): AppDataSourceMode {
  if (value === undefined || value === "") return "mock";
  if (value === "mock" || value === "notion") return value;
  throw new Error(`APP_DATA_SOURCE must be "mock" or "notion"; received "${value}".`);
}

export function resolveRuntimeConfig(env: RuntimeEnvironment): RuntimeConfigResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let mode: AppDataSourceMode = "mock";
  try {
    mode = parseDataSourceMode(env.APP_DATA_SOURCE);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "APP_DATA_SOURCE is invalid.");
  }

  const isVercel = Boolean(env.VERCEL_ENV);
  const isVercelProduction = env.VERCEL_ENV === "production";
  const syncEnabled = env.NOTION_SYNC_ENABLED === "true";
  const missingEnvironmentVariables = mode === "notion"
    ? REQUIRED_NOTION_ENV_VARS.filter((name) => !env[name])
    : [];

  if (isVercelProduction && mode !== "notion") {
    errors.push("Vercel production refuses APP_DATA_SOURCE=mock. Set APP_DATA_SOURCE=notion.");
  }
  if (mode === "notion" && missingEnvironmentVariables.length > 0) {
    errors.push(`Notion mode is missing: ${missingEnvironmentVariables.join(", ")}.`);
  }
  if (syncEnabled) {
    errors.push("NOTION_SYNC_ENABLED must remain false; Notion-native mode uses targeted writes, not general sync.");
  }

  const hasBasicAuth = Boolean(env.APP_ACCESS_PASSWORD);
  const hasVercelProtection = env.VERCEL_DEPLOYMENT_PROTECTION === "true";
  const accessProtection = hasBasicAuth
    ? "basic-auth"
    : hasVercelProtection
      ? "vercel-deployment-protection"
      : "development-only";
  if (isVercelProduction && !hasBasicAuth && !hasVercelProtection) {
    errors.push(
      "Production access protection is missing. Configure APP_ACCESS_PASSWORD or confirm Vercel Deployment Protection with VERCEL_DEPLOYMENT_PROTECTION=true.",
    );
  }
  if (!isVercelProduction && !hasBasicAuth && !hasVercelProtection) {
    warnings.push("No application access password is configured; this is acceptable only for local development.");
  }
  if (mode === "mock") {
    warnings.push("Mock mode uses local SQLite and must not be used for Vercel production.");
  }

  return {
    mode,
    isVercel,
    isVercelProduction,
    syncEnabled,
    sqliteAllowed: mode === "mock",
    accessProtection,
    missingEnvironmentVariables,
    errors,
    warnings,
    productionReady: errors.length === 0 && (!isVercelProduction || mode === "notion"),
  };
}

export function assertRuntimeConfig(result: RuntimeConfigResult): RuntimeConfigResult {
  if (result.errors.length > 0) throw new Error(result.errors.join(" "));
  return result;
}
