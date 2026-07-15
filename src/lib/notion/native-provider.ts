import type { Client as NotionClient } from "@notionhq/client";
import { isValid, parse } from "date-fns";
import type { NotionDatabaseMap } from "./config";
import {
  hoursToNotionProperties,
  invoiceToNotionProperties,
  projectToNotionProperties,
  worklogToNotionProperties,
} from "./mappers";
import {
  mapNotionClient,
  mapNotionHours,
  mapNotionInvoice,
  mapNotionKnowledge,
  mapNotionProject,
  mapNotionWorkLog,
  type NotionPageLike,
} from "./native-mappers";
import { NOTION_PROPERTY_REQUIREMENTS, validateProperties } from "./schema-requirements";
import type { AppDataProvider, EntityStore, PersistenceResult } from "@/lib/data/provider-types";
import { DataProviderError } from "@/lib/data/provider-types";
import type {
  Client,
  HoursEntry,
  InvoiceReport,
  KnowledgePage,
  Project,
  SyncEntityType,
  WorkLog,
  Workspace,
} from "@/types/domain";

type NativeEntity = Client | Project | HoursEntry | WorkLog | KnowledgePage | InvoiceReport;
type DiscoveredPage = {
  id: string;
  title: string;
};

type CachedRead = {
  expiresAt: number;
  value: NativeEntity[];
};

const WORK_DONE_ROOT_TITLE = "Work Done";

function safeNotionError(error: unknown, action: string): DataProviderError {
  console.warn("[notion-read] upstream request failed", {
    action,
    category: error instanceof Error ? error.name : "unexpected",
  });
  return new DataProviderError(`Notion could not complete ${action}.`, "notion-api", 502);
}

function notionResult<T extends NativeEntity>(entity: T, duplicatePrevented = false): PersistenceResult<T> {
  return {
    entity,
    mode: "notion",
    notionPageId: entity.notionPageId,
    notionUrl: entity.notionUrl ?? null,
    duplicatePrevented,
  };
}

function extractNotionText(value: unknown): string {
  const prop = value as { title?: Array<{ plain_text?: string }> | string; rich_text?: Array<{ plain_text?: string }> | string };
  if (typeof prop.title === "string") return prop.title;
  if (typeof prop.rich_text === "string") return prop.rich_text;
  if (Array.isArray(prop.title)) return prop.title.map((item) => item.plain_text ?? "").join("");
  if (Array.isArray(prop.rich_text)) return prop.rich_text.map((item) => item.plain_text ?? "").join("");
  return "";
}

function extractPageTitle(page: { properties?: Record<string, unknown> }): string {
  const props = page.properties ?? {};
  return (
    extractNotionText(props.title) ||
    extractNotionText(props.Title) ||
    extractNotionText(props.Name) ||
    ""
  ).trim();
}

function normalizeWorkLogKey(date: string): string {
  return date;
}

function parseWorkLogDate(title: string): string | null {
  const parsed = parse(title.trim(), "MMMM d, yyyy", new Date());
  return isValid(parsed) ? parsed.toISOString().slice(0, 10) : null;
}

