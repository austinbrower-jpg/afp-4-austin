import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Priority } from "@/types/domain";

export const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

const PRIORITY_CLASS: Record<Priority, string> = {
  low: "bg-muted text-muted-foreground border-transparent",
  medium: "bg-sky-500/15 text-sky-500 border-sky-500/20 dark:bg-sky-500/20 dark:text-sky-400",
  high: "bg-amber-500/15 text-amber-500 border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400",
  urgent: "bg-red-500/15 text-red-500 border-red-500/20 dark:bg-red-500/20 dark:text-red-400",
};

export function PriorityBadge({
  priority,
  className,
}: {
  priority: Priority;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn("border-transparent", PRIORITY_CLASS[priority], className)}>
      {PRIORITY_LABEL[priority]}
    </Badge>
  );
}

/** Flat list of Priority values for select controls that map over strings. */
export const PRIORITY_VALUES: Priority[] = PRIORITY_OPTIONS.map((o) => o.value);
