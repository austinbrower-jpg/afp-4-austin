import type {
  Client,
  ClientStatus,
  HoursEntry,
  InvoiceReport,
  InvoiceStatus,
  KnowledgePage,
  KnowledgeType,
  Priority,
  Project,
  ProjectStatus,
  WorkLog,
  WorkLogStatus,
} from "@/types/domain";
import {
  NOTION_SCHEMA,
  clientFromNotionProperties,
  extractPlainText,
  extractRelationIds,
  extractSelect,
  hoursFromNotionProperties,
  invoiceFromNotionProperties,
  knowledgeFromNotionProperties,
  projectFromNotionProperties,
  worklogFromNotionProperties,
} from "./mappers";

export type NotionPropertyLike = Record<string, unknown>;

export interface NotionPageLike {
  id: string;
  url?: string;
  created_time?: string;
  last_edited_time?: string;
  properties: Record<string, NotionPropertyLike>;
}

export interface MappingContext {
  workspaceId?: string;
  clientId?: string | null;
  databaseId?: string | null;
  pageContent?: string;
}

const WORKSPACE_ID = "notion-production";
const FALLBACK_TIME = "1970-01-01T00:00:00.000Z";
const WORK_DONE_SECTION_HEADINGS = [
  "Time Summary",
  "Work Performed",
  "Technical Changes",
  "Testing / Verification",
  "Blockers / Remaining Work",
  "Invoice Description",
  "Notes / Evidence",
] as const;

function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
  field: string,
  warnings: string[],
): T {
  if (typeof value === "string" && allowed.includes(value as T)) return value as T;
  if (value !== undefined && value !== null && value !== "") warnings.push(`${field} has unsupported value "${String(value)}"; using ${fallback}.`);
  return fallback;
}

function common(page: NotionPageLike, context: MappingContext, warnings: string[]) {
  const createdAt = page.created_time || page.last_edited_time || FALLBACK_TIME;
  const updatedAt = page.last_edited_time || createdAt;
  return {
    id: page.id,
    notionPageId: page.id,
    notionDatabaseId: context.databaseId ?? null,
    notionUrl: page.url ?? null,
    syncStatus: "synced" as const,
    lastSyncedAt: null,
    notionLastEditedTime: page.last_edited_time ?? null,
    createdAt,
    updatedAt,
    validationWarnings: warnings,
  };
}

function requiredText(value: string, label: string, fallback: string, warnings: string[]): string {
  const trimmed = value.trim();
  if (trimmed) return trimmed;
  warnings.push(`${label} is missing; using "${fallback}".`);
  return fallback;
}

function normalizeClockTime(value: string, label: string, fallback: string, warnings: string[]): string {
  const twentyFourHour = value.match(/^(\d{1,2}):(\d{2})$/);
  if (twentyFourHour) {
    const hours = Number(twentyFourHour[1]);
    const minutes = Number(twentyFourHour[2]);
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    }
  }

  const twelveHour = value.match(/^(\d{1,2}):(\d{2})\s*([ap]m)$/i);
  if (twelveHour) {
    const rawHours = Number(twelveHour[1]);
    const minutes = Number(twelveHour[2]);
    if (rawHours >= 1 && rawHours <= 12 && minutes >= 0 && minutes <= 59) {
      const hours = (rawHours % 12) + (twelveHour[3].toLowerCase() === "pm" ? 12 : 0);
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    }
  }

  warnings.push(`${label} is invalid; using "${fallback}".`);
  return fallback;
}

function extractWorkDoneSection(pageContent: string | undefined, section: string): string {
  if (!pageContent) return "";
  const lines = pageContent.split(/\n\n+/).map((line) => line.trim()).filter(Boolean);
  const start = lines.findIndex((line) => line === section);
  if (start === -1) return "";
  const body: string[] = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (WORK_DONE_SECTION_HEADINGS.includes(line as (typeof WORK_DONE_SECTION_HEADINGS)[number])) break;
    body.push(line);
  }
  return body.join("\n\n").trim();
}

function inferWorkLogStatus(parsedStatus: WorkLog["status"], pageContent: string | undefined): WorkLog["status"] {
  if (parsedStatus !== "not-started") return parsedStatus;
  if (pageContent && /\b(Present|Still active|active session)\b/i.test(pageContent)) return "in-progress";
  return parsedStatus;
}

function dateFromHoursTitle(page: NotionPageLike, warnings: string[]): string {
  const titleText = extractPlainText(page.properties[NOTION_SCHEMA.hours.title]);
  const match = titleText.match(/\d{4}-\d{2}-\d{2}/);
  if (match) return match[0];
  warnings.push("Date title does not contain YYYY-MM-DD; using 1970-01-01.");
  return "1970-01-01";
}

