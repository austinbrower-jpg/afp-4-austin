import "server-only";
import { ensureSeeded } from "./seed";

export * from "./client";
export * from "./repository";
export { ensureSeeded } from "./seed";
export * from "./repositories/workspaces";
export * from "./repositories/clients";
export * from "./repositories/projects";
export * from "./repositories/hours";
export * from "./repositories/worklogs";
export * from "./repositories/knowledge";
export * from "./repositories/invoices";
export * from "./repositories/sync";

/** Call at the top of every route handler before touching repositories. */
export function initDb(): void {
  ensureSeeded();
}
