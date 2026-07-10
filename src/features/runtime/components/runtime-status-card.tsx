"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Cloud, Database, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { runtimeApi } from "../api";

export function RuntimeStatusCard() {
  const queryClient = useQueryClient();
  const { data, isFetching } = useQuery({ queryKey: ["runtime-status"], queryFn: runtimeApi.status });
  const notion = data?.dataSource === "notion";
  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">{notion ? <Cloud className="size-4" /> : <Database className="size-4" />}Active Data Source</CardTitle>
        <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries()} disabled={isFetching}><RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />Refresh</Button>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <Badge variant="outline">{notion ? "Notion production" : "SQLite mock"}</Badge>
        <p className="text-muted-foreground">{notion ? "Pages read directly from Notion. Targeted writes require an explicit Save to Notion action." : "Seeded local development data. No Notion credentials required."}</p>
        {data && <p className="text-xs text-muted-foreground">General sync: {data.generalSyncEnabled ? "enabled (invalid configuration)" : "disabled"}</p>}
      </CardContent>
    </Card>
  );
}