export function mapNotionClient(page: NotionPageLike, context: MappingContext = {}): Client {
  const warnings: string[] = [];
  const parsed = clientFromNotionProperties(page.properties);
  return {
    ...common(page, context, warnings),
    workspaceId: context.workspaceId ?? WORKSPACE_ID,
    name: requiredText(parsed.name ?? "", "Client name", "Untitled client", warnings),
    color: parsed.color || "#6366f1",
    status: enumValue<ClientStatus>(parsed.status, ["active", "paused", "archived"], "active", "Status", warnings),
    defaultHourlyRate: Number.isFinite(parsed.defaultHourlyRate) ? parsed.defaultHourlyRate! : 0,
    timezone: parsed.timezone || "America/Chicago",
    notes: parsed.notes || "",
  };
}

export function mapNotionProject(page: NotionPageLike, context: MappingContext): Project {
  const warnings: string[] = [];
  const parsed = projectFromNotionProperties(page.properties);
  return {
    ...common(page, context, warnings),
    workspaceId: context.workspaceId ?? WORKSPACE_ID,
    clientId: context.clientId ?? "",
    name: requiredText(parsed.name ?? "", "Project name", "Untitled project", warnings),
    description: parsed.description || "",
    status: enumValue<ProjectStatus>(parsed.status, ["active", "on-hold", "completed", "archived"], "active", "Status", warnings),
    priority: enumValue<Priority>(parsed.priority, ["low", "medium", "high", "urgent"], "medium", "Priority", warnings),
    color: parsed.color || "#6366f1",
    tags: parsed.tags ?? [],
    notes: "",
  };
}

export function mapNotionHours(page: NotionPageLike, context: MappingContext): HoursEntry {
  const warnings: string[] = [];
  const parsed = hoursFromNotionProperties(page.properties);
  const projectId = extractRelationIds(page.properties[NOTION_SCHEMA.hours.project])[0] ?? null;
  const relatedWorkDoneIds = extractRelationIds(page.properties[NOTION_SCHEMA.hours.relatedWorkDone]);
  const startText = requiredText(parsed.startTime ?? "", "Start Time", "00:00", warnings);
  const startTime = normalizeClockTime(startText, "Start Time", "00:00", warnings);
  const endText = requiredText(parsed.endTime ?? "", "End Time", startTime, warnings);
  const endTime = normalizeClockTime(endText, "End Time", startTime, warnings);
  const migrationKey = extractPlainText(page.properties[NOTION_SCHEMA.hours.migrationKey]) || null;
  const sessionId = extractPlainText(page.properties[NOTION_SCHEMA.hours.sessionId]) || parsed.sessionId || null;
  const billingSelect = extractSelect(page.properties[NOTION_SCHEMA.hours.billingStatus]);
  return {
    ...common(page, context, warnings),
    workspaceId: context.workspaceId ?? WORKSPACE_ID,
    clientId: context.clientId ?? "",
    projectId,
    date: parsed.date || dateFromHoursTitle(page, warnings),
    startTime,
    endTime,
    breakMinutes: Math.max(0, parsed.breakMinutes ?? 0),
    totalHours: Math.max(0, parsed.totalHours ?? 0),
    hourlyRate: Math.max(0, parsed.hourlyRate ?? 0),
    billable: parsed.billable === true,
    location: parsed.location || "",
    relatedWorkLogId: relatedWorkDoneIds[0] ?? parsed.relatedWorkLogId ?? null,
    relatedWorkDoneIds,
    notes: parsed.notes || "",
    source: "manual",
    externalId: migrationKey,
    sessionId,
    billingStatus: parsed.billingStatus ?? (billingSelect?.toLowerCase() === "superseded" ? "superseded" : null),
    invoiceReportId: extractRelationIds(page.properties[NOTION_SCHEMA.hours.invoiceReport])[0] ?? parsed.invoiceReportId ?? null,
  };
}

