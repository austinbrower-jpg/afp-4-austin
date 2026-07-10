"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ListTodo } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PriorityBadge, WorkLogStatusBadge } from "./badges";
import type { DashboardSummary } from "../api";

export function UpcomingTasks({
  summary,
  isLoading,
}: {
  summary: DashboardSummary | undefined;
  isLoading: boolean;
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ListTodo className="size-4 text-muted-foreground" />
          Upcoming Tasks
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading || !summary ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))
        ) : summary.upcomingTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing outstanding.</p>
        ) : (
          summary.upcomingTasks.map((task) => (
            <Link
              key={task.id}
              href={`/work-done/${task.id}`}
              className="flex items-start justify-between gap-3 rounded-lg border border-transparent px-2 py-1.5 -mx-2 transition-colors hover:border-border hover:bg-muted/40"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{task.title}</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <PriorityBadge priority={task.priority} />
                  <span className="text-xs text-muted-foreground">
                    {format(parseISO(task.date), "MMM d")}
                  </span>
                </div>
              </div>
              <WorkLogStatusBadge status={task.status} />
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
