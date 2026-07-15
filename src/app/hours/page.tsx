import { connection } from "next/server";
import { getDataProvider } from "@/lib/data/provider";
import { HoursWorkspace } from "@/features/hours/components/hours-workspace";
import { NotionSourceBanner } from "@/components/shared/notion-source-banner";

export default async function HoursPage() {
  await connection();
  const provider = await getDataProvider();
  const workLogsForSummary = provider.workLogsForSummary
    ? provider.workLogsForSummary()
    : provider.workLogs.list();
  const [clients, projects, workLogs] = await Promise.all([
    provider.clients.list(), provider.projects.list(), workLogsForSummary,
  ]);
  const client = clients[0];
  return (
    <div className="flex flex-col gap-4">
      {provider.mode === "notion" && <NotionSourceBanner entityLabel="hours ledger" />}
      <HoursWorkspace
        dataSourceMode={provider.mode}
        projects={projects.map((project) => ({ id: project.id, name: project.name }))}
        workLogs={workLogs.map((work) => ({ id: work.id, title: work.title, date: work.date }))}
        defaultHourlyRate={client?.defaultHourlyRate ?? 0}
      />
    </div>
  );
}
