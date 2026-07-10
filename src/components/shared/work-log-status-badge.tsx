import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { WorkLogStatus } from "@/types/domain";

export const WORK_LOG_STATUS_OPTIONS: { value: WorkLogStatus; label: string }[] = [
  { value: "not-started", label: "Not started" },
  { value: "in-progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
];

export const WORK_LOG_STATUS_LABEL: Record<WorkLogStatus, string> = {
  "not-started": "Not started",
  "in-progress": "In progress",
  blocked: "Blocked",
  done: "Done",
};

const STATUS_CLASS: Record<WorkLogStatus, string> = {
  "not-started": "bg-muted text-muted-foreground border-transparent",
  "in-progress": "bg-blue-500/15 text-blue-500 border-blue-500/20 dark:bg-blue-500/20 dark:text-blue-400",
  blocked: "bg-red-500/15 text-red-500 border-red-500/20 dark:bg-red-500/20 dark:text-red-400",
  done: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400",
};

export function WorkLogStatusBadge({
  status,
  className,
}: {
  status: WorkLogStatus;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn("border-transparent", STATUS_CLASS[status], className)}>
      {WORK_LOG_STATUS_LABEL[status]}
    </Badge>
  );
}

/** Alias kept for call sites that already use StatusBadge for work logs. */
export const StatusBadge = WorkLogStatusBadge;

/** Backward-compatible names used by work-done feature selects. */
export const STATUS_OPTIONS = WORK_LOG_STATUS_OPTIONS;
export const STATUS_LABEL = WORK_LOG_STATUS_LABEL;