function mergeWorkLogs(base: WorkLog[], overlays: WorkLog[]): WorkLog[] {
  const merged = new Map<string, WorkLog>();

  const upsert = (log: WorkLog) => {
    const key = normalizeWorkLogKey(log.date);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, log);
      return;
    }
    const chooseText = (current: string, next: string) => (next.trim() ? next : current);
    const chooseArray = <T,>(current: T[], next: T[]) => (next.length > 0 ? next : current);
    const chooseId = (current: string | null | undefined, next: string | null | undefined) => next ?? current ?? null;
    const chooseStatus = (current: WorkLog["status"], next: WorkLog["status"]) =>
      current === "not-started" && next !== "not-started" ? next : current;
    const choosePriority = (current: WorkLog["priority"], next: WorkLog["priority"]) =>
      current === "medium" && next !== "medium" ? next : current;
    merged.set(key, {
      ...existing,
      ...log,
      id: existing.id,
      notionPageId: existing.notionPageId ?? log.notionPageId,
      notionDatabaseId: existing.notionDatabaseId ?? log.notionDatabaseId,
      notionUrl: existing.notionUrl ?? log.notionUrl ?? null,
      createdAt: existing.createdAt,
      updatedAt: existing.updatedAt >= log.updatedAt ? existing.updatedAt : log.updatedAt,
      summary: chooseText(existing.summary, log.summary),
      detailedNotes: chooseText(existing.detailedNotes, log.detailedNotes),
      invoiceDescription: chooseText(existing.invoiceDescription, log.invoiceDescription),
      status: chooseStatus(existing.status, log.status),
      priority: choosePriority(existing.priority, log.priority),
      relatedHoursIds: chooseArray(existing.relatedHoursIds, log.relatedHoursIds),
      relatedKnowledgeIds: chooseArray(existing.relatedKnowledgeIds, log.relatedKnowledgeIds),
      evidence: chooseArray(existing.evidence, log.evidence),
      githubLink: chooseId(existing.githubLink, log.githubLink),
      attachments: chooseArray(existing.attachments, log.attachments),
      detailedWorkDescription: chooseText(existing.detailedWorkDescription ?? "", log.detailedWorkDescription ?? ""),
      internalNotes: chooseText(existing.internalNotes ?? "", log.internalNotes ?? ""),
      clientVisible: existing.clientVisible ?? log.clientVisible,
      includeInInvoice: existing.includeInInvoice ?? log.includeInInvoice,
      includeInWorkReport: existing.includeInWorkReport ?? log.includeInWorkReport,
      evidenceLinks: chooseArray(existing.evidenceLinks ?? [], log.evidenceLinks ?? []),
      workLogId: chooseId(existing.workLogId ?? null, log.workLogId ?? null),
      approvalStatus: existing.approvalStatus ?? log.approvalStatus ?? null,
      invoiceReportId: chooseId(existing.invoiceReportId ?? null, log.invoiceReportId ?? null),
      validationWarnings: [...new Set([...(existing.validationWarnings ?? []), ...(log.validationWarnings ?? [])])],
    });
  };

  for (const log of base) upsert(log);
  for (const log of overlays) upsert(log);
  return [...merged.values()].sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
}

export class NativeNotionProvider implements AppDataProvider {
  readonly mode = "notion" as const;
  private readonly dataSourceIds = new Map<SyncEntityType, string>();
  private readonly readCache = new Map<SyncEntityType, CachedRead>();
  private readonly readsInFlight = new Map<SyncEntityType, Promise<NativeEntity[]>>();
  private activeBlockReads = 0;
  private readonly blockReadWaiters: Array<() => void> = [];
  private workDoneRootPagePromise: Promise<string | null> | null = null;

  constructor(private readonly notion: NotionClient, private readonly databases: NotionDatabaseMap) {}

  private databaseId(type: SyncEntityType): string {
    const id = this.databases[type];
    if (!id) throw new DataProviderError(`No Notion database configured for ${type}.`, "configuration", 503);
    return id;
  }

  private async dataSource(type: SyncEntityType): Promise<string> {
    const cached = this.dataSourceIds.get(type);
    if (cached) return cached;
    const databaseId = this.databaseId(type);
    try {
      const database = await this.notion.databases.retrieve({ database_id: databaseId });
      const id = "data_sources" in database ? database.data_sources[0]?.id : undefined;
      if (!id) throw new DataProviderError(`Notion ${type} database has no queryable data source.`, "schema", 503);
      this.dataSourceIds.set(type, id);
      return id;
    } catch (error) {
      if (error instanceof DataProviderError) throw error;
      throw safeNotionError(error, `database lookup (${type})`);
    }
  }

  private async query(type: SyncEntityType): Promise<NotionPageLike[]> {
    const dataSourceId = await this.dataSource(type);
    const pages: NotionPageLike[] = [];
    let cursor: string | undefined;
    try {
      do {
        const response = await this.notion.dataSources.query({
          data_source_id: dataSourceId,
          start_cursor: cursor,
          page_size: 100,
        });
        for (const result of response.results) {
          if (result.object === "page" && "properties" in result) pages.push(result as unknown as NotionPageLike);
        }
        cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
      } while (cursor);
      return pages;
    } catch (error) {
      throw safeNotionError(error, `read (${type})`);
    }
  }

