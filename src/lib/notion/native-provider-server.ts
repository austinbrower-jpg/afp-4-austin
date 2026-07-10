import "server-only";
import { getNotionClient } from "./client";
import { getNotionConfig } from "./config";
import { NativeNotionProvider } from "./native-provider";
import { DataProviderError, type AppDataProvider } from "@/lib/data/provider-types";

export function createNotionDataProvider(): AppDataProvider {
  const notion = getNotionClient();
  const config = getNotionConfig();
  if (!notion) throw new DataProviderError("NOTION_API_KEY is required in notion mode.", "configuration", 503);
  return new NativeNotionProvider(notion, config.databases);
}
