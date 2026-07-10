import { notFound } from "next/navigation";
import { isValidSlug } from "@/features/knowledge/lib/slugs";
import { KnowledgeTypeView } from "@/features/knowledge/components/knowledge-type-view";

export default async function KnowledgeTypePage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  if (!isValidSlug(type)) notFound();

  return <KnowledgeTypeView slug={type} />;
}
