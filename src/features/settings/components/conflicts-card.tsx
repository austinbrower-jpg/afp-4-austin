"use client";

import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, TriangleAlert } from "lucide-react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useConflicts, useResolveConflict } from "../hooks/use-conflicts";

export function ConflictsCard() {
  const { data: conflicts, isLoading } = useConflicts();
  const { mutate: resolve, isPending, variables } = useResolveConflict();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TriangleAlert className="size-4 text-muted-foreground" />
          Sync Conflicts
        </CardTitle>
        <CardDescription>
          Entries edited both locally and in Notion since the last sync.
        </CardDescription>
        <CardAction>
          <Badge variant={conflicts?.length ? "destructive" : "outline"}>
            {conflicts?.length ?? 0} open
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : !conflicts || conflicts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-8 text-center">
            <CheckCircle2 className="size-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No open conflicts. Everything is in sync.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {conflicts.map((conflict) => {
              const isResolvingThis =
                isPending && variables?.id === conflict.id;
              return (
                <li
                  key={conflict.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-medium capitalize">
                      {conflict.entityType} · {conflict.entityId}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Local updated{" "}
                      {formatDistanceToNow(new Date(conflict.localUpdatedAt), {
                        addSuffix: true,
                      })}{" "}
                      · Notion updated{" "}
                      {formatDistanceToNow(new Date(conflict.notionUpdatedAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isResolvingThis}
                      onClick={() =>
                        resolve({ id: conflict.id, resolution: "kept-local" })
                      }
                    >
                      Keep local
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isResolvingThis}
                      onClick={() =>
                        resolve({ id: conflict.id, resolution: "kept-notion" })
                      }
                    >
                      Keep Notion
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
