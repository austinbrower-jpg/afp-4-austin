/**
 * Phase 5 historical-migration dry run: derives proposed client/project/
 * hours/work-log records from the transcribed AFP-Work Notion source pages
 * (source-data.ts) and reconciles totals against what those pages state
 * about themselves. Pure and deterministic - no Notion client, no SQLite,
 * no Date.now()/Math.random(). The only non-deterministic input is
 * `generatedAt`, which callers pass in explicitly (defaults to the current
 * time) and which never affects the analytical content below it.
 *
 * This performs zero writes by construction: it has no access to a Notion
 * client or a SQLite connection, only plain data in and a plain object out.
 * See read-existing.ts (the only file in this feature that touches SQLite,
 * read-only) and src/app/api/notion/migration-preview/route.ts.
 *
 * Corrected billing convention: amounts are computed
 * from exact elapsed minutes (exactMinutes/60 x hourlyRate), never from
 * hours pre-rounded to hundredths, and only the final dollar total is
 * rounded to cents. This produces 987 billable minutes and $493.50. See buildTotals() and
 * ProposedHoursRecord.referenceAppRoundedHours/Amount in types.ts for the
 * (rejected, informational-only) alternative convention this replaced.
 *
 * Project assignments (same decision): every session and work log below
 * uses the explicit APPROVED_PROJECT_ASSIGNMENTS / APPROVED_WORK_LOG_PROJECTS
 * tables in source-data.ts rather than the keyword-derived guess from the
 * initial dry run.
 */
import { calculateSession, roundCents, roundHours } from "./calculations";
import { matchProjectCandidates, type ProjectCandidate } from "./project-matcher";
import {
  APPROVED_PROJECT_ASSIGNMENTS,
  APPROVED_WORK_LOG_PROJECTS,
  CLIENT_NAME,
  JULY9_HEADER_VS_RECONCILED,
  RAW_SESSIONS,
  RAW_WORK_LOGS,
  SOURCE_PAGES,
  SOURCE_STATED_TOTALS,
  SOURCE_TIMEZONE,
  STANDARD_HOURLY_RATE,
  UNTRACKED_GAPS,
  type RawSession,
} from "./source-data";
import {
  EMPTY_SNAPSHOT,
  type DayTotals,
  type ExistingRecordsSnapshot,
  type MigrationDryRunResult,
  type MigrationWarning,
  type ProjectKey,
  type ProposedClientRecord,
  type ProposedHoursRecord,
  type ProposedProjectRecord,
  type ProposedRecord,
  type ProposedWorkLogRecord,
  type ReconciliationTotals,
  type SessionTotal,
} from "./types";

const PROJECT_CANDIDATES: ProjectCandidate<ProjectKey>[] = [
  { key: "bolReviewV2", keywords: ["bol review process v2"] },
  { key: "commandCenter", keywords: ["command center"] },
  {
    key: "powerAutomateDocs",
    keywords: [
      "power automate flow map",
      "technical documentation and power automate",
      "power automate support",
    ],
  },
  { key: "invoiceWorkspace", keywords: ["invoice", "work tracking", "work logging"] },
  { key: "digitalSystemsAudit", keywords: ["digital systems", "systems scope"] },
];

const PROJECT_DEFINITIONS: Record<
  ProjectKey,
  Pick<ProposedProjectRecord, "name" | "description" | "tags">
> = {
  bolReviewV2: {
    name: "BOL Review Process V2",
    description:
      "Power Automate flow that extracts, matches, and routes BOL/invoice document pairs: SharePoint intake, Claude/Anthropic extraction, JSON parsing, and Sheet1/Pending/Unmatched routing in the BOL Review workbook.",
    tags: ["power-automate", "bol-review", "automation"],
  },
  commandCenter: {
    name: "AFP Command Center / Sales & Operations Hub",
    description:
      'Planning for an internal AFP sales & operations hub / CRM (department dashboards, build phases, tool recommendations), documented in a dedicated Notion page under AFP-Work.',
    tags: ["planning", "sales-ops", "internal-tools"],
  },
  powerAutomateDocs: {
    name: "Power Automate Documentation",
    description:
      'Technical documentation of the Power Automate BOL Review Process V2 flow (the "Power Automate Flow Map" Notion page) and related technical support work.',
    tags: ["documentation", "power-automate"],
  },
  invoiceWorkspace: {
    name: "AFP Invoice Workspace",
    description:
      "Structured AFP hours, work-log, invoice-ready summary, and maintenance-record workflow evidenced on the July 8 source page.",
    tags: ["invoicing", "work-logs", "operations"],
  },
  digitalSystemsAudit: {
    name: "Digital Systems Audit & Process Documentation",
    description:
      "Review and documentation of AFP systems, automations, websites, databases, platforms, access, security, and operational procedures evidenced on July 8.",
    tags: ["systems-audit", "documentation", "operations"],
  },
};

