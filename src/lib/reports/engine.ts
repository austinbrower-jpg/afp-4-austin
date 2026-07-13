import type {
  ReportBuilderInput,
  ReportDataset,
  ReportDocument,
  ReportExcludedRecord,
  ReportHoursRecord,
  ReportKnowledgeRecord,
  ReportProject,
  ReportSessionLine,
  ReportSettings,
  ReportSubtotal,
  ReportType,
  ReportWorkRecord,
} from "./types";
import { isSupersededHours, supersededDiagnosticReason } from "@/lib/notion/quarantine";
import { isLockedBillingStatus } from "@/lib/invoices/invoice-locking";
import {
  matchHoursToWork,
  MATCH_SOURCE_LABELS,
  workInvoiceInclusionReason,
  type MatchSource,
} from "./relation-matching";

export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function exactElapsedMinutes(
  startTime: string,
  endTime: string,
  breakMinutes = 0,
): number {
  const parse = (value: string) => {
    const [hours, minutes] = value.split(":").map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    return hours * 60 + minutes;
  };
  const start = parse(startTime);
  const end = parse(endTime);
  if (start === null || end === null) return 0;
  const elapsed = end < start ? end + 24 * 60 - start : end - start;
  return Math.max(0, elapsed - Math.max(0, breakMinutes || 0));
}

export function amountFromExactMinutes(minutes: number, hourlyRate: number): number {
  return roundCurrency((minutes / 60) * hourlyRate);
}

export function filterByDateRange<T extends { date: string }>(
  records: readonly T[],
  start: string,
  end: string,
): T[] {
  return records.filter((record) => record.date >= start && record.date <= end);
}

export function filterByClient<T extends { clientId: string | null }>(
  records: readonly T[],
  clientId: string,
): T[] {
  return records.filter((record) => record.clientId === clientId);
}

export function filterByProjects<T extends { projectId: string | null }>(
  records: readonly T[],
  projectIds: readonly string[],
): T[] {
  if (projectIds.length === 0) return [...records];
  const selected = new Set(projectIds);
  return records.filter((record) => record.projectId !== null && selected.has(record.projectId));
}

function privacyExclusion(work: ReportWorkRecord, type: ReportType): string | null {
  if (work.clientVisible !== true) {
    return work.clientVisible === null
      ? "Client Visible is missing; privacy defaults to excluded"
      : "Client Visible is not enabled";
  }
  if (type === "work-log-report") {
    if (work.includeInWorkReport !== true) {
      return work.includeInWorkReport === null
        ? "Include in Work Report is missing"
        : "Include in Work Report is not enabled";
    }
    return null;
  }
  if (work.includeInInvoice !== true) {
    return work.includeInInvoice === null
      ? "Include in Invoice is missing"
      : "Include in Invoice is not enabled";
  }
  return null;
}

function knowledgePrivacyExclusion(knowledge: ReportKnowledgeRecord): string | null {
  if (knowledge.clientVisible !== true) {
    return knowledge.clientVisible === null
      ? "Client Visible is missing; privacy defaults to excluded"
      : "Client Visible is not enabled";
  }
  if (knowledge.includeInWorkReport !== true) {
    return knowledge.includeInWorkReport === null
      ? "Include in Work Report is missing"
      : "Include in Work Report is not enabled";
  }
  return null;
}

export function filterWorkRecordsForPrivacy(
  records: readonly ReportWorkRecord[],
  type: ReportType,
): { included: ReportWorkRecord[]; excluded: ReportExcludedRecord[] } {
  const included: ReportWorkRecord[] = [];
  const excluded: ReportExcludedRecord[] = [];
  for (const record of records) {
    const reason = privacyExclusion(record, type);
    if (reason) {
      excluded.push({ id: record.id, kind: "work-done", title: record.title, reason });
    } else {
      included.push(record);
    }
  }
  return { included, excluded };
}

function projectName(projectId: string | null, projects: readonly ReportProject[]): string {
  if (!projectId) return "Unassigned";
  return projects.find((project) => project.id === projectId)?.name ?? "Missing project";
}

