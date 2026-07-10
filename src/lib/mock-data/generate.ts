import { addDays, format, subDays, subWeeks } from "date-fns";
import { newId, newSyncable, nowISO } from "@/lib/db/repository";
import { computeTotalHours } from "@/lib/calculations";
import type {
  Client,
  HoursEntry,
  InvoiceReport,
  KnowledgePage,
  Project,
  WorkLog,
  Workspace,
} from "@/types/domain";

const HOURLY_RATE = 65;

export interface MockDataset {
  workspace: Workspace;
  client: Client;
  projects: Project[];
  hoursEntries: HoursEntry[];
  workLogs: WorkLog[];
  knowledgePages: KnowledgePage[];
  invoiceReports: InvoiceReport[];
}

function ts(daysAgo: number): string {
  return subDays(new Date(), daysAgo).toISOString();
}

export function generateMockDataset(): MockDataset {
  const now = nowISO();

  const workspace: Workspace = {
    id: newId("ws"),
    name: "Personal Workspace",
    slug: "personal",
    notionWorkspaceName: "AFP-Work",
    ...newSyncable(),
    createdAt: ts(120),
    updatedAt: now,
  };

  const client: Client = {
    id: newId("cli"),
    workspaceId: workspace.id,
    name: "AFP",
    color: "#6366f1",
    status: "active",
    defaultHourlyRate: HOURLY_RATE,
    timezone: "America/New_York",
    notes: "Primary contract client. Power Automate + document processing workflows.",
    ...newSyncable(),
    createdAt: ts(120),
    updatedAt: now,
  };

  const projectDefs = [
    {
      name: "Power Automate",
      description:
        "Document processing automation: intake, validation branches, workbook routing, batch uploads.",
      status: "active" as const,
      priority: "high" as const,
      color: "#6366f1",
      tags: ["automation", "power-automate", "document-processing"],
    },
    {
      name: "Client Portal Revamp",
      description: "Redesigning the client-facing portal for status tracking and document uploads.",
      status: "active" as const,
      priority: "medium" as const,
      color: "#22c55e",
      tags: ["frontend", "portal"],
    },
    {
      name: "Internal Tooling",
      description: "Scripts and dashboards for internal ops (reporting, reconciliation).",
      status: "on-hold" as const,
      priority: "low" as const,
      color: "#f59e0b",
      tags: ["tooling", "ops"],
    },
    {
      name: "Onboarding & SOPs",
      description: "Documentation and SOPs for new contractor/team onboarding.",
      status: "active" as const,
      priority: "medium" as const,
      color: "#ec4899",
      tags: ["documentation", "process"],
    },
  ];

  const projects: Project[] = projectDefs.map((def, i) => ({
    id: newId("proj"),
    workspaceId: workspace.id,
    clientId: client.id,
    name: def.name,
    description: def.description,
    status: def.status,
    priority: def.priority,
    color: def.color,
    tags: def.tags,
    notes: "",
    ...newSyncable(),
    createdAt: ts(110 - i * 5),
    updatedAt: ts(i),
  }));

  const [powerAutomate, portal, tooling, onboarding] = projects;

  // ---------------------------------------------------------------------
  // Hours entries: last 8 weeks, weekdays, mixed timer/manual
  // ---------------------------------------------------------------------
  const hoursEntries: HoursEntry[] = [];
  const locations = ["Remote - Home Office", "Remote - Coworking", "On-site - AFP HQ"];
  const projectPool = [powerAutomate, powerAutomate, portal, tooling, onboarding];

  for (let weekAgo = 8; weekAgo >= 0; weekAgo--) {
    const weekStart = subWeeks(new Date(), weekAgo);
    const dayCount = weekAgo === 0 ? new Date().getDay() || 5 : 5; // partial current week
    for (let d = 0; d < Math.min(dayCount, 5); d++) {
      // Monday-anchored: shift weekStart to that week's Monday
      const day = addDays(weekStart, d - weekStart.getDay() + 1);
      if (day > new Date()) continue;
      const date = format(day, "yyyy-MM-dd");
      const startHour = 8 + Math.floor(Math.random() * 2);
      const startTime = `${String(startHour).padStart(2, "0")}:${Math.random() > 0.5 ? "00" : "30"}`;
      const durationHours = 4 + Math.floor(Math.random() * 5);
      const endHour = startHour + durationHours;
      const endTime = `${String(Math.min(endHour, 20)).padStart(2, "0")}:${Math.random() > 0.5 ? "00" : "30"}`;
      const breakMinutes = Math.random() > 0.6 ? 30 : 0;
      const totalHours = computeTotalHours(startTime, endTime, breakMinutes);
      const project = projectPool[Math.floor(Math.random() * projectPool.length)];

      hoursEntries.push({
        id: newId("hr"),
        workspaceId: workspace.id,
        clientId: client.id,
        projectId: project.id,
        date,
        startTime,
        endTime,
        breakMinutes,
        totalHours,
        hourlyRate: HOURLY_RATE,
        billable: true,
        location: locations[Math.floor(Math.random() * locations.length)],
        relatedWorkLogId: null,
        notes: "",
        source: Math.random() > 0.7 ? "timer" : "manual",
        ...newSyncable(),
        createdAt: day.toISOString(),
        updatedAt: day.toISOString(),
      });
    }
  }

  // ---------------------------------------------------------------------
  // Work logs
  // ---------------------------------------------------------------------
  const workLogDefs: Array<{
    title: string;
    project: Project;
    daysAgo: number;
    status: WorkLog["status"];
    priority: WorkLog["priority"];
    summary: string;
    detailedNotes: string;
    invoiceDescription: string;
    githubLink: string | null;
  }> = [
    {
      title: "Condition 4 validation branch",
      project: powerAutomate,
      daysAgo: 2,
      status: "done",
      priority: "high",
      summary: "Built and tested the Condition 4 validation branch for document intake.",
      detailedNotes:
        "Built Condition 4 validation branch in the intake flow. Added schema checks for the new vendor format, wired error routing back to the exceptions queue, and adjusted the workbook writer to handle the new column set. Ran batch test with 40 sample documents (12 intentionally malformed) - all routed correctly.",
      invoiceDescription:
        "Implemented validation improvements for the Power Automate document processing workflow, updated workbook routing, tested batch uploads, and documented the changes.",
      githubLink: "https://github.com/afp-work/power-automate-flows/pull/42",
    },
    {
      title: "Workbook routing refactor",
      project: powerAutomate,
      daysAgo: 6,
      status: "done",
      priority: "medium",
      summary: "Refactored workbook routing to support multiple destination sheets.",
      detailedNotes:
        "Split the single-destination routing logic into a lookup-table-driven approach so new sheet destinations can be added via config instead of flow edits. Migrated 3 existing routes to the new pattern with no behavior change.",
      invoiceDescription:
        "Refactored workbook routing logic to be configuration-driven, reducing future maintenance effort for new document destinations.",
      githubLink: null,
    },
    {
      title: "Client portal - upload status UI",
      project: portal,
      daysAgo: 4,
      status: "in-progress",
      priority: "medium",
      summary: "Building the status tracker UI for client document uploads.",
      detailedNotes:
        "Scaffolded the upload status page with a stepper component (received -> validating -> processed -> filed). Hooked up polling against the status API; still need to handle the error/retry state visually.",
      invoiceDescription:
        "Developed client-facing upload status tracking interface for the portal, including real-time progress indicators.",
      githubLink: "https://github.com/afp-work/client-portal/pull/17",
    },
    {
      title: "Reconciliation report script",
      project: tooling,
      daysAgo: 10,
      status: "blocked",
      priority: "low",
      summary: "Script to reconcile processed documents against the source mailbox.",
      detailedNotes:
        "Blocked on read access to the shared mailbox API - waiting on IT to grant application permissions. Script logic (diffing processed vs received) is complete and unit tested against fixture data.",
      invoiceDescription:
        "Developed a reconciliation script to cross-check processed documents against source records (pending access approval to complete integration).",
      githubLink: null,
    },
    {
      title: "New contractor onboarding SOP",
      project: onboarding,
      daysAgo: 14,
      status: "done",
      priority: "medium",
      summary: "Wrote the SOP for onboarding new contractors onto AFP tooling.",
      detailedNotes:
        "Documented account provisioning steps, required tool access, and the first-week checklist. Linked out to the relevant flow documentation pages.",
      invoiceDescription:
        "Authored onboarding documentation and standard operating procedures for new contractor setup.",
      githubLink: null,
    },
    {
      title: "Batch upload load testing",
      project: powerAutomate,
      daysAgo: 18,
      status: "done",
      priority: "high",
      summary: "Load tested batch uploads at 5x normal volume.",
      detailedNotes:
        "Ran synthetic batch of 500 documents through the intake flow to check for throttling issues. Found and fixed a connector concurrency limit that was causing silent drops above ~120 concurrent runs.",
      invoiceDescription:
        "Performed load testing on the batch document upload pipeline and resolved a concurrency limit causing dropped submissions under high volume.",
      githubLink: "https://github.com/afp-work/power-automate-flows/pull/38",
    },
  ];

  const workLogs: WorkLog[] = workLogDefs.map((def) => ({
    id: newId("wl"),
    workspaceId: workspace.id,
    clientId: client.id,
    projectId: def.project.id,
    title: def.title,
    date: format(subDays(new Date(), def.daysAgo), "yyyy-MM-dd"),
    summary: def.summary,
    detailedNotes: def.detailedNotes,
    invoiceDescription: def.invoiceDescription,
    status: def.status,
    priority: def.priority,
    relatedHoursIds: [],
    relatedKnowledgeIds: [],
    evidence: [],
    githubLink: def.githubLink,
    attachments: [],
    ...newSyncable(),
    createdAt: ts(def.daysAgo),
    updatedAt: ts(Math.max(0, def.daysAgo - 1)),
  }));

  // ---------------------------------------------------------------------
  // Knowledge base pages
  // ---------------------------------------------------------------------
  const docsParent: KnowledgePage = {
    id: newId("kb"),
    workspaceId: workspace.id,
    clientId: client.id,
    projectId: powerAutomate.id,
    type: "documentation",
    title: "Power Automate Flow Reference",
    content:
      "# Power Automate Flow Reference\n\nIndex of all production flows, their triggers, and owners. See child pages for per-flow detail.",
    tags: ["power-automate", "reference"],
    parentId: null,
    backlinkIds: [],
    ...newSyncable(),
    createdAt: ts(90),
    updatedAt: ts(3),
  };

  const docsChild: KnowledgePage = {
    id: newId("kb"),
    workspaceId: workspace.id,
    clientId: client.id,
    projectId: powerAutomate.id,
    type: "documentation",
    title: "Document Intake Flow",
    content:
      "## Document Intake Flow\n\nTrigger: new file in SharePoint intake folder.\n\nSteps: validate schema -> route by condition -> write to workbook -> notify.\n\nSee [[Condition 4 validation branch]] for the latest validation logic.",
    tags: ["power-automate", "intake"],
    parentId: docsParent.id,
    backlinkIds: [],
    ...newSyncable(),
    createdAt: ts(85),
    updatedAt: ts(2),
  };

  const flowMap: KnowledgePage = {
    id: newId("kb"),
    workspaceId: workspace.id,
    clientId: client.id,
    projectId: powerAutomate.id,
    type: "flow-map",
    title: "Intake to Filing - Process Map",
    content:
      "```\nSharePoint Intake -> Schema Validation -> [Pass] -> Workbook Router -> Filed\n                                 \\-> [Fail] -> Exceptions Queue -> Manual Review\n```",
    tags: ["power-automate", "process"],
    parentId: null,
    backlinkIds: [],
    ...newSyncable(),
    createdAt: ts(80),
    updatedAt: ts(6),
  };

  const meetingNote: KnowledgePage = {
    id: newId("kb"),
    workspaceId: workspace.id,
    clientId: client.id,
    projectId: portal.id,
    type: "meeting-notes",
    title: "AFP Sync - Portal Status Tracker Kickoff",
    content:
      "**Attendees:** Austin, AFP PM\n\n- Agreed on stepper UI pattern for upload status\n- AFP to provide status API contract by EOW\n- Follow-up: confirm error/retry UX",
    tags: ["meeting", "portal"],
    parentId: null,
    backlinkIds: [],
    ...newSyncable(),
    createdAt: ts(5),
    updatedAt: ts(5),
  };

  const research: KnowledgePage = {
    id: newId("kb"),
    workspaceId: workspace.id,
    clientId: client.id,
    projectId: tooling.id,
    type: "research",
    title: "Mailbox API access options",
    content:
      "Comparing Graph API application permissions vs. delegated access for the reconciliation script. Application permissions require IT approval but avoid a dependency on a specific user's credentials.",
    tags: ["research", "graph-api"],
    parentId: null,
    backlinkIds: [],
    ...newSyncable(),
    createdAt: ts(11),
    updatedAt: ts(9),
  };

  const notesPage: KnowledgePage = {
    id: newId("kb"),
    workspaceId: workspace.id,
    clientId: client.id,
    projectId: null,
    type: "notes",
    title: "Scratch notes - week of " + format(subDays(new Date(), 3), "MMM d"),
    content:
      "- Remember to ask AFP about Q3 rate review\n- Check batch upload throughput after connector fix\n- Draft onboarding SOP follow-up",
    tags: ["scratch"],
    parentId: null,
    backlinkIds: [],
    ...newSyncable(),
    createdAt: ts(3),
    updatedAt: ts(1),
  };

  const sop: KnowledgePage = {
    id: newId("kb"),
    workspaceId: workspace.id,
    clientId: client.id,
    projectId: onboarding.id,
    type: "sop",
    title: "New Contractor Onboarding SOP",
    content:
      "1. Provision SharePoint + Power Automate access\n2. Add to AFP-Work Notion workspace\n3. Walk through Document Intake Flow doc\n4. Shadow one batch upload cycle",
    tags: ["sop", "onboarding"],
    parentId: null,
    backlinkIds: [],
    ...newSyncable(),
    createdAt: ts(14),
    updatedAt: ts(13),
  };

  const knowledgePages: KnowledgePage[] = [
    docsParent,
    docsChild,
    flowMap,
    meetingNote,
    research,
    notesPage,
    sop,
  ];

  // ---------------------------------------------------------------------
  // Invoice reports (past + current draft)
  // ---------------------------------------------------------------------
  const invoiceReports: InvoiceReport[] = [];
  for (let weekAgo = 4; weekAgo >= 1; weekAgo--) {
    const periodStart = format(
      addDays(subWeeks(new Date(), weekAgo), 1 - subWeeks(new Date(), weekAgo).getDay()),
      "yyyy-MM-dd",
    );
    const periodEnd = format(addDays(new Date(periodStart), 4), "yyyy-MM-dd");
    const weekHours = hoursEntries.filter(
      (h) => h.date >= periodStart && h.date <= periodEnd,
    );
    const totalHours = Math.round(weekHours.reduce((a, h) => a + h.totalHours, 0) * 100) / 100;
    invoiceReports.push({
      id: newId("inv"),
      workspaceId: workspace.id,
      clientId: client.id,
      invoiceNumber: `AFP-2026-${String(100 - weekAgo).padStart(3, "0")}`,
      periodStart,
      periodEnd,
      hourlyRate: HOURLY_RATE,
      totalHours,
      totalAmount: Math.round(totalHours * HOURLY_RATE * 100) / 100,
      summary: `Weekly invoice for work performed ${periodStart} - ${periodEnd}.`,
      lineItems: [],
      hoursEntryIds: weekHours.map((h) => h.id),
      status: weekAgo === 1 ? "sent" : "paid",
      ...newSyncable(),
      createdAt: ts(weekAgo * 7),
      updatedAt: ts(weekAgo * 7 - 1),
    });
  }

  return {
    workspace,
    client,
    projects,
    hoursEntries,
    workLogs,
    knowledgePages,
    invoiceReports,
  };
}
