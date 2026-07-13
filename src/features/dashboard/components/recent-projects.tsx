"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { FolderKanban } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectStatusBadge } from "@/components/shared/project-status-badge";
import type { DashboardSummary } from "../api";

export function RecentProjects({
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
          <FolderKanban className="size-4 text-muted-foreground" />
          Recent Projects
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading || !summary ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))
        ) : summary.recentProjects.length === 0 ? (
          <p className="text-sm text-muted-foreground">No projects yet.</p>
        ) : (
          summary.recentProjects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="flex items-start justify-between gap-3 rounded-lg border border-transparent px-2 py-1.5 -mx-2 transition-colors hover:border-border hover:bg-muted/40"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{project.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  Updated {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}
                </p>
              </div>
              <ProjectStatusBadge status={project.status} className="shrink-0" />
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
