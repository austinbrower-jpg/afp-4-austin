"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ClipboardList } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import type { Project, WorkLog } from "@/types/domain";
import { useWorkLogs } from "../hooks/use-work-logs";
import { PriorityBadge, STATUS_LABEL, STATUS_OPTIONS, StatusBadge } from "./status-priority";
import { WorkLogFormDialog } from "./work-log-form-dialog";

interface WorkDoneListProps {
  initialWorkLogs: WorkLog[];
  projects: Project[];
}

const ALL = "__all__";

export function WorkDoneList({ initialWorkLogs, projects }: WorkDoneListProps) {
  const { data: workLogs } = useWorkLogs(undefined, initialWorkLogs);
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [projectFilter, setProjectFilter] = useState<string>(ALL);

  const projectById = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects],
  );

  const filtered = useMemo(() => {
    return (workLogs ?? []).filter((log) => {
      if (statusFilter !== ALL && log.status !== statusFilter) return false;
      if (projectFilter !== ALL && log.projectId !== projectFilter) return false;
      return true;
    });
  }, [workLogs, statusFilter, projectFilter]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? ALL)}>
            <SelectTrigger size="sm" className="w-40">
              <SelectValue>
                {(v: string) => (v === ALL ? "All statuses" : STATUS_LABEL[v as keyof typeof STATUS_LABEL] ?? v)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={projectFilter} onValueChange={(v) => setProjectFilter(v ?? ALL)}>
            <SelectTrigger size="sm" className="w-44">
              <SelectValue>
                {(v: string) => (v === ALL ? "All projects" : projectById.get(v)?.name ?? "All projects")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All projects</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <WorkLogFormDialog projects={projects} />
      </div>

      <Card className="py-0">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center text-muted-foreground">
            <ClipboardList className="size-8" />
            <p className="text-sm">No work logs match these filters yet.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((log) => {
                const project = log.projectId ? projectById.get(log.projectId) : undefined;
                return (
                  <TableRow key={log.id} className="cursor-pointer">
                    <TableCell className="max-w-80 whitespace-normal font-medium">
                      <Link href={`/work-done/${log.id}`} className="hover:underline">
                        {log.title}
                      </Link>
                      {log.summary && (
                        <p className="line-clamp-1 text-xs font-normal text-muted-foreground">
                          {log.summary}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {project ? project.name : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(log.date)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={log.status} />
                    </TableCell>
                    <TableCell>
                      <PriorityBadge priority={log.priority} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), "MMM d, yyyy");
  } catch {
    return iso;
  }
}
