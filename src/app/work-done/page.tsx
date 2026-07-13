import { connection } from "next/server";
import { getDataProvider } from "@/lib/data/provider";
import { WorkDoneList } from "@/features/work-done/components/work-done-list";
import { NotionSourceBanner } from "@/components/shared/notion-source-banner";

export default async function WorkDonePage() {
  await connection();
  const provider = await getDataProvider();
  const [workLogs, projects] = await Promise.all([provider.workLogs.list(), provider.projects.list()]);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Work Done</h1>
        <p className="text-muted-foreground">Document internal work and independently controlled client-facing descriptions.</p>
      </div>
      {provider.mode === "notion" && <NotionSourceBanner entityLabel="work log" />}
      <WorkDoneList initialWorkLogs={workLogs} projects={projects} dataSourceMode={provider.mode} />
    </div>
  );
}
