import { ProjectDetailView } from "@/features/projects/components/project-detail-view";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProjectDetailView id={id} />;
}
