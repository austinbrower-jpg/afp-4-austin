import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ProjectStatus } from "@/types/domain";

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  active: "Active",
  "on-hold": "On Hold",
  completed: "Completed",
  archived: "Archived",
};

const STATUS_CLASS: Record<ProjectStatus, string> = {
  active:
    "bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/15 dark:text-emerald-400",
  "on-hold":
    "bg-amber-500/10 text-amber-500 dark:bg-amber-500/15 dark:text-amber-400",
  completed:
    "bg-blue-500/10 text-blue-500 dark:bg-blue-500/15 dark:text-blue-400",
  archived: "bg-muted text-muted-foreground",
};

export function ProjectStatusBadge({
  status,
  className,
}: {
  status: ProjectStatus;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn("border-transparent", STATUS_CLASS[status], className)}>
      {PROJECT_STATUS_LABEL[status]}
    </Badge>
  );
}

/** Alias kept for project feature call sites that use StatusBadge. */
export const StatusBadge = ProjectStatusBadge;

export function ColorSwatch({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-3 shrink-0 rounded-full ring-1 ring-foreground/10", className)}
      style={{ backgroundColor: color }}
    />
  );
}

export const PROJECT_STATUS_OPTIONS: ProjectStatus[] = [
  "active",
  "on-hold",
  "completed",
  "archived",
];

/** Backward-compatible names used by projects feature selects. */
export const STATUS_OPTIONS = PROJECT_STATUS_OPTIONS;
export const STATUS_LABEL = PROJECT_STATUS_LABEL;

export const DEFAULT_PROJECT_COLOR = "#6366f1";
export const PROJECT_COLOR_PRESETS = [
  "#6366f1",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#0ea5e9",
  "#a855f7",
  "#ec4899",
  "#64748b",
];
