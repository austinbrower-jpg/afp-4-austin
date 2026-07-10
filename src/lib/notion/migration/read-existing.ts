import "server-only";
/**
 * The only file in the migration-preview feature that touches SQLite - and
 * it only reads. Builds an ExistingRecordsSnapshot for duplicate detection
 * in dry-run.ts. No repo.insert/update/delete call appears anywhere below;
 * see migration.test.ts's static "no write path" check, which fails the
 * build if one is ever added.
 */
import { initDb, clientRepo, projectRepo, hoursRepo, workLogRepo } from "@/lib/db";
import type { ExistingRecordsSnapshot } from "./types";

export function loadExistingRecordsSnapshot(): ExistingRecordsSnapshot {
  initDb();

  const clients = clientRepo.all();
  const projects = projectRepo.all();
  const hours = hoursRepo.all();
  const workLogs = workLogRepo.all();

  const clientNameById = new Map(clients.map((c) => [c.id, c.name.toLowerCase()]));

  return {
    clientNamesLower: clients.map((c) => c.name.toLowerCase()),
    projectNamesLower: projects.map((p) => p.name.toLowerCase()),
    hoursKeys: hours.map((h) => {
      const clientName = clientNameById.get(h.clientId) ?? "";
      return `${clientName}|${h.date}|${h.startTime}|${h.endTime}`;
    }),
    workLogKeys: workLogs.map((w) => {
      const clientName = clientNameById.get(w.clientId) ?? "";
      return `${clientName}|${w.date}|${w.title.toLowerCase()}`;
    }),
  };
}
