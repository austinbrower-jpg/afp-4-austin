/**
 * Phase 12B: targeted pages.update for approved July 8–10 relation backfill.
 * Schema metadata only — never touches narrative, times, rates, or amounts.
 */
import { assignSessionIdsForBackfill } from "@/lib/notion/identity/session-id";
import { assignWorkLogIdsForBackfill } from "@/lib/notion/identity/work-log-id";
import type { NotionWriteClient } from "./one-time-import";
import {
  buildRelationBackfillPreview,
  type LiveNotionRow,
} from "../relation-backfill/preview";
import {
  JULY8_10_CLIENT,
  JULY8_10_HOURS,
  JULY8_10_OPERATIONAL_TOTALS,
  JULY8_10_WORK_DONE,
  type July810HoursRow,
  type July810WorkRow,
} from "../relation-backfill/july8-10-source";
import {
  fetchAllIdentityIds,
  fetchLiveClients,
  fetchLiveJulyHoursAndWork,
  fetchLiveProjects,
  type BackfillDatabaseIds,
  type LiveClientRow,
  type LiveProjectRow,
} from "../relation-backfill/live-fetch";
import { isSupersededMigrationKey } from "@/lib/notion/quarantine";
import {
  composeDetailedInvoice,
  composeSimpleInvoice,
  composeWorkLogReport,
} from "@/lib/reports/engine";
import { buildJuly810ReportDataset } from "../relation-backfill/july8-10-dataset";
import { DEFAULT_REPORT_SETTINGS } from "@/lib/reports/types";

export const APPROVED_PROJECT_CLIENT_NAMES = [
  "BOL Review Process V2",
  "Power Automate Documentation",
  "AFP Command Center / Sales & Operations Hub",
  "AFP Invoice Workspace",
  "Digital Systems Audit & Process Documentation",
] as const;

/** Approved billing statuses (override preview defaults for non-billable row). */
export const APPROVED_BILLING_STATUS: Record<string, string> = {
  "hrs-jul8-onsite": "Reviewed",
  "hrs-jul8-bol": "Ready to Invoice",
  "hrs-jul8-padocs": "Ready to Invoice",
  "hrs-jul8-quarantine": "Superseded",
  "hrs-jul9-bol": "Ready to Invoice",
  "hrs-jul10-bol": "Ready to Invoice",
};

export interface BackfillApplyClient extends NotionWriteClient {
  pages: NotionWriteClient["pages"] & {
    update: (args: { page_id: string; properties: Record<string, unknown> }) => Promise<{ id: string; url?: string }>;
  };
}

export interface MappedLiveRows {
  hoursBySourceId: Map<string, LiveNotionRow>;
  workBySourceId: Map<string, LiveNotionRow>;
  client: LiveClientRow;
  projectsByName: Map<string, LiveProjectRow>;
  sessionIds: Map<string, string>;
  workLogIds: Map<string, string>;
}

export interface ProposedPageUpdate {
  phase: string;
  pageId: string;
  label: string;
  properties: Record<string, unknown>;
  values: Record<string, string>;
  skip?: boolean;
  skipReason?: string;
}

export interface PreflightResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  mapped: MappedLiveRows | null;
  writePlan: ProposedPageUpdate[];
  preview: ReturnType<typeof buildRelationBackfillPreview>;
}

export interface ApplyUpdateRecord {
  phase: string;
  pageId: string;
  label: string;
  values: Record<string, string>;
}

export interface ApplyResult {
  preflight: PreflightResult;
  applied: ApplyUpdateRecord[];
  skipped: ApplyUpdateRecord[];
  stoppedEarly: boolean;
  error?: string;
  postPreview?: ReturnType<typeof buildRelationBackfillPreview>;
  reportVerification?: ReportVerificationResult;
}

export interface ReportVerificationResult {
  simpleInvoiceAmount: number;
  detailedInvoiceSessionCount: number;
  workLogReportDates: string[];
  allExplicitMatches: boolean;
  supersededExcluded: boolean;
  internalNotesExcluded: boolean;
}

const richText = (text: string) => ({
  rich_text: [{ type: "text" as const, text: { content: text.slice(0, 2000) } }],
});
const select = (name: string) => ({ select: { name } });
const relation = (pageIds: string[]) => ({ relation: pageIds.map((id) => ({ id })) });

function normalizeTime(value: string): string {
  const parts = value.trim().split(":");
  if (parts.length < 2) return value.trim();
  return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
}

