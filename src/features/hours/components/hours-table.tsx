"use client";

import { format, parseISO } from "date-fns";
import { ExternalLink, Pencil, Timer, Trash2, User } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatHours } from "@/lib/calculations";
import type { HoursEntryWithRelations } from "../lib/types";

function formatDate(date: string): string {
  try {
    return format(parseISO(date), "EEE, MMM d yyyy");
  } catch {
    return date;
  }
}

export function HoursTable({
  entries,
  isLoading,
  onEdit,
  onDelete,
  allowDelete = true,
}: {
  entries: HoursEntryWithRelations[];
  isLoading?: boolean;
  onEdit: (entry: HoursEntryWithRelations) => void;
  onDelete: (entry: HoursEntryWithRelations) => void;
  allowDelete?: boolean;
}) {
  return (
    <div className="rounded-xl ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Start</TableHead>
            <TableHead>End</TableHead>
            <TableHead>Break</TableHead>
            <TableHead>Total Hours</TableHead>
            <TableHead>Rate</TableHead>
            <TableHead>Billable</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Session ID</TableHead>
            <TableHead>Billing</TableHead>
            <TableHead>Work Log</TableHead>
            <TableHead>Invoice</TableHead>
            <TableHead>Notes</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 15 }).map((__, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : entries.length === 0 ? (
            <TableRow>
              <TableCell colSpan={15} className="h-24 text-center text-muted-foreground">
                No hours entries in this range yet.
              </TableCell>
            </TableRow>
          ) : (
            entries.map((entry) => (
              <TableRow key={entry.id} className={entry.superseded ? "opacity-60" : undefined}>
                <TableCell className="font-medium">{formatDate(entry.date)}</TableCell>
                <TableCell>{entry.startTime}</TableCell>
                <TableCell>{entry.endTime}</TableCell>
                <TableCell>{entry.breakMinutes > 0 ? `${entry.breakMinutes}m` : "—"}</TableCell>
                <TableCell className="font-medium">{formatHours(entry.totalHours)}</TableCell>
                <TableCell>{formatCurrency(entry.hourlyRate)}/hr</TableCell>
                <TableCell>
                  <Badge variant={entry.billable ? "default" : "secondary"}>
                    {entry.billable ? "Billable" : "Non-billable"}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-40 truncate" title={entry.location || undefined}>
                  {entry.location || "—"}
                </TableCell>
                <TableCell className="max-w-36 truncate" title={entry.projectName ?? undefined}>
                  {entry.projectName ?? "—"}
                </TableCell>
                <TableCell className="max-w-28 truncate font-mono text-xs" title={entry.sessionId ?? undefined}>
                  {entry.sessionId ?? "—"}
                </TableCell>
                <TableCell>
                  {entry.superseded ? (
                    <Badge variant="destructive">Superseded / Do Not Bill</Badge>
                  ) : entry.billingStatus ? (
                    <Badge variant="outline">{entry.billingStatus.replace(/-/g, " ")}</Badge>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="max-w-40 truncate" title={entry.workLogTitle ?? undefined}>
                  {entry.workLogTitle ?? "—"}
                </TableCell>
                <TableCell className="max-w-32 truncate" title={entry.invoiceReportLabel ?? undefined}>
                  {entry.invoiceReportLabel ?? "—"}
                </TableCell>
                <TableCell className="max-w-48 truncate" title={entry.notes || undefined}>
                  {entry.notes || "—"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Badge
                      variant="ghost"
                      className="mr-1 px-1"
                      title={entry.source === "timer" ? "Logged via timer" : "Logged manually"}
                    >
                      {entry.source === "timer" ? (
                        <Timer className="size-3" />
                      ) : (
                        <User className="size-3" />
                      )}
                    </Badge>
                    {entry.notionUrl && <Button variant="ghost" size="icon-sm" nativeButton={false} render={<a href={entry.notionUrl} target="_blank" rel="noreferrer" />}><ExternalLink /><span className="sr-only">Open saved Notion entry</span></Button>}
                    <Button variant="ghost" size="icon-sm" onClick={() => onEdit(entry)}>
                      <Pencil />
                      <span className="sr-only">Edit</span>
                    </Button>
                    {allowDelete && <Button variant="ghost" size="icon-sm" onClick={() => onDelete(entry)}>
                      <Trash2 />
                      <span className="sr-only">Delete</span>
                    </Button>}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
