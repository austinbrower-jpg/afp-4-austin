import { notFound } from "next/navigation";
import {
  hoursRepo,
  initDb,
  knowledgeRepo,
  projectRepo,
  workLogRepo,
} from "@/lib/db";
import { WorkLogDetail } from "@/features/work-done/components/work-log-detail";

interface WorkLogPageProps {
  params: Promise<{ id: string }>;
}

export default async function WorkLogPage({ params }: WorkLogPageProps) {
  const { id } = await params;
  initDb();

  const workLog = workLogRepo.findById(id);
  if (!workLog) {
    notFound();
  }

  const projects = projectRepo.all("name ASC");
  const hours = hoursRepo.all("date DESC");
  const knowledge = knowledgeRepo.all("title ASC");

  return (
    <WorkLogDetail
      workLog={workLog}
      projects={projects}
      hours={hours}
      knowledge={knowledge}
    />
  );
}