function relationSetEqual(a: string[] | undefined, b: string[]): boolean {
  const left = [...(a ?? [])].sort();
  const right = [...b].sort();
  return left.length === right.length && left.every((id, i) => id === right[i]);
}

function mapHoursToLive(hoursLive: LiveNotionRow[]): Map<string, LiveNotionRow> {
  const mapped = new Map<string, LiveNotionRow>();
  for (const source of JULY8_10_HOURS) {
    const live = hoursLive.find(
      (r) =>
        r.date === source.date &&
        normalizeTime(r.startTime ?? "") === normalizeTime(source.startTime) &&
        normalizeTime(r.endTime ?? "") === normalizeTime(source.endTime),
    );
    if (live) mapped.set(source.id, live);
  }
  return mapped;
}

function mapWorkToLive(workLive: LiveNotionRow[]): Map<string, LiveNotionRow> {
  const mapped = new Map<string, LiveNotionRow>();
  for (const source of JULY8_10_WORK_DONE) {
    const onDate = workLive.filter((r) => r.date === source.date);
    const live =
      onDate.length === 1
        ? onDate[0]
        : workLive.find((r) => r.date === source.date && r.title === source.title);
    if (live) mapped.set(source.id, live);
  }
  return mapped;
}

function hoursSourceLabel(source: July810HoursRow): string {
  return `${source.date} ${source.startTime}–${source.endTime}`;
}

function verifyHoursRow(source: July810HoursRow, live: LiveNotionRow | undefined): string[] {
  const errors: string[] = [];
  if (!live) {
    errors.push(`Missing live hours row for ${hoursSourceLabel(source)} (migration key ${source.migrationKey})`);
    return errors;
  }
  if (live.date !== source.date) errors.push(`${hoursSourceLabel(source)}: date mismatch live=${live.date}`);
  if (normalizeTime(live.startTime ?? "") !== normalizeTime(source.startTime)) {
    errors.push(`${hoursSourceLabel(source)}: start time mismatch live=${live.startTime}`);
  }
  if (normalizeTime(live.endTime ?? "") !== normalizeTime(source.endTime)) {
    errors.push(`${hoursSourceLabel(source)}: end time mismatch live=${live.endTime}`);
  }
  if (source.superseded) {
    if (!isSupersededMigrationKey(live.migrationKey)) {
      errors.push(`${hoursSourceLabel(source)}: expected superseded migration key, live=${live.migrationKey}`);
    }
  } else if (!live.migrationKey?.includes(source.date)) {
    errors.push(`${hoursSourceLabel(source)}: migration key missing date segment live=${live.migrationKey}`);
  }
  if (!source.superseded && live.billable !== source.billable) {
    errors.push(`${hoursSourceLabel(source)}: billable mismatch live=${live.billable}`);
  }
  if (!source.superseded && (live.projectName ?? null) !== (source.projectName ?? null)) {
    errors.push(`${hoursSourceLabel(source)}: project mismatch live=${live.projectName ?? "none"}`);
  }
  return errors;
}

function verifyWorkRow(source: July810WorkRow, live: LiveNotionRow | undefined): string[] {
  const errors: string[] = [];
  if (!live) {
    errors.push(`Missing live work-done row for ${source.title} (${source.date})`);
    return errors;
  }
  if (live.date !== source.date) errors.push(`${source.title}: date mismatch`);
  return errors;
}

function checkIdentityConflicts(
  mapped: MappedLiveRows,
  allSessionIds: Map<string, string>,
  allWorkLogIds: Map<string, string>,
): string[] {
  const errors: string[] = [];
  for (const [sourceId, sessionId] of mapped.sessionIds) {
    const owner = allSessionIds.get(sessionId);
    const live = mapped.hoursBySourceId.get(sourceId);
    if (owner && live && owner !== live.id) {
      errors.push(`Session ID ${sessionId} already assigned to another page (${owner})`);
    }
  }
  for (const [sourceId, workLogId] of mapped.workLogIds) {
    const owner = allWorkLogIds.get(workLogId);
    const live = mapped.workBySourceId.get(sourceId);
    if (owner && live && owner !== live.id) {
      errors.push(`Work Log ID ${workLogId} already assigned to another page (${owner})`);
    }
  }
  return errors;
}

