import type {
  Client,
  HoursEntry,
  InvoiceReport,
  KnowledgePage,
  Project,
  WorkLog,
} from "@/types/domain";

/**
 * Property-name contracts for each Notion database. These are the columns
 * the sync engine expects to find (and will create/update) on push, and
 * reads on pull. Adjust these to match an existing AFP-Work database by
 * renaming columns there, or by editing the maps below - the two just need
 * to agree.
 */
export const NOTION_SCHEMA = {
  client: {
    title: "Name",
    status: "Status",
    defaultHourlyRate: "Default Hourly Rate",
    color: "Color",
    timezone: "Timezone",
    notes: "Notes",
  },
  project: {
    title: "Name",
    status: "Status",
    priority: "Priority",
    description: "Description",
    tags: "Tags",
    color: "Color",
  },
  hours: {
    title: "Date",
    date: "Date",
    startTime: "Start Time",
    endTime: "End Time",
    breakMinutes: "Break (min)",
    totalHours: "Total Hours",
    hourlyRate: "Hourly Rate",
    billable: "Billable",
    location: "Location",
    project: "Project",
    notes: "Notes",
    migrationKey: "Migration Key",
  },
  worklog: {
    title: "Title",
    date: "Date",
    status: "Status",
    priority: "Priority",
    project: "Project",
    summary: "Summary",
    invoiceDescription: "Invoice Description",
    githubLink: "GitHub Link",
    clientVisible: "Client Visible",
    includeInInvoice: "Include in Invoice",
    includeInWorkReport: "Include in Work Report",
    detailedWorkDescription: "Detailed Work Description",
    internalNotes: "Internal Notes",
    evidenceLinks: "Evidence Links",
    relatedHours: "Related Hours",
  },
  knowledge: {
    title: "Title",
    type: "Type",
    tags: "Tags",
    project: "Project",
    clientVisible: "Client Visible",
    includeInWorkReport: "Include in Work Report",
    reportSummary: "Report Summary",
    sourcePage: "Source Page",
  },
  invoice: {
    title: "Invoice Number",
    periodStart: "Period Start",
    periodEnd: "Period End",
    hourlyRate: "Hourly Rate",
    totalHours: "Total Hours",
    totalAmount: "Total Amount",
    status: "Status",
    summary: "Summary",
  },
} as const;

// ---------------------------------------------------------------------------
// Notion property value builders (push direction)
// ---------------------------------------------------------------------------

const title = (text: string) => ({
  title: [{ type: "text" as const, text: { content: text.slice(0, 2000) } }],
});
const richText = (text: string) => ({
  rich_text: [{ type: "text" as const, text: { content: (text || "").slice(0, 2000) } }],
});
const select = (name: string) => ({ select: { name } });
const multiSelect = (names: string[]) => ({
  multi_select: names.map((name) => ({ name })),
});
const number = (n: number) => ({ number: n });
const checkbox = (b: boolean) => ({ checkbox: b });
const date = (isoDate: string) => ({ date: { start: isoDate } });
const url = (href: string | null) => ({ url: href });
const relation = (pageIds: string[]) => ({ relation: pageIds.map((id) => ({ id })) });

export function clientToNotionProperties(c: Client) {
  const s = NOTION_SCHEMA.client;
  return {
    [s.title]: title(c.name),
    [s.status]: select(c.status),
    [s.defaultHourlyRate]: number(c.defaultHourlyRate),
    [s.color]: richText(c.color),
    [s.timezone]: richText(c.timezone),
    [s.notes]: richText(c.notes),
  };
}

export function projectToNotionProperties(p: Project) {
  const s = NOTION_SCHEMA.project;
  return {
    [s.title]: title(p.name),
    [s.status]: select(p.status),
    [s.priority]: select(p.priority),
    [s.description]: richText(p.description),
    [s.tags]: multiSelect(p.tags),
    [s.color]: richText(p.color),
  };
}

export function hoursToNotionProperties(h: HoursEntry) {
  const s = NOTION_SCHEMA.hours;
  return {
    [s.title]: title(h.date),
    [s.startTime]: richText(h.startTime),
    [s.endTime]: richText(h.endTime),
    [s.breakMinutes]: number(h.breakMinutes),
    [s.totalHours]: number(h.totalHours),
    [s.hourlyRate]: number(h.hourlyRate),
    [s.billable]: checkbox(h.billable),
    [s.location]: richText(h.location),
    [s.notes]: richText(h.notes),
    ...(h.projectId ? { [s.project]: relation([h.projectId]) } : {}),
    ...(h.externalId ? { [s.migrationKey]: richText(h.externalId) } : {}),
  };
}

