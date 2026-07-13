import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Clock,
  ClipboardList,
  FileText,
  FileOutput,
  ChartColumn,
  FolderKanban,
  Users,
  BookOpen,
  StickyNote,
  Workflow,
  Microscope,
  NotebookPen,
  Settings,
} from "lucide-react";

export interface NavLeaf {
  title: string;
  href: string;
  icon: LucideIcon;
  description: string;
}

export interface NavGroup {
  title: string;
  items: NavLeaf[];
}

export type NavEntry = NavLeaf | NavGroup;

export function isNavGroup(entry: NavEntry): entry is NavGroup {
  return "items" in entry;
}

export const NAV: NavEntry[] = [
  {
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    description: "Overview of hours, invoices, and recent activity",
  },
  {
    title: "Clients",
    href: "/clients",
    icon: Users,
    description: "Read-only client roster, revenue, and billing history",
  },
  {
    title: "Invoice Details",
    items: [
      {
        title: "Hours Worked",
        href: "/hours",
        icon: Clock,
        description: "Track billable time",
      },
      {
        title: "Work Done",
        href: "/work-done",
        icon: ClipboardList,
        description: "Document completed work",
      },
      {
        title: "Invoice Reports",
        href: "/invoices",
        icon: FileText,
        description: "Generate and export invoices",
      },
      {
        title: "Invoice Dashboard",
        href: "/invoices/dashboard",
        icon: ChartColumn,
        description: "Review invoice health and client billing history",
      },
      {
        title: "Report Builder",
        href: "/reports",
        icon: FileOutput,
        description: "Build invoices and detailed work reports",
      },
    ],
  },
  {
    title: "Work Stuff",
    items: [
      {
        title: "Projects",
        href: "/projects",
        icon: FolderKanban,
        description: "Everything organized by project",
      },
      {
        title: "Documentation",
        href: "/knowledge/documentation",
        icon: BookOpen,
        description: "Reference docs and SOPs",
      },
      {
        title: "Notes",
        href: "/knowledge/notes",
        icon: StickyNote,
        description: "Freeform notes",
      },
      {
        title: "Flow Maps",
        href: "/knowledge/flow-maps",
        icon: Workflow,
        description: "Process and system diagrams",
      },
      {
        title: "Research",
        href: "/knowledge/research",
        icon: Microscope,
        description: "Research and investigations",
      },
      {
        title: "Meeting Notes",
        href: "/knowledge/meeting-notes",
        icon: NotebookPen,
        description: "Notes from meetings",
      },
    ],
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
    description: "Workspace, sync, and rate configuration",
  },
];

export const KNOWLEDGE_TYPE_ROUTES: Record<string, string> = {
  documentation: "Documentation",
  notes: "Notes",
  "flow-maps": "Flow Maps",
  research: "Research",
  "meeting-notes": "Meeting Notes",
};
