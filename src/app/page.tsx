"use client";

import { useDashboardSummary } from "@/features/dashboard/hooks/use-dashboard-summary";
import { StatCardsGrid } from "@/features/dashboard/components/stat-cards";
import { RecentWorkEntries } from "@/features/dashboard/components/recent-work-entries";
import { RecentInvoices } from "@/features/dashboard/components/recent-invoices";
import { RecentProjects } from "@/features/dashboard/components/recent-projects";
import { QuickActions } from "@/features/dashboard/components/quick-actions";
import { RuntimeStatusCard } from "@/features/runtime/components/runtime-status-card";

export default function DashboardPage() {
  const { data: summary, isLoading } = useDashboardSummary();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Invoice health, client billing history, and recent activity
          {summary?.client ? ` for ${summary.client.name}` : ""}.
        </p>
      </div>

      <StatCardsGrid summary={summary} isLoading={isLoading} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <RecentWorkEntries summary={summary} isLoading={isLoading} />
        <RecentInvoices summary={summary} isLoading={isLoading} />
        <RecentProjects summary={summary} isLoading={isLoading} />
        <QuickActions />
      </div>

      <RuntimeStatusCard />
    </div>
  );
}