export function worklogToNotionProperties(w: WorkLog) {
  const s = NOTION_SCHEMA.worklog;
  return {
    [s.title]: title(w.title),
    [s.date]: date(w.date),
    [s.status]: select(w.status),
    [s.priority]: select(w.priority),
    [s.summary]: richText(w.summary),
    [s.invoiceDescription]: richText(w.invoiceDescription),
    ...(w.githubLink ? { [s.githubLink]: url(w.githubLink) } : {}),
    ...(w.projectId ? { [s.project]: relation([w.projectId]) } : {}),
    [s.clientVisible]: checkbox(w.clientVisible === true),
    [s.includeInInvoice]: checkbox(w.includeInInvoice === true),
    [s.includeInWorkReport]: checkbox(w.includeInWorkReport === true),
    [s.detailedWorkDescription]: richText(w.detailedWorkDescription ?? w.invoiceDescription),
    [s.internalNotes]: richText(w.internalNotes ?? w.detailedNotes),
    [s.evidenceLinks]: richText((w.evidenceLinks ?? w.evidence).join("\n")),
    ...((w.relatedHoursIds?.length ?? 0) > 0 ? { [s.relatedHours]: relation(w.relatedHoursIds) } : {}),
  };
}

export function knowledgeToNotionProperties(k: KnowledgePage) {
  const s = NOTION_SCHEMA.knowledge;
  return {
    [s.title]: title(k.title),
    [s.type]: select(k.type),
    [s.tags]: multiSelect(k.tags),
    ...(k.projectId ? { [s.project]: relation([k.projectId]) } : {}),
    [s.clientVisible]: checkbox(k.clientVisible === true),
    [s.includeInWorkReport]: checkbox(k.includeInWorkReport === true),
    [s.reportSummary]: richText(k.reportSummary ?? ""),
    ...(k.sourcePage ? { [s.sourcePage]: url(k.sourcePage) } : {}),
  };
}

export function invoiceToNotionProperties(i: InvoiceReport) {
  const s = NOTION_SCHEMA.invoice;
  return {
    [s.title]: title(i.invoiceNumber),
    [s.periodStart]: date(i.periodStart),
    [s.periodEnd]: date(i.periodEnd),
    [s.hourlyRate]: number(i.hourlyRate),
    [s.totalHours]: number(i.totalHours),
    [s.totalAmount]: number(i.totalAmount),
    [s.status]: select(i.status),
    [s.summary]: richText(i.summary),
  };
}

// ---------------------------------------------------------------------------
// Pull direction: extract plain values out of a Notion page's properties.
// Uses `unknown` + narrowing rather than the full Notion SDK property union
// to stay resilient to schema drift on the user's end.
// ---------------------------------------------------------------------------

type NotionPropertyValue = Record<string, unknown>;

export function extractPlainText(prop: NotionPropertyValue | undefined): string {
  if (!prop) return "";
  const arr = (prop.title ?? prop.rich_text) as
    | Array<{ plain_text?: string }>
    | undefined;
  if (!Array.isArray(arr)) return "";
  return arr.map((t) => t.plain_text ?? "").join("");
}

export function extractSelect(prop: NotionPropertyValue | undefined): string | null {
  const select = prop?.select as { name?: string } | null | undefined;
  return select?.name ?? null;
}

export function extractMultiSelect(prop: NotionPropertyValue | undefined): string[] {
  const values = prop?.multi_select as Array<{ name: string }> | undefined;
  return Array.isArray(values) ? values.map((v) => v.name) : [];
}

export function extractNumber(prop: NotionPropertyValue | undefined): number {
  const n = prop?.number;
  return typeof n === "number" ? n : 0;
}

export function extractCheckbox(prop: NotionPropertyValue | undefined): boolean {
  return prop?.checkbox === true;
}

export function extractDate(prop: NotionPropertyValue | undefined): string | null {
  const d = prop?.date as { start?: string } | null | undefined;
  return d?.start ?? null;
}

export function extractUrl(prop: NotionPropertyValue | undefined): string | null {
  const u = prop?.url;
  return typeof u === "string" ? u : null;
}

export function extractRelationIds(prop: NotionPropertyValue | undefined): string[] {
  const rel = prop?.relation as Array<{ id: string }> | undefined;
  return Array.isArray(rel) ? rel.map((r) => r.id) : [];
}

// ---------------------------------------------------------------------------
// Pull direction: parse a Notion page's properties into the scalar subset
// of each domain type. Relation fields (project/client) are resolved by the
// sync engine, which has repository access to look up local ids by
// notionPageId.
// ---------------------------------------------------------------------------

