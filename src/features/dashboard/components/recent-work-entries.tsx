"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ClipboardList } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkLogStatusBadge } from "./badges";
import type { DashboardSummary } from "../api";

export function RecentWorkEntries({
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
          <ClipboardList className="size-4 text-muted-foreground" />
          Recent Work Entries
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading || !summary ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))
        ) : summary.recentWorkEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No work entries yet.</p>
        ) : (
          summary.recentWorkEntries.map((entry) => (
            <Link
              key={entry.id}
              href={`/work-done/${entry.id}`}
              className="flex items-start justify-between gap-3 rounded-lg border border-transparent px-2 py-1.5 -mx-2 transition-colors hover:border-border hover:bg-muted/40"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{entry.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {format(parseISO(entry.date), "MMM d, yyyy")}
                  {entry.summary ? ` · ${entry.summary}` : ""}
                </p>
              </div>
              <WorkLogStatusBadge status={entry.status} />
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
