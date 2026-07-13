/**
 * Read-only relation backfill preview for July 8–10 live dataset.
 * No Notion writes — compares live rows with proposed relations and IDs.
 */

import { assignSessionIdsForBackfill } from "@/lib/notion/identity/session-id";
import { assignWorkLogIdsForBackfill } from "@/lib/notion/identity/work-log-id";
import { isSupersededHours, supersededDiagnosticReason } from "@/lib/notion/quarantine";
import {
  matchAllHoursToWork,
  MATCH_SOURCE_LABELS,
  type MatchSource,
} from "@/lib/reports/relation-matching";
import {
  JULY8_10_CLIENT,
  JULY8_10_HOURS,
  JULY8_10_HOURLY_RATE,
  JULY8_10_OPERATIONAL_TOTALS,
  JULY8_10_PROJECTS,
  JULY8_10_WORK_DONE,
  operationalHoursRows,
  quarantineHoursRows,
  type July810HoursRow,
  type July810WorkRow,
} from "./july8-10-source";
import { exactElapsedMinutes, amountFromExactMinutes } from "@/lib/reports/engine";

export interface BackfillFieldProposal {
  property: string;
  currentValue: string | null;
  proposedValue: string | null;
}

export interface BackfillRowPreview {
  entity: "hours" | "work-done";
  pageId: string;
  url: string;
  label: string;
  fields: BackfillFieldProposal[];
  warnings: string[];
  superseded: boolean;
  matchSource?: MatchSource;
  matchSourceLabel?: string;
}

export interface BackfillPreviewTotals {
  billableMinutes: number;
  nonBillableMinutes: number;
  billableHours: number;
  operationalHours: number;
  amount: number;
  expected: typeof JULY8_10_OPERATIONAL_TOTALS;
  matchesExpected: boolean;
}

export interface RelationBackfillPreview {
  readOnly: true;
  writesPerformed: false;
  period: { start: "2026-07-08"; end: "2026-07-10" };
  client: string;
  rows: BackfillRowPreview[];
  duplicates: string[];
  ambiguousMatches: Array<{ hoursId: string; workId: string; reason: string }>;
  quarantineRows: BackfillRowPreview[];
  totals: BackfillPreviewTotals;
  diagnostics: string[];
}

export interface LiveNotionRow {
  id: string;
  url?: string | null;
  entity: "hours" | "work-done";
  date: string;
  startTime?: string;
  endTime?: string;
  title?: string;
  migrationKey?: string | null;
  sessionId?: string | null;
  workLogId?: string | null;
  billingStatus?: string | null;
  approvalStatus?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  clientId?: string | null;
  clientName?: string | null;
  relatedWorkDoneIds?: string[];
  relatedHoursIds?: string[];
  billable?: boolean;
}

function syntheticUrl(pageId: string): string {
  return `https://www.notion.so/${pageId.replace(/-/g, "")}`;
}

function hoursLabel(row: July810HoursRow | LiveNotionRow): string {
  const start = "startTime" in row ? row.startTime : "";
  const end = "endTime" in row ? row.endTime : "";
  return `${row.date} ${start}–${end}`;
}

function buildHoursPreview(
  source: July810HoursRow,
  live: LiveNotionRow | undefined,
  sessionId: string,
  relatedWorkId: string | null,
  matchSource: MatchSource,
): BackfillRowPreview {
  const warnings: string[] = [];
  const superseded = source.superseded || isSupersededHours({ migrationKey: source.migrationKey });
  if (superseded) {
    const diag = supersededDiagnosticReason({ migrationKey: source.migrationKey });
    if (diag) warnings.push(diag);
  }
  const proposedBilling = superseded ? "Superseded" : source.billable ? "Ready to Invoice" : "Draft";
  return {
    entity: "hours",
    pageId: live?.id ?? source.id,
    url: live?.url ?? syntheticUrl(source.id),
    label: hoursLabel(source),
    superseded,
    matchSource,
    matchSourceLabel: MATCH_SOURCE_LABELS[matchSource],
    fields: [
      { property: "Session ID", currentValue: live?.sessionId ?? null, proposedValue: sessionId },
      { property: "Client", currentValue: live?.clientName ?? null, proposedValue: JULY8_10_CLIENT },
      { property: "Project", currentValue: live?.projectName ?? null, proposedValue: source.projectName },
      { property: "Related Work Done", currentValue: live?.relatedWorkDoneIds?.join(", ") ?? null, proposedValue: relatedWorkId },
      { property: "Billing Status", currentValue: live?.billingStatus ?? null, proposedValue: proposedBilling },
      { property: "Migration Key", currentValue: live?.migrationKey ?? null, proposedValue: source.migrationKey },
    ],
    warnings,
  };
}

function buildWorkPreview(
  source: July810WorkRow,
  live: LiveNotionRow | undefined,
  workLogId: string,
  relatedHoursIds: string[],
): BackfillRowPreview {
  const projectName = source.projectKey ? JULY8_10_PROJECTS[source.projectKey].name : null;
  return {
    entity: "work-done",
    pageId: live?.id ?? source.id,
    url: live?.url ?? syntheticUrl(source.id),
    label: source.title,
    superseded: false,
    fields: [
      { property: "Work Log ID", currentValue: live?.workLogId ?? null, proposedValue: workLogId },
      { property: "Client", currentValue: live?.clientName ?? null, proposedValue: JULY8_10_CLIENT },
      { property: "Project", currentValue: live?.projectName ?? null, proposedValue: projectName },
      { property: "Related Hours", currentValue: live?.relatedHoursIds?.join(", ") ?? null, proposedValue: relatedHoursIds.join(", ") },
      { property: "Approval Status", currentValue: live?.approvalStatus ?? null, proposedValue: "Approved" },
    ],
    warnings: [],
  };
}

