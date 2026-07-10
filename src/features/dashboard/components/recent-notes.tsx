"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { StickyNote } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardSummary } from "../api";

export function RecentNotes({
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
          <StickyNote className="size-4 text-muted-foreground" />
          Recent Notes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading || !summary ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))
        ) : summary.recentNotes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notes yet.</p>
        ) : (
          summary.recentNotes.map((note) => (
            <Link
              key={note.id}
              href={`/knowledge/page/${note.id}`}
              className="flex items-start justify-between gap-3 rounded-lg border border-transparent px-2 py-1.5 -mx-2 transition-colors hover:border-border hover:bg-muted/40"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{note.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  Updated {formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true })}
                </p>
              </div>
              <Badge variant="outline" className="shrink-0 capitalize">
                {note.type.replace("-", " ")}
              </Badge>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
