"use client";

import { useState } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, LoaderCircle } from "lucide-react";
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
import { DEFAULT_REPORT_SETTINGS } from "@/lib/reports/types";

/** Falls back to the Briefcase glyph if the logo file fails to load. */
function SidebarBrandMark() {
  const [failed, setFailed] = useState(false);
  if (failed) return <Briefcase className="size-4" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={DEFAULT_REPORT_SETTINGS.logoPath}
      alt="Battle Bound Branding logo"
      className="size-5 object-contain"
      onError={() => setFailed(true)}
    />
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinkContent({ item }: { item: NavLeaf }) {
  const { pending } = useLinkStatus();
  const Icon = item.icon;

  return (
    <>
      <Icon />
      <span>{item.title}</span>
      <span className="ml-auto flex size-3.5 shrink-0 items-center justify-center" aria-hidden>
        {pending && <LoaderCircle className="size-3.5 animate-spin" />}
      </span>
      {pending && <span className="sr-only">Loading {item.title}</span>}
    </>
  );
}

function NavLink({ item, pathname }: { item: NavLeaf; pathname: string }) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive(pathname, item.href)}
        tooltip={item.title}
        render={
          <Link href={item.href} prefetch="auto">
            <NavLinkContent item={item} />
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
            <SidebarBrandMark />
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