const PROJECT_SOURCE_KEYS: Record<ProjectKey, Array<"july8" | "july9" | "july10">> = {
  bolReviewV2: ["july8", "july9", "july10"],
  commandCenter: ["july8", "july9"],
  powerAutomateDocs: ["july8", "july9"],
  invoiceWorkspace: ["july8"],
  digitalSystemsAudit: ["july8"],
};

function projectLabel(key: ProjectKey): string {
  return PROJECT_DEFINITIONS[key].name;
}

const WARNING_DEFS: Record<string, { severity: MigrationWarning["severity"]; message: string }> = {
  "unassigned-project": {
    severity: "warning",
    message:
      "Session workstream text does not match an evidenced project and has no reviewed assignment. It remains unassigned rather than guessed.",
  },
  "multi-project-session": {
    severity: "warning",
    message:
      "Session workstream text matches more than one derived project and no explicit assignment was approved for it. The primary project listed is a best-effort pick (first match by priority order); review whether this session should be split.",
  },
  "project-assignments-approved": {
    severity: "info",
    message:
      "Project assignments are derived from the corrected Hours table and the dated source-page work descriptions, not from title-only guesses.",
  },
  "location-not-specified": {
    severity: "info",
    message:
      'The Hours Worked page itself marks location as "Not specified" for these sessions (the original entry did not clearly say home or office) - preserved verbatim rather than guessed.',
  },
  "billing-convention-approved": {
    severity: "info",
    message:
      "Amounts use exact elapsed minutes at $30/hour. This preserves the corrected 987-minute, $493.50 source total, including July 10's exact 350-minute $175.00 amount.",
  },
  "assumed-nonbillable-rate": {
    severity: "info",
    message:
      "Non-billable session stored with the client's standard $30/hr rate for reference even though it is not billed (billable=false, expectedAmount=$0) - the source page does not state a rate for non-billable onsite time.",
  },
  "assumed-priority-default": {
    severity: "info",
    message: 'Project priority defaults to "medium" because the historical source does not assign project-level priorities.',
  },
  "worklog-multi-project": {
    severity: "info",
    message:
      "This day's billable sessions were individually approved to more than one project and no single main project was specified for the day itself, so the work log's project is left unassigned; every project the day touched is preserved in relatedProjectKeys and relatedProjectsNote instead of being picked arbitrarily.",
  },
  "worklog-related-projects-preserved": {
    severity: "info",
    message:
      "This work log's main project is its approved primary, but the day's work also touched other projects (per the 2026-07-10 approval) - preserved in relatedProjectKeys and relatedProjectsNote rather than dropped, since the domain WorkLog schema only supports one projectId today.",
  },
  "stale-session-start-header": {
    severity: "warning",
    message:
      'The July 9, 2026 page\'s own header states the session "Started at 9:00 AM" and was still open ("Confirmed Billable Time: Not finalized yet"), but the same page\'s later "End-of-Day Shift Update" section and the Hours Worked table both reconcile the same session as 9:12 AM-2:00 PM, closed. Treated the closed, reconciled figures as authoritative and flagged the header text as stale rather than silently picking one.',
  },
  "untracked-time-gap": {
    severity: "info",
    message:
      "Gaps between recorded sessions on the same day are not captured in the source data (no onsite or billable row covers them) and are not migrated as break or session records.",
  },
  "timezone-differs-from-app-default": {
    severity: "info",
    message: `Source Hours Worked page states timezone "${SOURCE_TIMEZONE}", which differs from this app's generic default ("America/New_York", used e.g. in the mock seed data). The proposed client record uses the source-stated timezone.`,
  },
};