function checkConflictingLifecycle(
  mapped: MappedLiveRows,
  hoursBySourceId: Map<string, July810HoursRow>,
): string[] {
  const errors: string[] = [];
  for (const [sourceId, live] of mapped.hoursBySourceId) {
    const source = hoursBySourceId.get(sourceId);
    if (!source) continue;
    const approvedBilling = APPROVED_BILLING_STATUS[sourceId];
    const approvedSession = mapped.sessionIds.get(sourceId);
    if (live.sessionId && approvedSession && live.sessionId !== approvedSession) {
      errors.push(`${hoursSourceLabel(source)}: conflicting Session ID ${live.sessionId}`);
    }
    if (live.billingStatus && approvedBilling && live.billingStatus !== approvedBilling) {
      errors.push(`${hoursSourceLabel(source)}: conflicting Billing Status ${live.billingStatus}`);
    }
  }
  for (const [sourceId, live] of mapped.workBySourceId) {
    const approvedWorkLog = mapped.workLogIds.get(sourceId);
    if (live.workLogId && approvedWorkLog && live.workLogId !== approvedWorkLog) {
      errors.push(`${live.title}: conflicting Work Log ID ${live.workLogId}`);
    }
    if (
      live.approvalStatus &&
      live.approvalStatus !== "Approved" &&
      live.approvalStatus.toLowerCase() !== "approved"
    ) {
      errors.push(`${live.title}: conflicting Approval Status ${live.approvalStatus}`);
    }
  }
  return errors;
}

export function buildWritePlan(mapped: MappedLiveRows): ProposedPageUpdate[] {
  const plan: ProposedPageUpdate[] = [];
  const clientId = mapped.client.id;

  for (const name of APPROVED_PROJECT_CLIENT_NAMES) {
    const project = mapped.projectsByName.get(name);
    if (!project) continue;
    const values = { Client: JULY8_10_CLIENT };
    const skip = relationSetEqual(project.clientIds, [clientId]);
    plan.push({
      phase: "1-projects-client",
      pageId: project.id,
      label: `Project: ${name}`,
      properties: skip ? {} : { Client: relation([clientId]) },
      values,
      skip,
      skipReason: skip ? "Client relation already set" : undefined,
    });
  }

  for (const source of JULY8_10_HOURS) {
    const live = mapped.hoursBySourceId.get(source.id);
    if (!live) continue;
    const sessionId = mapped.sessionIds.get(source.id) ?? "";
    const billingStatus = APPROVED_BILLING_STATUS[source.id] ?? "Ready to Invoice";
    const label = hoursSourceLabel(source);

    const sessionSkip = (live.sessionId ?? "") === sessionId;
    plan.push({
      phase: "2-hours-session-id",
      pageId: live.id,
      label,
      properties: sessionSkip ? {} : { "Session ID": richText(sessionId) },
      values: { "Session ID": sessionId },
      skip: sessionSkip,
      skipReason: sessionSkip ? "Session ID already set" : undefined,
    });

    const clientSkip = live.clientId === clientId;
    plan.push({
      phase: "2-hours-client",
      pageId: live.id,
      label,
      properties: clientSkip ? {} : { Client: relation([clientId]) },
      values: { Client: JULY8_10_CLIENT },
      skip: clientSkip,
      skipReason: clientSkip ? "Client already set" : undefined,
    });

    const billingSkip = live.billingStatus === billingStatus;
    plan.push({
      phase: "2-hours-billing-status",
      pageId: live.id,
      label,
      properties: billingSkip ? {} : { "Billing Status": select(billingStatus) },
      values: { "Billing Status": billingStatus },
      skip: billingSkip,
      skipReason: billingSkip ? "Billing Status already set" : undefined,
    });
  }

  for (const source of JULY8_10_WORK_DONE) {
    const live = mapped.workBySourceId.get(source.id);
    if (!live) continue;
    const workLogId = mapped.workLogIds.get(source.id) ?? "";
    const label = source.title;

    const idSkip = (live.workLogId ?? "") === workLogId;
    plan.push({
      phase: "3-work-work-log-id",
      pageId: live.id,
      label,
      properties: idSkip ? {} : { "Work Log ID": richText(workLogId) },
      values: { "Work Log ID": workLogId },
      skip: idSkip,
      skipReason: idSkip ? "Work Log ID already set" : undefined,
    });

    const clientSkip = live.clientId === clientId;
    plan.push({
      phase: "3-work-client",
      pageId: live.id,
      label,
      properties: clientSkip ? {} : { Client: relation([clientId]) },
      values: { Client: JULY8_10_CLIENT },
      skip: clientSkip,
      skipReason: clientSkip ? "Client already set" : undefined,
    });

    const approvalSkip = live.approvalStatus === "Approved";
    plan.push({
      phase: "3-work-approval-status",
      pageId: live.id,
      label,
      properties: approvalSkip ? {} : { "Approval Status": select("Approved") },
      values: { "Approval Status": "Approved" },
      skip: approvalSkip,
      skipReason: approvalSkip ? "Approval Status already set" : undefined,
    });
  }

  for (const source of JULY8_10_HOURS) {
    if (source.superseded) continue;
    const live = mapped.hoursBySourceId.get(source.id);
    if (!live) continue;
    const workSource = JULY8_10_WORK_DONE.find((w) => w.relatedHoursIds.includes(source.id));
    const workLive = workSource ? mapped.workBySourceId.get(workSource.id) : undefined;
    const targetIds = workLive ? [workLive.id] : [];
    const skip = relationSetEqual(live.relatedWorkDoneIds, targetIds);
    plan.push({
      phase: "4-hours-related-work-done",
      pageId: live.id,
      label: hoursSourceLabel(source),
      properties: skip ? {} : { "Related Work Done": relation(targetIds) },
      values: { "Related Work Done": workSource?.title ?? "none" },
      skip,
      skipReason: skip ? "Related Work Done already set" : undefined,
    });
  }

  for (const source of JULY8_10_WORK_DONE) {
    const live = mapped.workBySourceId.get(source.id);
    if (!live) continue;
    const hourPageIds = source.relatedHoursIds
      .map((hid) => mapped.hoursBySourceId.get(hid)?.id)
      .filter((id): id is string => Boolean(id));
    const skip = relationSetEqual(live.relatedHoursIds, hourPageIds);
    plan.push({
      phase: "5-work-related-hours",
      pageId: live.id,
      label: source.title,
      properties: skip ? {} : { "Related Hours": relation(hourPageIds) },
      values: {
        "Related Hours": source.relatedHoursIds
          .map((hid) => mapped.sessionIds.get(hid) ?? hid)
          .join(", "),
      },
      skip,
      skipReason: skip ? "Related Hours already set" : undefined,
    });
  }

  return plan;
}

