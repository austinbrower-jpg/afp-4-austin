/**
 * Explicit relation matching for Report Builder and invoice inclusion.
 * Matching order:
 * 1. Hours → Related Work Done (explicit)
 * 2. Work Done → Related Hours (reciprocal)
 * 3. Legacy date + project fallback
 * 4. Reject ambiguous fallback matches
 * 5. Never match date-only when multiple candidates exist
 */

export type MatchSource = "explicit" | "reciprocal" | "legacy-fallback" | "ambiguous" | "missing";

export interface MatchableHours {
  id: string;
  date: string;
  projectId: string | null;
  relatedWorkLogId?: string | null;
  relatedWorkDoneIds?: string[];
}

export interface MatchableWork {
  id: string;
  date: string;
  projectId: string | null;
  relatedHoursIds: string[];
  clientVisible?: boolean | null;
  includeInInvoice?: boolean | null;
  includeInWorkReport?: boolean | null;
  approvalStatus?: string | null;
  status?: string;
}

export interface HoursWorkMatch {
  hoursId: string;
  workId: string;
  source: MatchSource;
  reason: string;
}

export interface MatchHoursToWorkResult {
  matches: HoursWorkMatch[];
  /** workId → hoursIds matched to it */
  byWork: Map<string, string[]>;
  /** hoursId → workId (only unambiguous matches) */
  byHours: Map<string, { workId: string; source: MatchSource }>;
}

function explicitMatches(hours: MatchableHours, workRecords: readonly MatchableWork[]): HoursWorkMatch[] {
  const relatedIds = new Set([
    ...(hours.relatedWorkDoneIds ?? []),
    ...(hours.relatedWorkLogId ? [hours.relatedWorkLogId] : []),
  ]);
  if (relatedIds.size === 0) return [];
  return workRecords
    .filter((work) => relatedIds.has(work.id))
    .map((work) => ({
      hoursId: hours.id,
      workId: work.id,
      source: "explicit" as const,
      reason: "Hours → Related Work Done relation",
    }));
}

function reciprocalMatches(
  hours: MatchableHours,
  workRecords: readonly MatchableWork[],
  excludeWorkIds: Set<string>,
): HoursWorkMatch[] {
  return workRecords
    .filter((work) => !excludeWorkIds.has(work.id) && work.relatedHoursIds.includes(hours.id))
    .map((work) => ({
      hoursId: hours.id,
      workId: work.id,
      source: "reciprocal" as const,
      reason: "Work Done → Related Hours reciprocal relation",
    }));
}

function legacyFallbackMatches(
  hours: MatchableHours,
  workRecords: readonly MatchableWork[],
  excludeWorkIds: Set<string>,
): HoursWorkMatch[] {
  const candidates = workRecords.filter((work) => {
    if (excludeWorkIds.has(work.id)) return false;
    if (work.date !== hours.date) return false;
    if (hours.projectId === null || work.projectId === null) return false;
    return work.projectId === hours.projectId;
  });
  if (candidates.length === 0) return [];
  if (candidates.length > 1) {
    return candidates.map((work) => ({
      hoursId: hours.id,
      workId: work.id,
      source: "ambiguous" as const,
      reason: `Legacy date+project fallback found ${candidates.length} candidates`,
    }));
  }
  return [{
    hoursId: hours.id,
    workId: candidates[0].id,
    source: "legacy-fallback" as const,
    reason: "Legacy date + project fallback (single candidate)",
  }];
}

function dateOnlyCandidates(hours: MatchableHours, workRecords: readonly MatchableWork[]): MatchableWork[] {
  return workRecords.filter((work) => work.date === hours.date);
}

export function matchHoursToWork(
  hours: MatchableHours,
  workRecords: readonly MatchableWork[],
): HoursWorkMatch[] {
  const explicit = explicitMatches(hours, workRecords);
  if (explicit.length === 1) return explicit;
  if (explicit.length > 1) {
    return explicit.map((m) => ({
      ...m,
      source: "ambiguous" as const,
      reason: `Multiple explicit Related Work Done relations (${explicit.length})`,
    }));
  }

  const excludeExplicit = new Set(explicit.map((m) => m.workId));
  const reciprocal = reciprocalMatches(hours, workRecords, excludeExplicit);
  if (reciprocal.length === 1) return reciprocal;
  if (reciprocal.length > 1) {
    return reciprocal.map((m) => ({
      ...m,
      source: "ambiguous" as const,
      reason: `Multiple reciprocal Related Hours relations (${reciprocal.length})`,
    }));
  }

  const excludeReciprocal = new Set([...excludeExplicit, ...reciprocal.map((m) => m.workId)]);
  const legacy = legacyFallbackMatches(hours, workRecords, excludeReciprocal);
  if (legacy.length > 0) {
    if (legacy.some((m) => m.source === "ambiguous")) return legacy;
    return legacy;
  }

  const dateOnly = dateOnlyCandidates(hours, workRecords);
  if (dateOnly.length > 1) {
    return [{
      hoursId: hours.id,
      workId: dateOnly[0].id,
      source: "ambiguous",
      reason: `Date-only fallback rejected: ${dateOnly.length} Work Done rows on ${hours.date}`,
    }];
  }

  return [{
    hoursId: hours.id,
    workId: "",
    source: "missing",
    reason: "No explicit, reciprocal, or unambiguous legacy match",
  }];
}

export function matchAllHoursToWork(
  hoursRecords: readonly MatchableHours[],
  workRecords: readonly MatchableWork[],
): MatchHoursToWorkResult {
  const matches: HoursWorkMatch[] = [];
  const byWork = new Map<string, string[]>();
  const byHours = new Map<string, { workId: string; source: MatchSource }>();

  for (const hours of hoursRecords) {
    const result = matchHoursToWork(hours, workRecords);
    matches.push(...result);
    const unambiguous = result.filter((m) => m.source !== "ambiguous" && m.source !== "missing" && m.workId);
    if (unambiguous.length === 1) {
      const m = unambiguous[0];
      byHours.set(hours.id, { workId: m.workId, source: m.source });
      const list = byWork.get(m.workId) ?? [];
      list.push(hours.id);
      byWork.set(m.workId, list);
    }
  }

  return { matches, byWork, byHours };
}

export function isWorkApprovedForInvoice(work: MatchableWork): boolean {
  if (work.approvalStatus) {
    const normalized = work.approvalStatus.toLowerCase();
    return normalized === "approved" || normalized === "sent to client";
  }
  return work.status === "done";
}

export function workInvoiceInclusionReason(work: MatchableWork, reportType: "invoice" | "work-log-report"): string | null {
  if (work.clientVisible !== true) {
    return work.clientVisible === null
      ? "Client Visible is missing"
      : "Client Visible is not enabled";
  }
  if (reportType === "work-log-report") {
    if (work.includeInWorkReport !== true) {
      return work.includeInWorkReport === null
        ? "Include in Work Report is missing"
        : "Include in Work Report is not enabled";
    }
  } else if (work.includeInInvoice !== true) {
    return work.includeInInvoice === null
      ? "Include in Invoice is missing"
      : "Include in Invoice is not enabled";
  }
  if (!isWorkApprovedForInvoice(work)) {
    return "Work Done is not approved";
  }
  return null;
}

export const MATCH_SOURCE_LABELS: Record<MatchSource, string> = {
  explicit: "Explicit",
  reciprocal: "Reciprocal",
  "legacy-fallback": "Legacy fallback",
  ambiguous: "Ambiguous",
  missing: "Missing",
};