function hoursKey(clientName: string, date: string, startTime: string, endTime: string): string {
  return `${clientName.toLowerCase()}|${date}|${startTime}|${endTime}`;
}

function workLogKey(clientName: string, date: string, title: string): string {
  return `${clientName.toLowerCase()}|${date}|${title.toLowerCase()}`;
}

function buildClient(
  snapshot: ExistingRecordsSnapshot,
): ProposedRecord<ProposedClientRecord> {
  const record: ProposedClientRecord = {
    name: CLIENT_NAME,
    status: "active",
    defaultHourlyRate: STANDARD_HOURLY_RATE,
    timezone: SOURCE_TIMEZONE,
    notes: "AFP contractor and digital systems work",
  };
  const exists = snapshot.clientNamesLower.includes(CLIENT_NAME.toLowerCase());

  return {
    syntheticId: "client-anytime-fuel-pros",
    action: exists ? "skip-existing" : "create",
    existingMatchId: exists ? CLIENT_NAME.toLowerCase() : null,
    record,
    provenance: [
      { pageId: SOURCE_PAGES.hoursWorked.id, pageTitle: SOURCE_PAGES.hoursWorked.title, pageUrl: SOURCE_PAGES.hoursWorked.url, quote: "Rate: $30/hour" },
      { pageId: SOURCE_PAGES.hoursWorked.id, pageTitle: SOURCE_PAGES.hoursWorked.title, pageUrl: SOURCE_PAGES.hoursWorked.url, quote: "Timezone: America/Chicago" },
      { pageId: SOURCE_PAGES.july8.id, pageTitle: SOURCE_PAGES.july8.title, pageUrl: SOURCE_PAGES.july8.url, quote: "Client / Project: Anytime Fuel Pros / AFP" },
    ],
    warnings: ["timezone-differs-from-app-default"],
  };
}

function buildProjects(
  _usedKeys: Set<ProjectKey>,
  snapshot: ExistingRecordsSnapshot,
): ProposedRecord<ProposedProjectRecord>[] {
  return (Object.keys(PROJECT_DEFINITIONS) as ProjectKey[])
    .map((key) => {
      const def = PROJECT_DEFINITIONS[key];
      const record: ProposedProjectRecord = {
        key,
        name: def.name,
        status: "active",
        priority: "medium",
        description: def.description,
        tags: def.tags,
      };
      const exists = snapshot.projectNamesLower.includes(def.name.toLowerCase());
      return {
        syntheticId: `project-${key}`,
        action: exists ? "skip-existing" : "create",
        existingMatchId: exists ? def.name.toLowerCase() : null,
        record,
        provenance: PROJECT_SOURCE_KEYS[key].map((sourceKey) => ({
          pageId: SOURCE_PAGES[sourceKey].id,
          pageTitle: SOURCE_PAGES[sourceKey].title,
          pageUrl: SOURCE_PAGES[sourceKey].url,
          section: "Work Completed / Work Log",
        })),
        warnings: ["assumed-priority-default"],
      };
    });
}

interface HoursBuildOutput {
  proposed: ProposedRecord<ProposedHoursRecord>[];
  usedProjectKeys: Set<ProjectKey>;
  warnings: Map<string, string[]>;
}