function computeTotals(rows: July810HoursRow[]): BackfillPreviewTotals {
  let billableMinutes = 0;
  let nonBillableMinutes = 0;
  for (const row of rows) {
    if (row.superseded) continue;
    const minutes = exactElapsedMinutes(row.startTime, row.endTime, 0);
    if (row.billable) billableMinutes += minutes;
    else nonBillableMinutes += minutes;
  }
  const billableHours = Math.round((billableMinutes / 60) * 100) / 100;
  const operationalHours = Math.round(((billableMinutes + nonBillableMinutes) / 60) * 100) / 100;
  const amount = amountFromExactMinutes(billableMinutes, JULY8_10_HOURLY_RATE);
  const expected = JULY8_10_OPERATIONAL_TOTALS;
  return {
    billableMinutes,
    nonBillableMinutes,
    billableHours,
    operationalHours,
    amount,
    expected,
    matchesExpected:
      billableMinutes === expected.billableMinutes &&
      nonBillableMinutes === expected.nonBillableMinutes &&
      amount === expected.amount,
  };
}

function findDuplicateSessionIds(sessionIds: Map<string, string>): string[] {
  const seen = new Map<string, string>();
  const duplicates: string[] = [];
  for (const [recordId, sessionId] of sessionIds) {
    const prior = seen.get(sessionId);
    if (prior) duplicates.push(`Session ID ${sessionId} assigned to ${prior} and ${recordId}`);
    else seen.set(sessionId, recordId);
  }
  return duplicates;
}

/** Build preview from canonical July 8–10 source data (no live Notion required). */
export function buildRelationBackfillPreview(liveRows: LiveNotionRow[] = []): RelationBackfillPreview {
  const liveHours = new Map(liveRows.filter((r) => r.entity === "hours").map((r) => [r.id, r]));
  const liveWork = new Map(liveRows.filter((r) => r.entity === "work-done").map((r) => [r.id, r]));

  const sessionIds = assignSessionIdsForBackfill(
    JULY8_10_HOURS.map((h) => ({ id: h.id, date: h.date, startTime: h.startTime, migrationKey: h.migrationKey })),
  );
  const workLogIds = assignWorkLogIdsForBackfill(JULY8_10_WORK_DONE);

  const matchableHours = JULY8_10_HOURS.map((h) => ({
    id: h.id,
    date: h.date,
    projectId: h.projectKey,
    relatedWorkLogId: JULY8_10_WORK_DONE.find((w) => w.relatedHoursIds.includes(h.id))?.id ?? null,
    relatedWorkDoneIds: [],
  }));
  const matchableWork = JULY8_10_WORK_DONE.map((w) => ({
    id: w.id,
    date: w.date,
    projectId: w.projectKey,
    relatedHoursIds: w.relatedHoursIds,
    clientVisible: true,
    includeInInvoice: true,
    approvalStatus: "Approved",
  }));
  const matching = matchAllHoursToWork(matchableHours, matchableWork);

  const ambiguousMatches = matching.matches
    .filter((m) => m.source === "ambiguous")
    .map((m) => ({ hoursId: m.hoursId, workId: m.workId, reason: m.reason }));

  const rows: BackfillRowPreview[] = [];
  for (const hours of JULY8_10_HOURS) {
    const match = matching.byHours.get(hours.id);
    const relatedWorkId = match?.workId ?? JULY8_10_WORK_DONE.find((w) => w.relatedHoursIds.includes(hours.id))?.id ?? null;
    rows.push(
      buildHoursPreview(
        hours,
        liveHours.get(hours.id),
        sessionIds.get(hours.id) ?? "",
        relatedWorkId,
        match?.source ?? "explicit",
      ),
    );
  }
  for (const work of JULY8_10_WORK_DONE) {
    rows.push(
      buildWorkPreview(work, liveWork.get(work.id), workLogIds.get(work.id) ?? "", work.relatedHoursIds),
    );
  }

  const quarantineRows = rows.filter((r) => r.superseded);
  const diagnostics = quarantineHoursRows().map(
    (q) => supersededDiagnosticReason({ migrationKey: q.migrationKey }) ?? "Superseded historical record",
  );

  return {
    readOnly: true,
    writesPerformed: false,
    period: { start: "2026-07-08", end: "2026-07-10" },
    client: JULY8_10_CLIENT,
    rows,
    duplicates: findDuplicateSessionIds(sessionIds),
    ambiguousMatches,
    quarantineRows,
    totals: computeTotals(JULY8_10_HOURS),
    diagnostics,
  };
}

/** Immutable: repeated calls with same input yield deep-equal preview. */
export function isImmutablePreview(a: RelationBackfillPreview, b: RelationBackfillPreview): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export { operationalHoursRows, quarantineHoursRows };
