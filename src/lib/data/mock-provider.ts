import "server-only";
import {
  clientRepo,
  hoursRepo,
  initDb,
  invoiceRepo,
  knowledgeRepo,
  projectRepo,
  workspaceRepo,
  workLogRepo,
} from "@/lib/db";
import type { AppDataProvider, EntityStore, PersistenceResult } from "./provider-types";

function result<T>(entity: T): PersistenceResult<T> {
  return { entity, mode: "mock", notionPageId: null, notionUrl: null, duplicatePrevented: false };
}
function store<T extends { id: string }>(repo: {
  all(orderBy?: string): T[];
  findById(id: string): T | null;
  insert(entity: T): T;
  update(id: string, entity: T): T;
  remove(id: string): void;
}, orderBy?: string): EntityStore<T> {
  return {
    async list() { return repo.all(orderBy); },
    async findById(id) { return repo.findById(id); },
    async create(entity) { repo.insert(entity); return result(entity); },
    async update(id, entity) { repo.update(id, entity); return result(entity); },
    async remove(id) { repo.remove(id); },
  };
}

export function createMockDataProvider(): AppDataProvider {
  initDb();
  return {
    mode: "mock",
    async workspace() { return workspaceRepo.all()[0] ?? null; },
    clients: store(clientRepo, "name ASC"),
    projects: store(projectRepo, "name ASC"),
    hours: store(hoursRepo, "date DESC, start_time DESC"),
    workLogs: store(workLogRepo, "date DESC"),
    knowledge: store(knowledgeRepo, "title ASC"),
    invoices: store(invoiceRepo, "period_end DESC"),
  };
}