function buildHours(snapshot: ExistingRecordsSnapshot): HoursBuildOutput {
  const usedProjectKeys = new Set<ProjectKey>();
  const warnings = new Map<string, string[]>();
  const addWarning = (code: string, id: string) => {
    const list = warnings.get(code) ?? [];
    list.push(id);
    warnings.set(code, list);
  };

  const proposed = RAW_SESSIONS.map((session: RawSession) => {
    const calc = calculateSession(session.startTime, session.endTime, 0, STANDARD_HOURLY_RATE);
    const match = matchProjectCandidates(session.workstream, PROJECT_CANDIDATES);

    const hasApproval = Object.prototype.hasOwnProperty.call(APPROVED_PROJECT_ASSIGNMENTS, session.id);
    const projectKey = hasApproval ? APPROVED_PROJECT_ASSIGNMENTS[session.id] : match.primaryKey;
    if (projectKey) usedProjectKeys.add(projectKey);

    const recordWarnings: string[] = [];
    if (!hasApproval) {
      if (session.billable && match.matchedKeys.length === 0) {
        recordWarnings.push("unassigned-project");
        addWarning("unassigned-project", session.id);
      }
      if (match.ambiguous) {
        recordWarnings.push("multi-project-session");
        addWarning("multi-project-session", session.id);
      }
    } else {
      recordWarnings.push("project-assignments-approved");
      addWarning("project-assignments-approved", session.id);
    }
    if (session.location === null) {
      recordWarnings.push("location-not-specified");
      addWarning("location-not-specified", session.id);
    }
    if (session.billable && calc.roundingDiscrepancy !== 0) {
      recordWarnings.push("billing-convention-approved");
      addWarning("billing-convention-approved", session.id);
    }
    if (!session.billable) {
      recordWarnings.push("assumed-nonbillable-rate");
      addWarning("assumed-nonbillable-rate", session.id);
    }
    if (session.id === "hrs-2026-07-09-s1") {
      recordWarnings.push("stale-session-start-header");
      addWarning("stale-session-start-header", session.id);
    }

    const record: ProposedHoursRecord = {
      date: session.date,
      startTime: session.startTime,
      endTime: session.endTime,
      breakMinutes: 0,
      totalHours: calc.hoursExact,
      hourlyRate: STANDARD_HOURLY_RATE,
      billable: session.billable,
      location: session.location ?? "Not specified",
      notes: session.notes,
      clientName: CLIENT_NAME,
      projectKey,
      expectedAmount: session.billable ? calc.amountExact : 0,
      referenceAppRoundedHours: calc.hoursAppRounded,
      referenceAppRoundedAmount: session.billable ? calc.amountAppConvention : 0,
      workstream: session.workstream,
      status: session.status,
    };

    const key = hoursKey(CLIENT_NAME, session.date, session.startTime, session.endTime);
    const exists = snapshot.hoursKeys.includes(key);

    return {
      syntheticId: session.id,
      action: exists ? "skip-existing" : "create",
      existingMatchId: exists ? key : null,
      record,
      provenance: [
        {
          pageId: SOURCE_PAGES.hoursWorked.id,
          pageTitle: SOURCE_PAGES.hoursWorked.title,
          pageUrl: SOURCE_PAGES.hoursWorked.url,
          section: session.table === "onsite" ? "Onsite Table" : "Billable Hours Table",
          quote: `${session.date} ${session.startTime}-${session.endTime}: ${session.workstream}`,
        },
      ],
      warnings: recordWarnings,
    } satisfies ProposedRecord<ProposedHoursRecord>;
  });

  return { proposed, usedProjectKeys, warnings };
}

function buildWorkLogs(
  snapshot: ExistingRecordsSnapshot,
  warnings: Map<string, string[]>,
): ProposedRecord<ProposedWorkLogRecord>[] {
  const addWarning = (code: string, id: string) => {
    const list = warnings.get(code) ?? [];
    list.push(id);
    warnings.set(code, list);
  };

  return RAW_WORK_LOGS.map((wl) => {
    const approved = APPROVED_WORK_LOG_PROJECTS[wl.id];

    const recordWarnings: string[] = [];
    if (approved.relatedProjectKeys.length > 0) {
      recordWarnings.push("worklog-related-projects-preserved");
      addWarning("worklog-related-projects-preserved", wl.id);
    }

    const relatedProjectsNote = approved.projectKey
      ? approved.relatedProjectKeys.length > 0
        ? `Primary project: ${projectLabel(approved.projectKey)}. This day's work also touched ` +
          `${approved.relatedProjectKeys.map(projectLabel).join(" and ")} - preserved here per the ` +
          `2026-07-10 approved migration decision even though the day's billable session(s) are ` +
          `attributed to ${projectLabel(approved.projectKey)}.`
        : `Primary project: ${projectLabel(approved.projectKey)}.`
      : "";

    const sourceKey = wl.date === "2026-07-08" ? "july8" : wl.date === "2026-07-09" ? "july9" : "july10";
    const source = SOURCE_PAGES[sourceKey];

    const record: ProposedWorkLogRecord = {
      title: wl.title,
      date: wl.date,
      status: "done",
      priority: wl.priority,
      summary: wl.summary,
      detailedWorkDescription: wl.detailedWorkDescription,
      detailedSourceReference: `${source.url} - dated source work log and invoice-ready section.`,
      invoiceDescription: wl.invoiceDescription,
      internalNotes: wl.internalNotes,
      evidenceLinks: [...wl.evidenceLinks],
      clientVisible: true,
      includeInInvoice: true,
      includeInWorkReport: true,
      clientName: CLIENT_NAME,
      projectKey: approved.projectKey,
      relatedProjectKeys: approved.relatedProjectKeys,
      relatedProjectsNote,
      relatedHoursSyntheticIds: wl.relatedHoursIds,
    };

    const key = workLogKey(CLIENT_NAME, wl.date, wl.title);
    const exists = snapshot.workLogKeys.includes(key);

    return {
      syntheticId: wl.id,
      action: exists ? "skip-existing" : "create",
      existingMatchId: exists ? key : null,
      record,
      provenance: [
        {
          pageId: source.id,
          pageTitle: source.title,
          pageUrl: source.url,
          section: "Invoice-Ready Work Description",
        },
      ],
      warnings: recordWarnings,
    } satisfies ProposedRecord<ProposedWorkLogRecord>;
  });
}

