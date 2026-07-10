import "server-only";
import { Client } from "@notionhq/client";
import { getNotionConfig } from "./config";

let cachedClient: Client | null = null;
let cachedKey: string | null = null;

/** Returns a configured Notion client, or null if NOTION_API_KEY is unset. */
export function getNotionClient(): Client | null {
  const { apiKey } = getNotionConfig();
  if (!apiKey) return null;
  if (cachedClient && cachedKey === apiKey) return cachedClient;
  cachedClient = new Client({ auth: apiKey });
  cachedKey = apiKey;
  return cachedClient;
}