export async function runRelationBackfillPreflight(
  notion: BackfillApplyClient,
  databaseIds: BackfillDatabaseIds,
): Promise<PreflightResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const [liveJuly, clients, projects, identityIds] = await Promise.all([
    fetchLiveJulyHoursAndWork(notion, databaseIds),
    fetchLiveClients(notion, databaseIds.client),
    fetchLiveProjects(notion, databaseIds.project),
    fetchAllIdentityIds(notion, databaseIds),
  ]);

  const hoursLive = liveJuly.filter((r) => r.entity === "hours");
  const workLive = liveJuly.filter((r) => r.entity === "work-done");

  const hoursBySourceId = mapHoursToLive(hoursLive);
  const workBySourceId = mapWorkToLive(workLive);

  for (const source of JULY8_10_HOURS) {
    errors.push(...verifyHoursRow(source, hoursBySourceId.get(source.id)));
  }
  for (const source of JULY8_10_WORK_DONE) {
    errors.push(...verifyWorkRow(source, workBySourceId.get(source.id)));
  }

  const client = clients.find((c) => c.name === JULY8_10_CLIENT);
  if (!client) errors.push(`Client not found: ${JULY8_10_CLIENT}`);

  const projectsByName = new Map<string, LiveProjectRow>();
  for (const name of APPROVED_PROJECT_CLIENT_NAMES) {
    const project = projects.find((p) => p.name === name);
    if (!project) warnings.push(`Project not found (will skip Client relation): ${name}`);
    else projectsByName.set(name, project);
  }

  const sessionIds = assignSessionIdsForBackfill(
    JULY8_10_HOURS.map((h) => ({ id: h.id, date: h.date, startTime: h.startTime, migrationKey: h.migrationKey })),
  );
  const workLogIds = assignWorkLogIdsForBackfill(JULY8_10_WORK_DONE);

  const mapped: MappedLiveRows | null = client
    ? {
        hoursBySourceId,
        workBySourceId,
        client,
        projectsByName,
        sessionIds,
        workLogIds,
      }
    : null;

  if (mapped) {
    errors.push(...checkIdentityConflicts(mapped, identityIds.sessionIds, identityIds.workLogIds));
    errors.push(...checkConflictingLifecycle(mapped, new Map(JULY8_10_HOURS.map((h) => [h.id, h]))));
  }

  const previewLiveRows: LiveNotionRow[] = [];
  if (mapped) {
    for (const [sourceId, live] of mapped.hoursBySourceId) {
      previewLiveRows.push({ ...live, id: sourceId });
    }
    for (const [sourceId, live] of mapped.workBySourceId) {
      previewLiveRows.push({ ...live, id: sourceId });
    }
  }
  const preview = buildRelationBackfillPreview(previewLiveRows);

  if (preview.ambiguousMatches.length > 0) {
    errors.push(`Ambiguous matches: ${preview.ambiguousMatches.length}`);
  }
  if (preview.duplicates.length > 0) {
    errors.push(...preview.duplicates);
  }
  if (!preview.totals.matchesExpected) {
    errors.push(
      `Totals mismatch: billable=${preview.totals.billableMinutes} nonBillable=${preview.totals.nonBillableMinutes} amount=${preview.totals.amount}`,
    );
  }

  const writePlan = mapped ? buildWritePlan(mapped) : [];

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    mapped,
    writePlan,
    preview,
  };
}

