"use client";

import { useDashboardSummary } from "@/features/dashboard/hooks/use-dashboard-summary";
import { StatCardsGrid } from "@/features/dashboard/components/stat-cards";
import { RecentWorkEntries } from "@/features/dashboard/components/recent-work-entries";
import { RecentNotes } from "@/features/dashboard/components/recent-notes";
import { UpcomingTasks } from "@/features/dashboard/components/upcoming-tasks";
import { SyncStatusCard, RecentSyncCard } from "@/features/dashboard/components/sync-panel";

export default function DashboardPage() {
  const { data: summary, isLoading } = useDashboardSummary();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of hours, invoices, and recent activity
          {summary?.client ? ` for ${summary.client.name}` : ""}.
        </p>
      </div>

      <StatCardsGrid summary={summary} isLoading={isLoading} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <RecentWorkEntries summary={summary} isLoading={isLoading} />
        <RecentNotes summary={summary} isLoading={isLoading} />
        <UpcomingTasks summary={summary} isLoading={isLoading} />
        <SyncStatusCard />
        <RecentSyncCard />
      </div>
    </div>
  );
}