export function mapNotionWorkLog(page: NotionPageLike, context: MappingContext): WorkLog {
  const warnings: string[] = [];
  const parsed = worklogFromNotionProperties(page.properties);
  const pageContent = context.pageContent ?? "";
  const invoiceDescription = parsed.invoiceDescription || extractWorkDoneSection(pageContent, "Invoice Description") || pageContent || "";
  const workPerformed = extractWorkDoneSection(pageContent, "Work Performed");
  const technicalChanges = extractWorkDoneSection(pageContent, "Technical Changes");
  const testingVerification = extractWorkDoneSection(pageContent, "Testing / Verification");
  const blockers = extractWorkDoneSection(pageContent, "Blockers / Remaining Work");
  const notes = extractWorkDoneSection(pageContent, "Notes / Evidence");
  return {
    ...common(page, context, warnings),
    workspaceId: context.workspaceId ?? WORKSPACE_ID,
    clientId: context.clientId ?? "",
    projectId: parsed.projectId ?? null,
    title: requiredText(parsed.title ?? "", "Work Done title", "Untitled work entry", warnings),
    date: parsed.date || "1970-01-01",
    summary: parsed.summary || invoiceDescription || workPerformed || technicalChanges || pageContent || "",
    detailedNotes: parsed.internalNotes || blockers || notes || workPerformed || pageContent || "",
    invoiceDescription,
    status: inferWorkLogStatus(
      enumValue<WorkLogStatus>(parsed.status, ["not-started", "in-progress", "blocked", "done"], "not-started", "Status", warnings),
      pageContent,
    ),
    priority: enumValue<Priority>(parsed.priority, ["low", "medium", "high", "urgent"], "medium", "Priority", warnings),
    relatedHoursIds: parsed.relatedHoursIds ?? [],
    relatedKnowledgeIds: [],
    evidence: parsed.evidenceLinks ?? [],
    githubLink: parsed.githubLink ?? null,
    attachments: [],
    detailedWorkDescription: parsed.detailedWorkDescription || invoiceDescription || workPerformed || technicalChanges || testingVerification || blockers || notes || pageContent || "",
    internalNotes: parsed.internalNotes || blockers || notes || "",
    clientVisible: parsed.clientVisible === true,
    includeInInvoice: parsed.includeInInvoice === true,
    includeInWorkReport: parsed.includeInWorkReport === true,
    evidenceLinks: parsed.evidenceLinks ?? [],
    workLogId: extractPlainText(page.properties[NOTION_SCHEMA.worklog.workLogId]) || parsed.workLogId || null,
    approvalStatus: parsed.approvalStatus ?? null,
    invoiceReportId: extractRelationIds(page.properties[NOTION_SCHEMA.worklog.invoiceReport])[0] ?? parsed.invoiceReportId ?? null,
  };
}

export function mapNotionKnowledge(page: NotionPageLike, context: MappingContext): KnowledgePage {
  const warnings: string[] = [];
  const parsed = knowledgeFromNotionProperties(page.properties);
  return {
    ...common(page, context, warnings),
    workspaceId: context.workspaceId ?? WORKSPACE_ID,
    clientId: context.clientId ?? null,
    projectId: parsed.projectId ?? null,
    type: enumValue<KnowledgeType>(parsed.type, ["project-note", "documentation", "notes", "flow-map", "research", "meeting-notes", "idea", "sop", "reference"], "notes", "Type", warnings),
    title: requiredText(parsed.title ?? "", "Knowledge title", "Untitled page", warnings),
    content: context.pageContent || parsed.reportSummary || "",
    tags: parsed.tags ?? [],
    parentId: null,
    backlinkIds: [],
    clientVisible: parsed.clientVisible === true,
    includeInWorkReport: parsed.includeInWorkReport === true,
    reportSummary: parsed.reportSummary || "",
    sourcePage: parsed.sourcePage ?? page.url ?? null,
  };
}

export function mapNotionInvoice(page: NotionPageLike, context: MappingContext): InvoiceReport {
  const warnings: string[] = [];
  const parsed = invoiceFromNotionProperties(page.properties);
  return {
    ...common(page, context, warnings),
    workspaceId: context.workspaceId ?? WORKSPACE_ID,
    clientId: context.clientId ?? "",
    invoiceNumber: requiredText(parsed.invoiceNumber ?? "", "Invoice number", "Untitled invoice", warnings),
    periodStart: parsed.periodStart || "1970-01-01",
    periodEnd: parsed.periodEnd || parsed.periodStart || "1970-01-01",
    hourlyRate: Math.max(0, parsed.hourlyRate ?? 0),
    totalHours: Math.max(0, parsed.totalHours ?? 0),
    totalAmount: Math.max(0, parsed.totalAmount ?? 0),
    summary: parsed.summary || "",
    lineItems: [],
    hoursEntryIds: parsed.hoursEntryIds ?? [],
    status: enumValue<InvoiceStatus>(parsed.status, ["draft", "sent", "paid", "void"], "draft", "Status", warnings),
    workDoneIds: parsed.workDoneIds ?? [],
    invoiceDate: parsed.invoiceDate ?? null,
    dueDate: parsed.dueDate ?? null,
    paymentTerms: parsed.paymentTerms ?? null,
    sentDate: parsed.sentDate ?? null,
    paidDate: parsed.paidDate ?? null,
    pdfUrl: parsed.pdfUrl ?? null,
  };
}