export async function applyRelationBackfill(
  notion: BackfillApplyClient,
  databaseIds: BackfillDatabaseIds,
): Promise<ApplyResult> {
  const preflight = await runRelationBackfillPreflight(notion, databaseIds);
  const applied: ApplyUpdateRecord[] = [];
  const skipped: ApplyUpdateRecord[] = [];

  if (!preflight.ok || !preflight.mapped) {
    return { preflight, applied, skipped, stoppedEarly: true, error: preflight.errors.join("; ") };
  }

  for (const step of preflight.writePlan) {
    const record: ApplyUpdateRecord = {
      phase: step.phase,
      pageId: step.pageId,
      label: step.label,
      values: step.values,
    };
    if (step.skip || Object.keys(step.properties).length === 0) {
      skipped.push({ ...record, values: { ...record.values, _reason: step.skipReason ?? "skip" } });
      continue;
    }
    try {
      await notion.pages.update({ page_id: step.pageId, properties: step.properties });
      applied.push(record);
    } catch (err) {
      return {
        preflight,
        applied,
        skipped,
        stoppedEarly: true,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  const postLive = await fetchLiveJulyHoursAndWork(notion, databaseIds);
  const postPreviewRows: LiveNotionRow[] = [];
  const hoursLive = postLive.filter((r) => r.entity === "hours");
  const workLive = postLive.filter((r) => r.entity === "work-done");
  const postHoursBySource = mapHoursToLive(hoursLive);
  const postWorkBySource = mapWorkToLive(workLive);
  for (const [sourceId, live] of postHoursBySource) {
    postPreviewRows.push({ ...live, id: sourceId });
  }
  for (const [sourceId, live] of postWorkBySource) {
    postPreviewRows.push({ ...live, id: sourceId });
  }
  const postPreview = buildRelationBackfillPreview(postPreviewRows);
  const reportVerification = verifyJuly810Reports();

  return {
    preflight,
    applied,
    skipped,
    stoppedEarly: false,
    postPreview,
    reportVerification,
  };
}

export function verifyJuly810Reports(): ReportVerificationResult {
  const dataset = buildJuly810ReportDataset();
  const input = {
    clientId: dataset.clients[0].id,
    periodStart: "2026-07-08",
    periodEnd: "2026-07-10",
    projectIds: [] as string[],
    invoiceNumber: "AFP-2026-010",
    invoiceDate: "2026-07-11",
    paymentTerms: "Net 15",
    dueDate: "2026-07-26",
    customTitle: "",
    notes: "",
    executiveSummary: "",
    draftDescriptions: {} as Record<string, string>,
  };
  const simple = composeSimpleInvoice(dataset, DEFAULT_REPORT_SETTINGS, input);
  const detailed = composeDetailedInvoice(dataset, DEFAULT_REPORT_SETTINGS, input);
  const workLog = composeWorkLogReport(dataset, DEFAULT_REPORT_SETTINGS, input);

  const badExcluded = simple.excludedRecords.filter(
    (r) =>
      r.kind === "hours" &&
      r.matchSource &&
      (r.matchSource.includes("Legacy") || r.matchSource.includes("Ambiguous")),
  );
  const supersededExcluded = simple.excludedRecords.some((r) => r.matchSource === "Superseded");

  return {
    simpleInvoiceAmount: simple.totals.amountDue,
    detailedInvoiceSessionCount: detailed.sessions.filter((s) => s.billable).length,
    workLogReportDates: [...new Set(workLog.workItems.map((w) => w.date))].sort(),
    allExplicitMatches: badExcluded.length === 0,
    supersededExcluded,
    internalNotesExcluded: !workLog.workItems.some((w) => w.title.toLowerCase().includes("internal notes")),
  };
}

export { JULY8_10_OPERATIONAL_TOTALS };
