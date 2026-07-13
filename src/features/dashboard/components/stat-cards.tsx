"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  Clock,
  FileClock,
  Hourglass,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatHours } from "@/lib/calculations";
import type { DashboardSummary } from "../api";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  subtitle?: React.ReactNode;
  href?: string;
}

function StatCard({ icon: Icon, label, value, subtitle, href }: StatCardProps) {
  const content = (
    <Card className={href ? "h-full transition-colors hover:bg-muted/40" : "h-full"}>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 pb-0">
        <CardTitle className="text-xs font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="pt-1">
        <div className="truncate text-2xl font-semibold tracking-tight">{value}</div>
        {subtitle && (
          <div className="mt-1 truncate text-xs text-muted-foreground">{subtitle}</div>
        )}
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full">
        {content}
      </Link>
    );
  }
  return content;
}

function StatCardSkeleton() {
  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 pb-0">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="size-4 rounded-full" />
      </CardHeader>
      <CardContent className="space-y-2 pt-1">
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-3 w-28" />
      </CardContent>
    </Card>
  );
}

export function StatCardsGrid({
  summary,
  isLoading,
}: {
  summary: DashboardSummary | undefined;
  isLoading: boolean;
}) {
  if (isLoading || !summary) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  const { today, week, month, readyToInvoice, alreadyInvoiced, outstanding } = summary;

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
      <StatCard
        icon={Clock}
        label="Today's Hours"
        value={formatHours(today.hours)}
        subtitle={format(parseISO(today.date), "EEE, MMM d")}
      />
      <StatCard
        icon={CalendarDays}
        label="This Week"
        value={formatHours(week.hours)}
        subtitle={`${format(parseISO(week.start), "MMM d")} – ${format(parseISO(week.end), "MMM d")}`}
      />
      <StatCard
        icon={CalendarRange}
        label="This Month"
        value={formatHours(month.hours)}
        subtitle={format(parseISO(month.start), "MMMM yyyy")}
      />
      <StatCard
        icon={Hourglass}
        label="Ready to Invoice"
        value={formatCurrency(readyToInvoice.amount)}
        subtitle={`${formatHours(readyToInvoice.hours)} unbilled`}
        href="/reports"
      />
      <StatCard
        icon={FileClock}
        label="Already Invoiced"
        value={formatCurrency(alreadyInvoiced.amount)}
        subtitle={`${alreadyInvoiced.count} invoice${alreadyInvoiced.count === 1 ? "" : "s"}`}
        href="/invoices"
      />
      <StatCard
        icon={CheckCircle2}
        label="Outstanding"
        value={formatCurrency(outstanding.amount)}
        subtitle={`${outstanding.count} unpaid`}
        href="/invoices/dashboard"
      />
    </div>
  );
}