export function clientFromNotionProperties(
  props: Record<string, NotionPropertyValue>,
): Partial<Client> {
  const s = NOTION_SCHEMA.client;
  return {
    name: extractPlainText(props[s.title]),
    status: (extractSelect(props[s.status]) as Client["status"]) ?? "active",
    defaultHourlyRate: extractNumber(props[s.defaultHourlyRate]),
    color: extractPlainText(props[s.color]) || "#6366f1",
    timezone: extractPlainText(props[s.timezone]) || "America/New_York",
    notes: extractPlainText(props[s.notes]),
  };
}

export function projectFromNotionProperties(
  props: Record<string, NotionPropertyValue>,
): Partial<Project> {
  const s = NOTION_SCHEMA.project;
  return {
    name: extractPlainText(props[s.title]),
    status: (extractSelect(props[s.status]) as Project["status"]) ?? "active",
    priority: (extractSelect(props[s.priority]) as Project["priority"]) ?? "medium",
    description: extractPlainText(props[s.description]),
    tags: extractMultiSelect(props[s.tags]),
    color: extractPlainText(props[s.color]) || "#6366f1",
  };
}

export function hoursFromNotionProperties(
  props: Record<string, NotionPropertyValue>,
): Partial<HoursEntry> {
  const s = NOTION_SCHEMA.hours;
  return {
    date: extractDate(props[s.date]) ?? undefined,
    startTime: extractPlainText(props[s.startTime]),
    endTime: extractPlainText(props[s.endTime]),
    breakMinutes: extractNumber(props[s.breakMinutes]),
    totalHours: extractNumber(props[s.totalHours]),
    hourlyRate: extractNumber(props[s.hourlyRate]),
    billable: extractCheckbox(props[s.billable]),
    location: extractPlainText(props[s.location]),
    notes: extractPlainText(props[s.notes]),
  };
}

export function worklogFromNotionProperties(
  props: Record<string, NotionPropertyValue>,
): Partial<WorkLog> {
  const s = NOTION_SCHEMA.worklog;
  return {
    title: extractPlainText(props[s.title]),
    date: extractDate(props[s.date]) ?? undefined,
    status: (extractSelect(props[s.status]) as WorkLog["status"]) ?? "not-started",
    priority: (extractSelect(props[s.priority]) as WorkLog["priority"]) ?? "medium",
    summary: extractPlainText(props[s.summary]),
    invoiceDescription: extractPlainText(props[s.invoiceDescription]),
    githubLink: extractUrl(props[s.githubLink]),
    projectId: extractRelationIds(props[s.project])[0] ?? null,
    clientVisible: extractCheckbox(props[s.clientVisible]),
    includeInInvoice: extractCheckbox(props[s.includeInInvoice]),
    includeInWorkReport: extractCheckbox(props[s.includeInWorkReport]),
    detailedWorkDescription: extractPlainText(props[s.detailedWorkDescription]),
    internalNotes: extractPlainText(props[s.internalNotes]),
    evidenceLinks: extractPlainText(props[s.evidenceLinks]).split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
    relatedHoursIds: extractRelationIds(props[s.relatedHours]),
  };
}

export function knowledgeFromNotionProperties(
  props: Record<string, NotionPropertyValue>,
): Partial<KnowledgePage> {
  const s = NOTION_SCHEMA.knowledge;
  return {
    title: extractPlainText(props[s.title]),
    type: (extractSelect(props[s.type]) as KnowledgePage["type"]) ?? "notes",
    tags: extractMultiSelect(props[s.tags]),
    projectId: extractRelationIds(props[s.project])[0] ?? null,
    clientVisible: extractCheckbox(props[s.clientVisible]),
    includeInWorkReport: extractCheckbox(props[s.includeInWorkReport]),
    reportSummary: extractPlainText(props[s.reportSummary]),
    sourcePage: extractUrl(props[s.sourcePage]),
  };
}

export function invoiceFromNotionProperties(
  props: Record<string, NotionPropertyValue>,
): Partial<InvoiceReport> {
  const s = NOTION_SCHEMA.invoice;
  return {
    invoiceNumber: extractPlainText(props[s.title]),
    periodStart: extractDate(props[s.periodStart]) ?? undefined,
    periodEnd: extractDate(props[s.periodEnd]) ?? undefined,
    hourlyRate: extractNumber(props[s.hourlyRate]),
    totalHours: extractNumber(props[s.totalHours]),
    totalAmount: extractNumber(props[s.totalAmount]),
    status: (extractSelect(props[s.status]) as InvoiceReport["status"]) ?? "draft",
    summary: extractPlainText(props[s.summary]),
  };
}
