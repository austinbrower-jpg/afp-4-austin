"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { NAV, isNavGroup, type NavLeaf } from "@/lib/nav-config";

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, pathname }: { item: NavLeaf; pathname: string }) {
  const Icon = item.icon;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive(pathname, item.href)}
        tooltip={item.title}
        render={
          <Link href={item.href}>
            <Icon />
            <span>{item.title}</span>
          </Link>
        }
      />
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Briefcase className="size-4" />
          </div>
          <div className="flex flex-col leading-none group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold">Battle Bound Branding</span>
            <span className="text-xs text-muted-foreground">Client Reporting Portal</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {NAV.map((entry) =>
          isNavGroup(entry) ? (
            <SidebarGroup key={entry.title}>
              <SidebarGroupLabel>{entry.title}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {entry.items.map((item) => (
                    <NavLink key={item.href} item={item} pathname={pathname} />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ) : (
            <SidebarGroup key={entry.title}>
              <SidebarGroupContent>
                <SidebarMenu>
                  <NavLink item={entry} pathname={pathname} />
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ),
        )}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
