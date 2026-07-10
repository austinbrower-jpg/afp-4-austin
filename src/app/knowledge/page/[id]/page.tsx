import { KnowledgePageView } from "@/features/knowledge/components/knowledge-page-view";

export default async function KnowledgePageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <KnowledgePageView id={id} />;
}
