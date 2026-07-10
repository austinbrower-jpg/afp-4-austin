"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  entriesInRange,
  entriesToday,
  formatCurrency,
  formatHours,
  getMonthRange,
  getWeekRange,
  sumBillableAmount,
  sumHours,
} from "@/lib/calculations";
import type { HoursEntryWithRelations } from "../lib/types";

/**
 * Always computed from the FULL (unfiltered) entry set, so these stay
 * "running totals" for the current week/month regardless of whatever
 * date-range the table below is scoped to.
 *
 * "Estimated invoice total" = billable hours x rate for the current
 * calendar month to date - i.e. an estimate of what the next invoice for
 * the still-open billing period would total, not a sum tied to any
 * already-issued InvoiceReport.
 */
export function HoursSummaryBar({
  entries,
  isLoading,
}: {
  entries: HoursEntryWithRelations[];
  isLoading?: boolean;
}) {
  const now = new Date();
  const week = getWeekRange(now);
  const month = getMonthRange(now);

  const todayEntries = entriesToday(entries, now);
  const weekEntries = entriesInRange(entries, week.start, week.end);
  const monthEntries = entriesInRange(entries, month.start, month.end);

  const stats: { label: string; value: string }[] = [
    { label: "Today", value: formatHours(sumHours(todayEntries)) },
    { label: "This Week", value: formatHours(sumHours(weekEntries)) },
    { label: "This Month", value: formatHours(sumHours(monthEntries)) },
    {
      label: "Est. Invoice (This Month)",
      value: formatCurrency(sumBillableAmount(monthEntries)),
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label} size="sm">
          <CardHeader>
            <CardTitle className="text-xs font-normal text-muted-foreground">
              {stat.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold tracking-tight">
            {isLoading ? "…" : stat.value}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