function buildTotals(proposedHours: ProposedRecord<ProposedHoursRecord>[]): ReconciliationTotals {
  const perSession: SessionTotal[] = proposedHours.map((h) => ({
    syntheticId: h.syntheticId,
    billable: h.record.billable,
    hours: h.record.totalHours,
    amount: h.record.expectedAmount,
  }));

  const days = [...new Set(proposedHours.map((h) => h.record.date))].sort();
  const perDay: DayTotals[] = days.map((date) => {
    const rows = perSession.filter((_, i) => proposedHours[i].record.date === date);
    const billableRows = rows.filter((r) => r.billable);
    const nonBillableRows = rows.filter((r) => !r.billable);
    return {
      date,
      // Sum the exact (unrounded) per-session hours x rate first, round
      // only this once - never sum already-rounded per-row amounts.
      billableHours: roundHours(billableRows.reduce((sum, r) => sum + r.hours, 0)),
      nonBillableHours: roundHours(nonBillableRows.reduce((sum, r) => sum + r.hours, 0)),
      amount: roundCents(billableRows.reduce((sum, r) => sum + r.hours * STANDARD_HOURLY_RATE, 0)),
    };
  });

  const billableSessions = perSession.filter((s) => s.billable);
  const nonBillableSessions = perSession.filter((s) => !s.billable);

  const totalBillableHours = roundHours(billableSessions.reduce((sum, s) => sum + s.hours, 0));
  const totalNonBillableHours = roundHours(nonBillableSessions.reduce((sum, s) => sum + s.hours, 0));
  const totalBillableMinutes = proposedHours
    .filter((h) => h.record.billable)
    .reduce((sum, h) => sum + Math.round(h.record.totalHours * 60), 0);
  const totalNonBillableMinutes = proposedHours
    .filter((h) => !h.record.billable)
    .reduce((sum, h) => sum + Math.round(h.record.totalHours * 60), 0);
  // Billing convention (2026-07-10 approved): sum exact hours x rate across
  // every billable session first, round ONLY this final total to cents.
  const totalInvoiceAmount = roundCents(
    billableSessions.reduce((sum, s) => sum + s.hours * STANDARD_HOURLY_RATE, 0),
  );
  const referenceAppConventionTotal = roundCents(
    proposedHours
      .filter((h) => h.record.billable)
      .reduce((sum, h) => sum + h.record.referenceAppRoundedAmount, 0),
  );

  const discrepancies: string[] = [];

  if (roundHours(totalBillableHours) !== SOURCE_STATED_TOTALS.totalBillableHours) {
    discrepancies.push(
      `Recalculated billable hours (${totalBillableHours.toFixed(2)}) differs from the source-stated ` +
        `total (${SOURCE_STATED_TOTALS.totalBillableHours.toFixed(2)}).`,
    );
  }

  if (totalInvoiceAmount !== SOURCE_STATED_TOTALS.totalInvoiceAmount) {
    discrepancies.push(
      `Recalculated invoice amount ($${totalInvoiceAmount.toFixed(2)}) differs from the source-stated ` +
        `total ($${SOURCE_STATED_TOTALS.totalInvoiceAmount.toFixed(2)}).`,
    );
  }

  for (const [date, stated] of Object.entries(SOURCE_STATED_TOTALS.perDay)) {
    const day = perDay.find((d) => d.date === date);
    if (!day) continue;
    if (roundHours(day.billableHours) !== stated.hours) {
      discrepancies.push(
        `${date}: recalculated billable hours (${day.billableHours.toFixed(2)}) differs from source-stated (${stated.hours.toFixed(2)}).`,
      );
    }
    if (day.amount !== stated.amount) {
      discrepancies.push(
        `${date}: recalculated amount ($${day.amount.toFixed(2)}) differs from source-stated ($${stated.amount.toFixed(2)}).`,
      );
    }
  }

  return {
    totalBillableMinutes,
    totalNonBillableMinutes,
    totalBillableHours,
    totalNonBillableHours,
    totalInvoiceAmount,
    perDay,
    perSession,
    sourceStated: SOURCE_STATED_TOTALS,
    referenceAppConventionTotal,
    matchesSourceStated:
      roundHours(totalBillableHours) === SOURCE_STATED_TOTALS.totalBillableHours &&
      totalInvoiceAmount === SOURCE_STATED_TOTALS.totalInvoiceAmount,
    discrepancies,
  };
}

