import type { Client as NotionClient } from "@notionhq/client";
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

function safeNotionError(error: unknown, action: string): DataProviderError {
  const message = error instanceof Error ? error.message : "Unknown Notion API error";
  return new DataProviderError(`Notion ${action} failed: ${message}`, "notion-api", 502);
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

export class NativeNotionProvider implements AppDataProvider {
  readonly mode = "notion" as const;
  private clientsPromise: Promise<Client[]> | null = null;
  private readonly dataSourceIds = new Map<SyncEntityType, string>();

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

  private async defaultClientId(): Promise<string> {
    return (await this.listClients())[0]?.id ?? "";
  }

  private async pageContent(pageId: string): Promise<string> {
    const lines: string[] = [];
    let cursor: string | undefined;
    try {
      do {
        const response = await this.notion.blocks.children.list({ block_id: pageId, start_cursor: cursor, page_size: 100 });
        for (const block of response.results) {
          if (!("type" in block)) continue;
          const value = block[block.type as keyof typeof block] as { rich_text?: Array<{ plain_text?: string }> } | undefined;
          const line = value?.rich_text?.map((item) => item.plain_text ?? "").join("").trim();
          if (line) lines.push(line);
        }
        cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
      } while (cursor);
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
    this.clientsPromise ??= this.query("client").then((pages) => pages.map((page) => mapNotionClient(page, { databaseId: this.databaseId("client") })));
    return this.clientsPromise;
  }

  private async listProjects(): Promise<Project[]> {
    const clientId = await this.defaultClientId();
    return (await this.query("project")).map((page) => mapNotionProject(page, { clientId, databaseId: this.databaseId("project") }));
  }

  private async listHours(): Promise<HoursEntry[]> {
    const clientId = await this.defaultClientId();
    return (await this.query("hours")).map((page) => mapNotionHours(page, { clientId, databaseId: this.databaseId("hours") }));
  }

  private async listWorkLogs(): Promise<WorkLog[]> {
    const clientId = await this.defaultClientId();
    return (await this.query("worklog")).map((page) => mapNotionWorkLog(page, { clientId, databaseId: this.databaseId("worklog") }));
  }

  private async listKnowledge(): Promise<KnowledgePage[]> {
    const clientId = await this.defaultClientId();
    const pages = await this.query("knowledge");
    return Promise.all(pages.map(async (page) => mapNotionKnowledge(page, {
      clientId,
      databaseId: this.databaseId("knowledge"),
      pageContent: await this.pageContent(page.id),
    })));
  }

  private async listInvoices(): Promise<InvoiceReport[]> {
    const clientId = await this.defaultClientId();
    return (await this.query("invoice")).map((page) => mapNotionInvoice(page, { clientId, databaseId: this.databaseId("invoice") }));
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
      return notionResult(mapper(page as unknown as NotionPageLike, { clientId, databaseId: this.databaseId(type) }));
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
