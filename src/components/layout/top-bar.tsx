"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { GlobalSearch } from "@/features/search/components/global-search";
import { DataSourceBadge } from "@/features/runtime/components/data-source-badge";
import { ThemeToggle } from "./theme-toggle";

export function TopBar() {
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-1 border-b bg-background/95 px-2 backdrop-blur supports-backdrop-filter:bg-background/60 sm:gap-2 sm:px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-0 h-4 sm:mr-2" />
      <div className="flex-1" />
      <GlobalSearch />
      <Separator orientation="vertical" className="mx-0 h-4 sm:mx-1" />
      <DataSourceBadge />
      <ThemeToggle />
    </header>
  );
}