export function buildMigrationDryRun(
  snapshot: ExistingRecordsSnapshot = EMPTY_SNAPSHOT,
  opts: { generatedAt?: string } = {},
): MigrationDryRunResult {
  const warningIds = new Map<string, string[]>();
  const addWarning = (code: string, id: string) => {
    const list = warningIds.get(code) ?? [];
    list.push(id);
    warningIds.set(code, list);
  };

  const proposedClient = buildClient(snapshot);
  proposedClient.warnings.forEach((code) => addWarning(code, proposedClient.syntheticId));

  const { proposed: proposedHours, usedProjectKeys, warnings: hoursWarnings } = buildHours(snapshot);
  hoursWarnings.forEach((ids, code) => ids.forEach((id) => addWarning(code, id)));

  const proposedProjects = buildProjects(usedProjectKeys, snapshot);
  proposedProjects.forEach((p) => p.warnings.forEach((code) => addWarning(code, p.syntheticId)));

  const proposedWorkLogs = buildWorkLogs(snapshot, warningIds);

  for (const gap of UNTRACKED_GAPS) {
    addWarning("untracked-time-gap", `${gap.date} ${gap.start}-${gap.end}`);
  }

  const totals = buildTotals(proposedHours);

  addWarning(
    "stale-session-start-header",
    `header says ${JULY9_HEADER_VS_RECONCILED.headerStatedStart}, reconciled as ${JULY9_HEADER_VS_RECONCILED.reconciledStart}`,
  );

  const warnings: MigrationWarning[] = [...warningIds.entries()].map(([code, relatedIds]) => ({
    code,
    severity: WARNING_DEFS[code]?.severity ?? "info",
    message: WARNING_DEFS[code]?.message ?? code,
    relatedIds: [...new Set(relatedIds)],
  }));

  const skipped = [
    proposedClient.action === "skip-existing"
      ? { type: "client", syntheticId: proposedClient.syntheticId, reason: "A client with this name already exists locally." }
      : null,
    ...proposedProjects
      .filter((p) => p.action === "skip-existing")
      .map((p) => ({ type: "project", syntheticId: p.syntheticId, reason: "A project with this name already exists locally." })),
    ...proposedHours
      .filter((h) => h.action === "skip-existing")
      .map((h) => ({ type: "hours", syntheticId: h.syntheticId, reason: "An hours entry with the same client/date/start/end already exists locally." })),
    ...proposedWorkLogs
      .filter((w) => w.action === "skip-existing")
      .map((w) => ({ type: "worklog", syntheticId: w.syntheticId, reason: "A work log with the same client/date/title already exists locally." })),
  ].filter((x): x is { type: string; syntheticId: string; reason: string } => x !== null);

  return {
    schemaVersion: 3,
    generatedAt: opts.generatedAt ?? new Date().toISOString(),
    writesPerformed: false,
    notionWritesPerformed: false,
    sqliteWritesPerformed: false,
    sourcePages: Object.values(SOURCE_PAGES),
    proposedClient,
    proposedProjects,
    proposedHours,
    proposedWorkLogs,
    totals,
    warnings,
    skipped,
  };
}
