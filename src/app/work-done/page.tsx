import { initDb, projectRepo, workLogRepo } from "@/lib/db";
import { WorkDoneList } from "@/features/work-done/components/work-done-list";

export default async function WorkDonePage() {
  initDb();
  const workLogs = workLogRepo.all("date DESC");
  const projects = projectRepo.all("name ASC");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Work Done</h1>
        <p className="text-muted-foreground">
          Document completed work — engineering notes and the client-facing
          invoice description are tracked separately for every entry.
        </p>
      </div>
      <WorkDoneList initialWorkLogs={workLogs} projects={projects} />
    </div>
  );
}
