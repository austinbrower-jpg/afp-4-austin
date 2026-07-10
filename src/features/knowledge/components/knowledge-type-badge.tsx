import {
  BookOpen,
  StickyNote,
  Workflow,
  Microscope,
  NotebookPen,
  Lightbulb,
  ListChecks,
  Library,
  FileStack,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { KnowledgeType } from "@/types/domain";
import { TYPE_LABELS } from "../lib/slugs";

export const TYPE_ICONS: Record<KnowledgeType, LucideIcon> = {
  documentation: BookOpen,
  notes: StickyNote,
  "flow-map": Workflow,
  research: Microscope,
  "meeting-notes": NotebookPen,
  idea: Lightbulb,
  sop: ListChecks,
  reference: Library,
  "project-note": FileStack,
};

interface KnowledgeTypeBadgeProps {
  type: KnowledgeType;
  className?: string;
}

export function KnowledgeTypeBadge({ type, className }: KnowledgeTypeBadgeProps) {
  const Icon = TYPE_ICONS[type];
  return (
    <Badge variant="outline" className={className}>
      <Icon />
      {TYPE_LABELS[type]}
    </Badge>
  );
}