  private async cachedRead<T extends NativeEntity>(
    type: SyncEntityType,
    ttlMs: number,
    load: () => Promise<T[]>,
  ): Promise<T[]> {
    const now = Date.now();
    const cached = this.readCache.get(type);
    if (cached && cached.expiresAt > now) {
      return cached.value as T[];
    }

    const pending = this.readsInFlight.get(type);
    if (pending) return pending as Promise<T[]>;

    const startedAt = Date.now();
    const request = load()
      .then((rows) => {
        if (ttlMs > 0) {
          this.readCache.set(type, { expiresAt: Date.now() + ttlMs, value: rows });
        }
        console.info("[notion-read] completed", {
          entity: type,
          durationMs: Date.now() - startedAt,
          count: rows.length,
        });
        return rows;
      })
      .catch((error) => {
        console.warn("[notion-read] failed", {
          entity: type,
          durationMs: Date.now() - startedAt,
          category: error instanceof DataProviderError ? error.code : "unexpected",
        });
        throw error;
      })
      .finally(() => {
        this.readsInFlight.delete(type);
      });

    this.readsInFlight.set(type, request);
    return request;
  }

  private invalidateRead(type: SyncEntityType): void {
    this.readCache.delete(type);
  }

  private async withBlockReadSlot<T>(read: () => Promise<T>): Promise<T> {
    if (this.activeBlockReads >= 3) {
      await new Promise<void>((resolve) => this.blockReadWaiters.push(resolve));
    }
    this.activeBlockReads += 1;
    try {
      return await read();
    } finally {
      this.activeBlockReads -= 1;
      this.blockReadWaiters.shift()?.();
    }
  }