function isWorkRelatedToHours(
  work: ReportWorkRecord,
  hours: ReportHoursRecord,
  matchSource?: MatchSource,
): boolean {
  if (matchSource === "explicit" || matchSource === "reciprocal" || matchSource === "legacy-fallback") {
    const result = matchHoursToWork(
      {
        id: hours.id,
        date: hours.date,
        projectId: hours.projectId,
        relatedWorkLogId: hours.relatedWorkLogId,
        relatedWorkDoneIds: hours.relatedWorkDoneIds,
      },
      [{
        id: work.id,
        date: work.date,
        projectId: work.projectId,
        relatedHoursIds: work.relatedHoursIds,
        clientVisible: work.clientVisible,
        includeInInvoice: work.includeInInvoice,
        includeInWorkReport: work.includeInWorkReport,
        approvalStatus: work.approvalStatus,
        status: work.status,
      }],
    );
    return result.some((m) => m.workId === work.id && m.source === matchSource);
  }
  if (hours.relatedWorkLogId === work.id || work.relatedHoursIds.includes(hours.id)) return true;
  return work.date === hours.date && work.projectId === hours.projectId;
}

function resolveHoursWorkMatch(
  hours: ReportHoursRecord,
  visibleWork: readonly ReportWorkRecord[],
): { work: ReportWorkRecord[]; source: MatchSource } {
  const matches = matchHoursToWork(
    {
      id: hours.id,
      date: hours.date,
      projectId: hours.projectId,
      relatedWorkLogId: hours.relatedWorkLogId,
      relatedWorkDoneIds: hours.relatedWorkDoneIds,
    },
    visibleWork.map((work) => ({
      id: work.id,
      date: work.date,
      projectId: work.projectId,
      relatedHoursIds: work.relatedHoursIds,
      clientVisible: work.clientVisible,
      includeInInvoice: work.includeInInvoice,
      includeInWorkReport: work.includeInWorkReport,
      approvalStatus: work.approvalStatus,
      status: work.status,
    })),
  );
  const unambiguous = matches.find(
    (m) => m.workId && (m.source === "explicit" || m.source === "reciprocal" || m.source === "legacy-fallback"),
  );
  if (unambiguous) {
    const work = visibleWork.find((w) => w.id === unambiguous.workId);
    return { work: work ? [work] : [], source: unambiguous.source };
  }
  if (matches.some((m) => m.source === "ambiguous")) {
    return { work: [], source: "ambiguous" };
  }
  return { work: [], source: "missing" };
}

function descriptionForHours(
  hours: ReportHoursRecord,
  visibleWork: readonly ReportWorkRecord[],
  drafts: Readonly<Record<string, string>>,
  matchedWork: readonly ReportWorkRecord[],
): string {
  const related = matchedWork.length > 0
    ? matchedWork
    : visibleWork.filter((work) => isWorkRelatedToHours(work, hours));
  return [...new Set(related.map((work) => (drafts[work.id] ?? work.detailedWorkDescription).trim()).filter(Boolean))]
    .join("; ");
}

