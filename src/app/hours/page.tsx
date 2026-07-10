import { initDb } from "@/lib/db";
import { clientRepo } from "@/lib/db/repositories/clients";
import { listProjectsByClient } from "@/lib/db/repositories/projects";
import { workLogRepo } from "@/lib/db/repositories/worklogs";
import { HoursWorkspace } from "@/features/hours/components/hours-workspace";

/**
 * Server component: resolves the current client, project list, and work
 * log list directly from the DB (this app is single-tenant, so we use the
 * first seeded workspace/client rather than building a selector), then
 * hands them to the client-side workspace as picker options.
 */
export default async function HoursPage() {
  initDb();

  const client = clientRepo.all()[0];
  const projects = client ? listProjectsByClient(client.id) : [];
  const workLogs = workLogRepo.all();

  return (
    <HoursWorkspace
      projects={projects.map((p) => ({ id: p.id, name: p.name }))}
      workLogs={workLogs.map((w) => ({ id: w.id, title: w.title, date: w.date }))}
      defaultHourlyRate={client?.defaultHourlyRate ?? 0}
    />
  );
}
