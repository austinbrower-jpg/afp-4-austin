import type {
  Client,
  HoursEntry,
  InvoiceReport,
  KnowledgePage,
  Project,
  WorkLog,
  Workspace,
} from "@/types/domain";
import type { AppDataSourceMode } from "./runtime-config";

export interface PersistenceResult<T> {
  entity: T;
  mode: AppDataSourceMode;
  notionPageId: string | null;
  notionUrl: string | null;
  duplicatePrevented: boolean;
}
export interface EntityStore<T extends { id: string }> {
  list(): Promise<T[]>;
  findById(id: string): Promise<T | null>;
  create(entity: T): Promise<PersistenceResult<T>>;
  update(id: string, entity: T): Promise<PersistenceResult<T>>;
  remove(id: string): Promise<void>;
}

export interface AppDataProvider {
  mode: AppDataSourceMode;
  workspace(): Promise<Workspace | null>;
  clients: EntityStore<Client>;
  projects: EntityStore<Project>;
  hours: EntityStore<HoursEntry>;
  workLogs: EntityStore<WorkLog>;
  /** Lightweight structured rows for labels/counts; omits Work Done page-body discovery. */
  workLogsForSummary?(): Promise<WorkLog[]>;
  knowledge: EntityStore<KnowledgePage>;
  /** Optional lightweight projection for report composition; omits private page-body block crawls. */
  knowledgeForReporting?(): Promise<KnowledgePage[]>;
  invoices: EntityStore<InvoiceReport>;
}

export class DataProviderError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "configuration"
      | "not-found"
      | "duplicate"
      | "schema"
      | "notion-api"
      | "write-not-supported",
    public readonly status: number,
    public readonly details: string[] = [],
  ) {
    super(message);
    this.name = "DataProviderError";
  }
}
