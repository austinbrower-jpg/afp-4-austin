"use client";

import { format, parseISO } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { aggregateHoursByDay } from "../lib/daily-summary";
import type { HoursEntryWithRelations } from "../lib/types";

function displayDate(date: string): string {
  return format(parseISO(date), "EEEE, MMM d, yyyy");
}

function displayHours(hours: number): string {
  return `${Number(hours.toFixed(2))} hours`;
}

export function HoursByDay({
  entries,
  isLoading,
}: {
  entries: HoursEntryWithRelations[];
  isLoading?: boolean;
}) {
  const days = aggregateHoursByDay(entries);
  const rangeTotal = Math.round(days.reduce((total, day) => total + day.totalHours, 0) * 100) / 100;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle>Hours by Day</CardTitle>
          <CardDescription>Local calendar dates for the selected range, newest first.</CardDescription>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Selected range</p>
          <p className="text-lg font-semibold">{isLoading ? "…" : displayHours(rangeTotal)}</p>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, index) => <Skeleton className="h-9 w-full" key={index} />)}
          </div>
        ) : days.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No valid hours entries in this range.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Total hours</TableHead>
                <TableHead className="text-right">Entries / projects</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {days.map((day) => (
                <TableRow key={day.date}>
                  <TableCell className="font-medium">{displayDate(day.date)}</TableCell>
                  <TableCell>{displayHours(day.totalHours)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {day.entryCount} {day.entryCount === 1 ? "entry" : "entries"}
                    {day.projectCount > 0 ? ` · ${day.projectCount} ${day.projectCount === 1 ? "project" : "projects"}` : ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
