import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getDataProvider } from "@/lib/data/provider";
import { WorkLogDetail } from "@/features/work-done/components/work-log-detail";
import { NotionSourceBanner } from "@/components/shared/notion-source-banner";

export default async function WorkLogPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const provider = await getDataProvider();
  const { id } = await params;
  const [workLog, projects, hours, knowledge] = await Promise.all([
    provider.workLogs.findById(id), provider.projects.list(), provider.hours.list(), provider.knowledge.list(),
  ]);
  if (!workLog) notFound();
  return (
    <div className="flex flex-col gap-4">
      {provider.mode === "notion" && <NotionSourceBanner notionUrl={workLog.notionUrl} entityLabel="work log" />}
      <WorkLogDetail workLog={workLog} projects={projects} hours={hours} knowledge={knowledge} dataSourceMode={provider.mode} />
    </div>
  );
}