  private listBlockChildren(blockId: string, cursor?: string) {
    return this.withBlockReadSlot(() => this.notion.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
      page_size: 100,
    }));
  }

  private async workDoneRootPageId(): Promise<string | null> {
    this.workDoneRootPagePromise ??= (async () => {
      try {
        const response = await this.notion.search({
          query: WORK_DONE_ROOT_TITLE,
          filter: { property: "object", value: "page" },
        });
        for (const result of response.results as Array<{ id: string; properties?: Record<string, unknown> }>) {
          const title = extractPageTitle(result);
          if (title === WORK_DONE_ROOT_TITLE) return result.id;
        }
      } catch {
        return null;
      }
      return null;
    })();
    return this.workDoneRootPagePromise;
  }

  private async collectChildPages(blockId: string, seen = new Set<string>()): Promise<DiscoveredPage[]> {
    const pages: DiscoveredPage[] = [];
    let cursor: string | undefined;
    do {
      const response = await this.listBlockChildren(blockId, cursor);
      for (const block of response.results as Array<{ id: string; type: string; has_children?: boolean; [key: string]: unknown }>) {
        if (block.type === "child_page") {
          const child = block.child_page as { title?: string } | undefined;
          const title = child?.title?.trim() ?? "";
          if (!title || seen.has(block.id)) continue;
          seen.add(block.id);
          const isDatedWorkLog = Boolean(parseWorkLogDate(title));
          if (isDatedWorkLog) pages.push({ id: block.id, title });
          // A dated page's descendants are its content, which pageContent reads
          // later. Only traverse non-date containers while looking for more
          // dated Work Done pages.
          if (isDatedWorkLog || !block.has_children) continue;
          try {
            const nested = await this.collectChildPages(block.id, seen);
            pages.push(...nested);
          } catch (error) {
            console.warn("Skipping nested Work Done child page branch.", {
              category: error instanceof Error ? error.name : "unexpected",
            });
          }
          continue;
        }
        if (block.has_children && block.type !== "child_page") {
          try {
            const nested = await this.collectChildPages(block.id, seen);
            pages.push(...nested);
          } catch (error) {
            console.warn("Skipping nested Work Done child page branch.", {
              category: error instanceof Error ? error.name : "unexpected",
            });
          }
        }
      }
      cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
    } while (cursor);
    return pages;
  }

  private async defaultClientId(): Promise<string> {
    return (await this.listClients())[0]?.id ?? "";
  }

  private async pageContent(pageId: string): Promise<string> {
    const lines: string[] = [];
    const visit = async (blockId: string): Promise<void> => {
      let cursor: string | undefined;
      do {
        const response = await this.listBlockChildren(blockId, cursor);
        for (const block of response.results as Array<{ id: string; type: string; has_children?: boolean; [key: string]: unknown }>) {
          if (block.type === "child_page") continue;
          const value = block[block.type as keyof typeof block] as { rich_text?: Array<{ plain_text?: string }>; title?: Array<{ plain_text?: string }> } | undefined;
          const richText = value?.rich_text ?? value?.title;
          const line = Array.isArray(richText) ? richText.map((item) => item.plain_text ?? "").join("").trim() : "";
          if (line) lines.push(line);
          if (block.has_children) await visit(block.id);
        }
        cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
      } while (cursor);
    };
    try {
      await visit(pageId);
      return lines.join("\n\n");
    } catch {
      return "";
    }
  }

  async workspace(): Promise<Workspace> {
    return {
      id: "notion-production",
      name: "AFP Notion Workspace",
      slug: "notion-production",
      notionWorkspaceName: "AFP-Work",
      notionPageId: null,
      notionDatabaseId: null,
      notionUrl: null,
      syncStatus: "synced",
      lastSyncedAt: null,
      notionLastEditedTime: null,
      createdAt: "1970-01-01T00:00:00.000Z",
      updatedAt: "1970-01-01T00:00:00.000Z",
    };
  }

  private listClients(): Promise<Client[]> {
    return this.cachedRead("client", 10_000, async () =>
      (await this.query("client")).map((page) => mapNotionClient(page, { databaseId: this.databaseId("client") })),
    );
  }

  private listProjects(): Promise<Project[]> {
    return this.cachedRead("project", 10_000, async () => {
      const clientId = await this.defaultClientId();
      return (await this.query("project")).map((page) => mapNotionProject(page, { clientId, databaseId: this.databaseId("project") }));
    });
  }

  private listHours(): Promise<HoursEntry[]> {
    // Intentionally no settled-result cache: concurrent callers deduplicate,
    // but every later explicit refresh reads current Notion hours.
    return this.cachedRead("hours", 0, async () => {
      const clientId = await this.defaultClientId();
      return (await this.query("hours")).map((page) => mapNotionHours(page, { clientId, databaseId: this.databaseId("hours") }));
    });
  }

  private listWorkLogs(): Promise<WorkLog[]> {
    return this.cachedRead("worklog", 15_000, async () => {
      const databaseStartedAt = Date.now();
      const clientId = await this.defaultClientId();
      const [dbPages, rootPageId] = await Promise.all([
        this.query("worklog"),
        this.workDoneRootPageId(),
      ]);
      const databaseMs = Date.now() - databaseStartedAt;
      // The database properties are the structured base record. Page-body
      // content is fetched only for dated Work Done overlays below, avoiding
      // a duplicate block-tree request for every database row.
      const dbLogs = dbPages.map((page) => mapNotionWorkLog(page, {
        clientId,
        databaseId: this.databaseId("worklog"),
      }));

      const discoveryStartedAt = Date.now();
      const childPages = rootPageId ? await this.collectChildPages(rootPageId) : [];
      const discoveryMs = Date.now() - discoveryStartedAt;
      const dbLogsByDate = new Map(dbLogs.map((log) => [log.date, log]));
      const pagesNeedingContent = childPages.filter((page) => {
        const date = parseWorkLogDate(page.title);
        if (!date) return false;
        const base = dbLogsByDate.get(date);
        if (!base || base.status !== "done") return true;
        return !(
          base.summary.trim() ||
          base.invoiceDescription.trim() ||
          (base.detailedWorkDescription ?? "").trim()
        );
      });
      const contentStartedAt = Date.now();
      const childLogs = await Promise.allSettled(pagesNeedingContent.map(async (page) => {
        const date = parseWorkLogDate(page.title);
        if (!date) return null;
        const content = await this.pageContent(page.id);
        const syntheticPage: NotionPageLike = {
          id: page.id,
          properties: {
            Title: { title: [{ plain_text: page.title }] },
            Date: { date: { start: date } },
          },
        };
        return mapNotionWorkLog(syntheticPage, {
          clientId,
          databaseId: this.databaseId("worklog"),
          pageContent: content,
        });
      }));
      const contentMs = Date.now() - contentStartedAt;

      const overlays: WorkLog[] = [];
      let skipped = 0;
      for (const settled of childLogs) {
        if (settled.status === "fulfilled" && settled.value) overlays.push(settled.value);
        if (settled.status === "rejected") skipped += 1;
      }
      if (skipped > 0) {
        console.warn("[notion-read] skipped malformed records", { entity: "worklog", count: skipped });
      }
      console.info("[notion-worklog] phases", {
        databaseMs,
        discoveryMs,
        contentMs,
        databaseRecords: dbLogs.length,
        overlayRecords: overlays.length,
        contentPages: pagesNeedingContent.length,
      });

      return mergeWorkLogs(dbLogs, overlays);
    });
  }

  private listKnowledge(): Promise<KnowledgePage[]> {
    return this.cachedRead("knowledge", 15_000, async () => {
      const clientId = await this.defaultClientId();
      const pages = await this.query("knowledge");
      return Promise.all(pages.map(async (page) => mapNotionKnowledge(page, {
        clientId,
        databaseId: this.databaseId("knowledge"),
        pageContent: await this.pageContent(page.id),
      })));
    });
  }

  async knowledgeForReporting(): Promise<KnowledgePage[]> {
    const startedAt = Date.now();
    const clientId = await this.defaultClientId();
    const pages = await this.query("knowledge");
    const rows = pages.map((page) => mapNotionKnowledge(page, {
      clientId,
      databaseId: this.databaseId("knowledge"),
    }));
    console.info("[notion-read] completed", {
      entity: "knowledge-summary",
      durationMs: Date.now() - startedAt,
      count: rows.length,
    });
    return rows;
  }

  private listInvoices(): Promise<InvoiceReport[]> {
    return this.cachedRead("invoice", 10_000, async () => {
      const clientId = await this.defaultClientId();
      return (await this.query("invoice")).map((page) => mapNotionInvoice(page, { clientId, databaseId: this.databaseId("invoice") }));
    });
  }

  private async verifyWriteSchema(type: SyncEntityType): Promise<void> {
    const dataSourceId = await this.dataSource(type);
    try {
      const source = await this.notion.dataSources.retrieve({ data_source_id: dataSourceId });
      const actual = "properties" in source ? source.properties as unknown as Record<string, { type: string }> : {};
      const invalid = validateProperties(actual, NOTION_PROPERTY_REQUIREMENTS[type]).filter((item) => item.status !== "ok");
      if (invalid.length > 0) {
        throw new DataProviderError(
          `Notion ${type} schema is not ready for controlled writes.`,
          "schema",
          409,
          invalid.map((item) => `${item.notionName}: ${item.status}${item.actualType ? ` (${item.actualType})` : ""}`),
        );
      }
    } catch (error) {
      if (error instanceof DataProviderError) throw error;
      throw safeNotionError(error, `schema verification (${type})`);
    }
  }

  private async createPage<T extends NativeEntity>(
    type: SyncEntityType,
    entity: T,
    properties: Record<string, unknown>,
    mapper: (page: NotionPageLike, context: { clientId: string; databaseId: string }) => T,
  ): Promise<PersistenceResult<T>> {
    await this.verifyWriteSchema(type);
    try {
      const page = await this.notion.pages.create({ parent: { database_id: this.databaseId(type) }, properties: properties as never });
      const clientId = "clientId" in entity ? entity.clientId ?? "" : entity.id;
      const saved = mapper(page as unknown as NotionPageLike, { clientId, databaseId: this.databaseId(type) });
      this.invalidateRead(type);
      return notionResult(saved);
    } catch (error) {
      if (error instanceof DataProviderError) throw error;
      throw safeNotionError(error, `create (${type})`);
    }
  }

  private async updatePage<T extends NativeEntity>(
    type: SyncEntityType,
    id: string,
    entity: T,
    properties: Record<string, unknown>,
    mapper: (page: NotionPageLike, context: { clientId: string; databaseId: string }) => T,
  ): Promise<PersistenceResult<T>> {
    await this.verifyWriteSchema(type);
    try {
      const page = await this.notion.pages.update({ page_id: id, properties: properties as never });
      const clientId = "clientId" in entity ? entity.clientId ?? "" : entity.id;
      const saved = mapper(page as unknown as NotionPageLike, { clientId, databaseId: this.databaseId(type) });
      this.invalidateRead(type);
      return notionResult(saved);
    } catch (error) {
      if (error instanceof DataProviderError) throw error;
      throw safeNotionError(error, `update (${type})`);
    }
  }

  private readOnlyStore<T extends { id: string }>(list: () => Promise<T[]>): EntityStore<T> {
    return {
      list,
      async findById(id) { return (await list()).find((item) => item.id === id) ?? null; },
      async create() { throw new DataProviderError("This entity is read-only in Notion mode.", "write-not-supported", 405); },
      async update() { throw new DataProviderError("This entity is read-only in Notion mode.", "write-not-supported", 405); },
      async remove() { throw new DataProviderError("Delete/archive is disabled in Notion mode.", "write-not-supported", 405); },
    };
  }

  get clients(): EntityStore<Client> { return this.readOnlyStore(() => this.listClients()); }

  get projects(): EntityStore<Project> {
    const list = () => this.listProjects();
    return {
      ...this.readOnlyStore(list),
      create: async (entity) => {
        const duplicate = (await list()).find((item) => item.name.trim().toLowerCase() === entity.name.trim().toLowerCase());
        if (duplicate) throw new DataProviderError("A project with this name already exists in Notion.", "duplicate", 409, [duplicate.id]);
        return this.createPage("project", entity, projectToNotionProperties(entity), mapNotionProject);
      },
      update: (id, entity) => this.updatePage("project", id, entity, projectToNotionProperties(entity), mapNotionProject),
    };
  }

  get hours(): EntityStore<HoursEntry> {
    const list = () => this.listHours();
    return {
      ...this.readOnlyStore(list),
      create: async (entity) => {
        const duplicate = (await list()).find((item) =>
          item.date === entity.date && item.startTime === entity.startTime && item.endTime === entity.endTime &&
          item.billable === entity.billable && item.projectId === entity.projectId,
        );
        if (duplicate) throw new DataProviderError("This hours entry is already saved in Notion.", "duplicate", 409, [duplicate.id]);
        return this.createPage("hours", entity, hoursToNotionProperties(entity), mapNotionHours);
      },
      update: (id, entity) => this.updatePage("hours", id, entity, hoursToNotionProperties(entity), mapNotionHours),
    };
  }

  get workLogs(): EntityStore<WorkLog> {
    const list = () => this.listWorkLogs();
    return {
      ...this.readOnlyStore(list),
      create: async (entity) => {
        const duplicate = (await list()).find((item) => item.date === entity.date && item.title.trim().toLowerCase() === entity.title.trim().toLowerCase());
        if (duplicate) throw new DataProviderError("This Work Done entry is already saved in Notion.", "duplicate", 409, [duplicate.id]);
        return this.createPage("worklog", entity, worklogToNotionProperties(entity), mapNotionWorkLog);
      },
      update: (id, entity) => this.updatePage("worklog", id, entity, worklogToNotionProperties(entity), mapNotionWorkLog),
    };
  }

  get knowledge(): EntityStore<KnowledgePage> { return this.readOnlyStore(() => this.listKnowledge()); }

  get invoices(): EntityStore<InvoiceReport> {
    const list = () => this.listInvoices();
    return {
      ...this.readOnlyStore(list),
      create: async (entity) => {
        const duplicate = (await list()).find((item) => item.invoiceNumber === entity.invoiceNumber);
        if (duplicate) throw new DataProviderError("This invoice number already exists in Notion.", "duplicate", 409, [duplicate.id]);
        return this.createPage("invoice", entity, invoiceToNotionProperties(entity), mapNotionInvoice);
      },
      update: (id, entity) => this.updatePage("invoice", id, entity, invoiceToNotionProperties(entity), mapNotionInvoice),
    };
  }
}
