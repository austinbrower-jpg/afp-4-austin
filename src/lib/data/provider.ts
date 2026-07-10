import "server-only";
import type { AppDataProvider } from "./provider-types";
import { getAppDataSource } from "./runtime";

/**
 * Critical Vercel boundary: the SQLite module is imported only after runtime
 * mode selects mock. Notion production never evaluates the SQLite client.
 */
export async function getDataProvider(): Promise<AppDataProvider> {
  const mode = getAppDataSource();
  if (mode === "notion") {
    const { createNotionDataProvider } = await import("@/lib/notion/native-provider-server");
    return createNotionDataProvider();
  }
  const { createMockDataProvider } = await import("./mock-provider");
  return createMockDataProvider();
}