function groupSessionTotals(
  sessions: readonly ReportSessionLine[],
  keyFor: (line: ReportSessionLine) => { key: string; label: string },
): ReportSubtotal[] {
  const grouped = new Map<string, ReportSubtotal>();
  for (const line of sessions) {
    const group = keyFor(line);
    const current = grouped.get(group.key) ?? {
      key: group.key,
      label: group.label,
      exactMinutes: 0,
      amount: 0,
    };
    current.exactMinutes += line.exactMinutes;
    current.amount = roundCurrency(current.amount + line.amount);
    grouped.set(group.key, current);
  }
  return [...grouped.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function defaultSummary(work: readonly ReportWorkRecord[]): string {
  const titles = [...new Set(work.map((record) => record.title.trim()).filter(Boolean))];
  if (titles.length === 0) return "No client-visible work was included for this reporting period.";
  return `Professional services covering ${titles.slice(0, 4).join(", ")}${titles.length > 4 ? ", and related work" : ""}.`;
}

export function composeReport(
  dataset: ReportDataset,
  settings: ReportSettings,
  input: ReportBuilderInput,
): ReportDocument {
  const client = dataset.clients.find((candidate) => candidate.id === input.clientId) ?? null;
  const projects = dataset.projects.filter((project) => project.clientId === input.clientId);
  const warnings: string[] = [];
  const excludedRecords: ReportExcludedRecord[] = [];

  let workCandidates = filterByClient(dataset.workRecords, input.clientId);
  workCandidates = filterByDateRange(workCandidates, input.periodStart, input.periodEnd);
  if (input.projectIds.length > 0) {
    const selectedProjects = new Set(input.projectIds);
    workCandidates = workCandidates.filter((work) =>
      (work.projectId !== null && selectedProjects.has(work.projectId)) ||
      work.relatedHoursIds.some((hoursId) => {
        const hours = dataset.hours.find((record) => record.id === hoursId);
        return hours?.projectId !== null && hours?.projectId !== undefined && selectedProjects.has(hours.projectId);
      }),
    );
  }
  const privacy = filterWorkRecordsForPrivacy(workCandidates, input.type);
  excludedRecords.push(...privacy.excluded);
  const visibleWork = [...privacy.included].sort(
    (a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id),
  );

  let hoursCandidates = filterByClient(dataset.hours, input.clientId);
  hoursCandidates = filterByDateRange(hoursCandidates, input.periodStart, input.periodEnd);
  hoursCandidates = filterByProjects(hoursCandidates, input.projectIds);

  const sessions: ReportSessionLine[] = [];
  for (const hours of [...hoursCandidates].sort(
    (a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id),
  )) {
    if (isSupersededHours({ migrationKey: hours.migrationKey, billingStatus: hours.billingStatus })) {
      excludedRecords.push({
        id: hours.id,
        kind: "hours",
        title: `${hours.date} ${hours.startTime}-${hours.endTime}`,
        reason: supersededDiagnosticReason({ migrationKey: hours.migrationKey, billingStatus: hours.billingStatus }) ?? "Superseded historical record",
        matchSource: "Superseded",
      });
      continue;
    }
    if (input.type !== "work-log-report" && !hours.billable) {
      excludedRecords.push({
        id: hours.id,
        kind: "hours",
        title: `${hours.date} ${hours.startTime}-${hours.endTime}`,
        reason: "Non-billable time is excluded from invoices",
      });
      continue;
    }
    if (
      input.type !== "work-log-report" &&
      isLockedBillingStatus(hours.billingStatus ?? null) &&
      hours.invoiceReportId !== input.viewingInvoiceId
    ) {
      excludedRecords.push({
        id: hours.id,
        kind: "hours",
        title: `${hours.date} ${hours.startTime}-${hours.endTime}`,
        reason: `Hours already marked ${hours.billingStatus}`,
      });
      continue;
    }
    const { work: matchedWork, source: matchSource } = resolveHoursWorkMatch(hours, visibleWork);
    if (matchSource === "ambiguous") {
      excludedRecords.push({
        id: hours.id,
        kind: "hours",
        title: `${hours.date} ${hours.startTime}-${hours.endTime}`,
        reason: "Ambiguous Work Done match — multiple candidates",
        matchSource: MATCH_SOURCE_LABELS.ambiguous,
      });
      continue;
    }
    if (matchedWork.length === 0) {
      excludedRecords.push({
        id: hours.id,
        kind: "hours",
        title: `${hours.date} ${hours.startTime}-${hours.endTime}`,
        reason: "No related client-visible Work Done record is approved for this report",
        matchSource: MATCH_SOURCE_LABELS.missing,
      });
      continue;
    }
    const reportKind = input.type === "work-log-report" ? "work-log-report" : "invoice";
    const workRejected = matchedWork.find((work) => workInvoiceInclusionReason(work, reportKind));
    if (workRejected) {
      const reason = workInvoiceInclusionReason(workRejected, reportKind);
      excludedRecords.push({
        id: hours.id,
        kind: "hours",
        title: `${hours.date} ${hours.startTime}-${hours.endTime}`,
        reason: reason ?? "Linked Work Done failed inclusion checks",
        matchSource: MATCH_SOURCE_LABELS[matchSource],
      });
      continue;
    }
    const description = descriptionForHours(hours, visibleWork, input.draftDescriptions, matchedWork);
    if (!description) {
      excludedRecords.push({
        id: hours.id,
        kind: "hours",
        title: `${hours.date} ${hours.startTime}-${hours.endTime}`,
        reason: "Missing client-visible description",
      });
      continue;
    }
    const minutes = exactElapsedMinutes(hours.startTime, hours.endTime, hours.breakMinutes);
    if (minutes <= 0) {
      excludedRecords.push({
        id: hours.id,
        kind: "hours",
        title: `${hours.date} ${hours.startTime}-${hours.endTime}`,
        reason: "Elapsed time is zero or invalid",
      });
      continue;
    }
    const hourlyRate = Number.isFinite(hours.hourlyRate) && hours.hourlyRate >= 0
      ? hours.hourlyRate
      : client?.defaultHourlyRate ?? settings.defaultHourlyRate;
    sessions.push({
      id: hours.id,
      date: hours.date,
      startTime: hours.startTime,
      endTime: hours.endTime,
      exactMinutes: minutes,
      projectId: hours.projectId,
      projectName: projectName(hours.projectId, projects),
      description,
      hourlyRate,
      billable: hours.billable,
      amount: hours.billable ? amountFromExactMinutes(minutes, hourlyRate) : 0,
    });
  }

  const includedWork = visibleWork.filter((work) =>
    sessions.some((session) => {
      const hours = hoursCandidates.find((candidate) => candidate.id === session.id);
      return hours ? isWorkRelatedToHours(work, hours) : false;
    }),
  );
  for (const work of visibleWork) {
    if (!includedWork.some((included) => included.id === work.id)) {
      excludedRecords.push({
        id: work.id,
        kind: "work-done",
        title: work.title,
        reason: "No included hours record is related to this work item",
      });
    }
  }

  let knowledgeCandidates = filterByClient(dataset.knowledgeRecords, input.clientId);
  knowledgeCandidates = filterByProjects(knowledgeCandidates, input.projectIds);
  const knowledgeItems: ReportDocument["knowledgeItems"] = [];
  if (input.type === "work-log-report") {
    for (const knowledge of [...knowledgeCandidates].sort((a, b) => a.title.localeCompare(b.title))) {
      const reason = knowledgePrivacyExclusion(knowledge);
      if (reason) {
        excludedRecords.push({ id: knowledge.id, kind: "knowledge", title: knowledge.title, reason });
        continue;
      }
      if (!knowledge.reportSummary.trim()) {
        excludedRecords.push({
          id: knowledge.id,
          kind: "knowledge",
          title: knowledge.title,
          reason: "Missing client-visible Report Summary",
        });
        continue;
      }
      knowledgeItems.push({
        id: knowledge.id,
        title: knowledge.title,
        summary: knowledge.reportSummary.trim(),
        projectName: projectName(knowledge.projectId, projects),
        sourcePage: knowledge.sourcePage,
      });
    }
  }

  const workItems: ReportDocument["workItems"] = includedWork.map((work) => ({
    id: work.id,
    date: work.date,
    title: work.title,
    description: (input.draftDescriptions[work.id] ?? work.detailedWorkDescription).trim(),
    projectName: projectName(work.projectId, projects),
    status: work.status,
    evidenceLinks: [...work.evidenceLinks],
    deliverables: [...work.deliverables],
    testingPerformed: [...work.testingPerformed],
    blockers: [...work.blockers],
    followUpItems: [...work.followUpItems],
    relatedHoursMinutes: sessions
      .filter((session) => {
        const hours = hoursCandidates.find((candidate) => candidate.id === session.id);
        return hours ? isWorkRelatedToHours(work, hours) : false;
      })
      .reduce((sum, session) => sum + session.exactMinutes, 0),
  }));

  if (!client) warnings.push("The selected client is missing from this data source.");
  if (input.periodStart > input.periodEnd) warnings.push("Billing start date is after the end date.");
  if (sessions.length === 0) warnings.push("No approved hours records match the selected filters.");
  if (sessions.some((session) => session.projectName === "Missing project" || session.projectName === "Unassigned")) {
    warnings.push("One or more included sessions has no available project.");
  }
  if (input.type !== "work-log-report" && !input.invoiceNumber.trim()) {
    warnings.push("Invoice number is missing.");
  }
  if (input.type !== "work-log-report" && !input.dueDate) warnings.push("Due date is missing.");

  const projectTotals = groupSessionTotals(sessions, (line) => ({
    key: line.projectId ?? "unassigned",
    label: line.projectName,
  }));
  const dailyTotals = groupSessionTotals(sessions, (line) => ({ key: line.date, label: line.date }));
  const billableSessions = sessions.filter((session) => session.billable);
  const nonBillableSessions = sessions.filter((session) => !session.billable);
  const amountDue = roundCurrency(billableSessions.reduce((sum, session) => sum + session.amount, 0));
  const hourlyRates = [...new Set(billableSessions.map((session) => session.hourlyRate))].sort((a, b) => a - b);
  const clientName = settings.clientDisplayName.trim() || client?.name || "Client";
  const title = input.customTitle.trim() || (
    input.type === "work-log-report"
      ? "Detailed Work Log Report"
      : input.type === "detailed-invoice"
        ? "Detailed Invoice"
        : "Invoice"
  );
  const summary = input.executiveSummary.trim() || defaultSummary(includedWork);
  const includedRecords: ReportDocument["includedRecords"] = [
    ...sessions.map((session) => ({
      id: session.id,
      kind: "hours" as const,
      title: `${session.date} ${session.startTime}-${session.endTime}`,
    })),
    ...includedWork.map((work) => ({ id: work.id, kind: "work-done" as const, title: work.title })),
    ...knowledgeItems.map((knowledge) => ({
      id: knowledge.id,
      kind: "knowledge" as const,
      title: knowledge.title,
    })),
  ];

  return {
    schemaVersion: 1,
    type: input.type,
    title,
    source: { type: dataset.source, label: dataset.label },
    generatedForPreviewAt: input.invoiceDate,
    client: {
      name: clientName,
      billingContact: settings.clientBillingContact.trim(),
      billingEmail: settings.clientBillingEmail.trim(),
    },
    contractor: {
      name: settings.contractorName.trim(),
      businessName: settings.businessName.trim(),
      email: settings.email.trim(),
      phone: settings.phone.trim(),
      address: settings.address.trim(),
      logoPath: settings.logoPath.trim(),
    },
    invoice: {
      number: input.invoiceNumber.trim(),
      invoiceDate: input.invoiceDate,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      paymentTerms: input.paymentTerms.trim(),
      dueDate: input.dueDate,
      notes: input.notes.trim(),
    },
    summary,
    sessions,
    projectTotals,
    dailyTotals,
    workItems,
    knowledgeItems,
    totals: {
      billableMinutes: billableSessions.reduce((sum, session) => sum + session.exactMinutes, 0),
      nonBillableMinutes: nonBillableSessions.reduce((sum, session) => sum + session.exactMinutes, 0),
      amountDue,
      hourlyRates,
    },
    includedRecords,
    excludedRecords: excludedRecords.sort(
      (a, b) => a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id),
    ),
    warnings: [...new Set(warnings)],
  };
}

export function composeSimpleInvoice(
  dataset: ReportDataset,
  settings: ReportSettings,
  input: Omit<ReportBuilderInput, "type">,
): ReportDocument {
  return composeReport(dataset, settings, { ...input, type: "simple-invoice" });
}

export function composeDetailedInvoice(
  dataset: ReportDataset,
  settings: ReportSettings,
  input: Omit<ReportBuilderInput, "type">,
): ReportDocument {
  return composeReport(dataset, settings, { ...input, type: "detailed-invoice" });
}

export function composeWorkLogReport(
  dataset: ReportDataset,
  settings: ReportSettings,
  input: Omit<ReportBuilderInput, "type">,
): ReportDocument {
  return composeReport(dataset, settings, { ...input, type: "work-log-report" });
}
