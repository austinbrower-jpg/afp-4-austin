import "server-only";
import { generateMockDataset } from "@/lib/mock-data/generate";
import { workspaceRepo } from "./repositories/workspaces";
import { clientRepo } from "./repositories/clients";
import { projectRepo } from "./repositories/projects";
import { hoursRepo } from "./repositories/hours";
import { workLogRepo } from "./repositories/worklogs";
import { knowledgeRepo } from "./repositories/knowledge";
import { invoiceRepo } from "./repositories/invoices";

let seeded = false;

/**
 * Seeds the local SQLite cache with representative mock data on first run,
 * so every module is populated before Notion sync is configured. Idempotent
 * and cheap after the first call (checks a table count, not a fixed flag).
 */
export function ensureSeeded(): void {
  if (seeded) return;
  seeded = true;

  if (workspaceRepo.count() > 0) return;

  const data = generateMockDataset();

  workspaceRepo.insert(data.workspace);
  clientRepo.insert(data.client);
  for (const p of data.projects) projectRepo.insert(p);
  for (const h of data.hoursEntries) hoursRepo.insert(h);
  for (const w of data.workLogs) workLogRepo.insert(w);
  for (const k of data.knowledgePages) knowledgeRepo.insert(k);
  for (const i of data.invoiceReports) invoiceRepo.insert(i);
}
