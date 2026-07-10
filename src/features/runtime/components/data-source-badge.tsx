"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Cloud, Database, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { runtimeApi } from "../api";

export function DataSourceBadge() {
  const queryClient = useQueryClient();
  const { data, isFetching } = useQuery({ queryKey: ["runtime-status"], queryFn: runtimeApi.status, staleTime: 60_000 });
  const notion = data?.dataSource === "notion";
  return (
    <div className="flex items-center gap-1.5">
      <Badge variant="outline" className="gap-1.5">
        {notion ? <Cloud className="size-3" /> : <Database className="size-3" />}
        {notion ? "Notion data" : "Local mock data"}
      </Badge>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Refresh current data"
        title="Refresh current data"
        disabled={isFetching}
        onClick={() => queryClient.invalidateQueries()}
      >
        <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
      </Button>
    </div>
  );
}
