"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { GlobalSearch } from "@/features/search/components/global-search";
import { SyncStatusBadge } from "@/features/notion-sync/components/sync-status-badge";
import { ThemeToggle } from "./theme-toggle";

export function TopBar() {
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/60">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <div className="flex-1" />
      <GlobalSearch />
      <Separator orientation="vertical" className="mx-1 h-4" />
      <SyncStatusBadge />
      <ThemeToggle />
    </header>
  );
}
