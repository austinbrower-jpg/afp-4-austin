import { connection } from "next/server";
import { getDataProvider } from "@/lib/data/provider";
import { HoursWorkspace } from "@/features/hours/components/hours-workspace";

export default async function HoursPage() {
  await connection();
  const provider = await getDataProvider();
  const [clients, projects, workLogs] = await Promise.all([
    provider.clients.list(), provider.projects.list(), provider.workLogs.list(),
  ]);
  const client = clients[0];
  return <HoursWorkspace
    dataSourceMode={provider.mode}
    projects={projects.map((project) => ({ id: project.id, name: project.name }))}
    workLogs={workLogs.map((work) => ({ id: work.id, title: work.title, date: work.date }))}
    defaultHourlyRate={client?.defaultHourlyRate ?? 0}
  />;
}
