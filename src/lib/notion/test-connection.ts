import "server-only";
import { getNotionClient } from "./client";
import { isNotionConfigured } from "./config";

export interface NotionConnectionTestResult {
  ok: boolean;
  configured: boolean;
  botId?: string;
  workspaceName?: string;
  error?: string;
}

/**
 * Verifies NOTION_API_KEY is valid by calling `users.me`, a read-only
 * endpoint that only identifies the integration - it never lists, queries,
 * or writes to any database, so it's safe to call even before any
 * NOTION_DATABASE_* id is configured.
 */
export async function testNotionConnection(): Promise<NotionConnectionTestResult> {
  if (!isNotionConfigured()) {
    return { ok: false, configured: false, error: "NOTION_API_KEY is not set." };
  }

  const notion = getNotionClient();
  if (!notion) {
    return { ok: false, configured: false, error: "NOTION_API_KEY is not set." };
  }

  try {
    const me = await notion.users.me({});
    const workspaceName =
      "bot" in me && me.bot && "workspace_name" in me.bot
        ? (me.bot.workspace_name ?? undefined)
        : undefined;
    return { ok: true, configured: true, botId: me.id, workspaceName };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error contacting Notion";
    return { ok: false, configured: true, error: message };
  }
}
