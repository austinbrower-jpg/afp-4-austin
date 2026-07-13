/**
 * Read-only Notion fetch helpers for July 8–10 relation backfill.
 */
import type { NotionWriteClient } from "../migration/one-time-import";
import type { LiveNotionRow } from "./preview";

export interface BackfillDatabaseIds {
  client: string | null;
  project: string | null;
  hours: string | null;
  worklog: string | null;
}

export interface LiveProjectRow {
  id: string;
  url?: string;
  name: string;
  clientIds: string[];
}

export interface LiveClientRow {
  id: string;
  url?: string;
  name: string;
}

function text(prop: unknown): string {
  const p = prop as { rich_text?: Array<{ plain_text?: string }>; title?: Array<{ plain_text?: string }> };
  const arr = p?.rich_text ?? p?.title;
  return arr?.map((t) => t.plain_text ?? "").join("") ?? "";
}

function select(prop: unknown): string | null {
  return (prop as { select?: { name?: string } })?.select?.name ?? null;
}

function relationIds(prop: unknown): string[] {
  return ((prop as { relation?: Array<{ id: string }> })?.relation ?? []).map((r) => r.id);
}

function checkbox(prop: unknown): boolean {
  return (prop as { checkbox?: boolean })?.checkbox === true;
}

export async function resolveDataSourceId(
  notion: NotionWriteClient,
  databaseId: string | null,
): Promise<string | null> {
  if (!databaseId) return null;
  const database = await notion.databases.retrieve({ database_id: databaseId });
  return database.data_sources?.[0]?.id ?? null;
}

export async function queryAllPages(
  notion: NotionWriteClient,
  dataSourceId: string,
): Promise<Array<{ id: string; url?: string; properties?: Record<string, unknown> }>> {
  const results: Array<{ id: string; url?: string; properties?: Record<string, unknown> }> = [];
  let cursor: string | undefined;
  do {
    const page = await notion.dataSources.query({
      data_source_id: dataSourceId,
      start_cursor: cursor,
    });
    results.push(...page.results);
    cursor = page.has_more ? page.next_cursor ?? undefined : undefined;
  } while (cursor);
  return results;
}

const JULY_RANGE = (date: string) => date >= "2026-07-08" && date <= "2026-07-10";

export async function fetchLiveJulyHoursAndWork(
  notion: NotionWriteClient,
  ids: BackfillDatabaseIds,
): Promise<LiveNotionRow[]> {
  const liveRows: LiveNotionRow[] = [];
  const hoursDs = await resolveDataSourceId(notion, ids.hours);
  const workDs = await resolveDataSourceId(notion, ids.worklog);
  if (!hoursDs || !workDs) return liveRows;

  const projectDs = await resolveDataSourceId(notion, ids.project);
  const projectPages = projectDs ? await queryAllPages(notion, projectDs) : [];
  const projectNameById = new Map<string, string>();
  for (const page of projectPages) {
    const props = page.properties ?? {};
    projectNameById.set(page.id, text(props.Name) || text(props["Name"]));
  }

  const clientDs = await resolveDataSourceId(notion, ids.client);
  const clientPages = clientDs ? await queryAllPages(notion, clientDs) : [];
  const clientNameById = new Map<string, string>();
  for (const page of clientPages) {
    const props = page.properties ?? {};
    clientNameById.set(page.id, text(props.Name) || text(props["Name"]));
  }

  for (const page of await queryAllPages(notion, hoursDs)) {
    const props = page.properties ?? {};
    const dateText = text(props.Date) || text(props["Date"]);
    const date = dateText.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? "";
    if (!JULY_RANGE(date)) continue;
    const projectIds = relationIds(props.Project);
    const clientIds = relationIds(props.Client);
    liveRows.push({
      id: page.id,
      url: page.url,
      entity: "hours",
      date,
      startTime: text(props["Start Time"]),
      endTime: text(props["End Time"]),
      migrationKey: text(props["Migration Key"]) || null,
      sessionId: text(props["Session ID"]) || null,
      billingStatus: select(props["Billing Status"]),
      relatedWorkDoneIds: relationIds(props["Related Work Done"]),
      billable: checkbox(props.Billable),
      projectId: projectIds[0] ?? null,
      projectName: projectIds[0] ? projectNameById.get(projectIds[0]) ?? null : null,
      clientId: clientIds[0] ?? null,
      clientName: clientIds[0] ? clientNameById.get(clientIds[0]) ?? null : null,
    });
  }

  for (const page of await queryAllPages(notion, workDs)) {
    const props = page.properties ?? {};
    const date = (props.Date as { date?: { start?: string } })?.date?.start ?? "";
    if (!JULY_RANGE(date)) continue;
    const projectIds = relationIds(props.Project);
    const clientIds = relationIds(props.Client);
    liveRows.push({
      id: page.id,
      url: page.url,
      entity: "work-done",
      date,
      title: text(props.Title),
      workLogId: text(props["Work Log ID"]) || null,
      approvalStatus: select(props["Approval Status"]),
      relatedHoursIds: relationIds(props["Related Hours"]),
      projectId: projectIds[0] ?? null,
      projectName: projectIds[0] ? projectNameById.get(projectIds[0]) ?? null : null,
      clientId: clientIds[0] ?? null,
      clientName: clientIds[0] ? clientNameById.get(clientIds[0]) ?? null : null,
    });
  }

  return liveRows;
}

export async function fetchLiveClients(
  notion: NotionWriteClient,
  clientDatabaseId: string | null,
): Promise<LiveClientRow[]> {
  const ds = await resolveDataSourceId(notion, clientDatabaseId);
  if (!ds) return [];
  return (await queryAllPages(notion, ds)).map((page) => ({
    id: page.id,
    url: page.url,
    name: text(page.properties?.Name) || text(page.properties?.["Name"]),
  }));
}

export async function fetchLiveProjects(
  notion: NotionWriteClient,
  projectDatabaseId: string | null,
): Promise<LiveProjectRow[]> {
  const ds = await resolveDataSourceId(notion, projectDatabaseId);
  if (!ds) return [];
  return (await queryAllPages(notion, ds)).map((page) => ({
    id: page.id,
    url: page.url,
    name: text(page.properties?.Name) || text(page.properties?.["Name"]),
    clientIds: relationIds(page.properties?.Client),
  }));
}

/** Collect Session ID and Work Log ID values across entire databases (duplicate guard). */
export async function fetchAllIdentityIds(
  notion: NotionWriteClient,
  ids: BackfillDatabaseIds,
): Promise<{ sessionIds: Map<string, string>; workLogIds: Map<string, string> }> {
  const sessionIds = new Map<string, string>();
  const workLogIds = new Map<string, string>();
  const hoursDs = await resolveDataSourceId(notion, ids.hours);
  const workDs = await resolveDataSourceId(notion, ids.worklog);
  if (hoursDs) {
    for (const page of await queryAllPages(notion, hoursDs)) {
      const sid = text(page.properties?.["Session ID"]);
      if (sid) sessionIds.set(sid, page.id);
    }
  }
  if (workDs) {
    for (const page of await queryAllPages(notion, workDs)) {
      const wid = text(page.properties?.["Work Log ID"]);
      if (wid) workLogIds.set(wid, page.id);
    }
  }
  return { sessionIds, workLogIds };
}
