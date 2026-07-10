import { describe, expect, it } from "vitest";
import {
  amountFromExactMinutes,
  composeDetailedInvoice,
  composeReport,
  composeSimpleInvoice,
  composeWorkLogReport,
  exactElapsedMinutes,
  filterByClient,
  filterByDateRange,
  filterByProjects,
  filterWorkRecordsForPrivacy,
} from "./engine";
import { serializeReportHtml, serializeReportJson, serializeReportMarkdown } from "./serializers";
import { PROPOSED_NOTION_REPORT_FIELDS } from "./schema-proposal";
import { DEFAULT_REPORT_SETTINGS, type ReportBuilderInput, type ReportDataset } from "./types";

const INTERNAL_SECRET = "INTERNAL-ONLY: rotate production credentials";

function fixture(): ReportDataset {
  return {
    source: "historical-preview",
    label: "Historical preview data",
    description: "test",
    clients: [
      { id: "afp", name: "Anytime Fuel Pros", defaultHourlyRate: 30 },
      { id: "other", name: "Other Client", defaultHourlyRate: 100 },
    ],
    projects: [
      { id: "bol", clientId: "afp", name: "BOL Review Process V2" },
      { id: "docs", clientId: "afp", name: "Power Automate Documentation" },
    ],
    hours: [
      { id: "onsite", clientId: "afp", projectId: null, date: "2026-07-08", startTime: "09:00", endTime: "11:00", breakMinutes: 0, hourlyRate: 30, billable: false, relatedWorkLogId: "w8" },
      { id: "s1", clientId: "afp", projectId: "bol", date: "2026-07-08", startTime: "11:00", endTime: "13:00", breakMinutes: 0, hourlyRate: 30, billable: true, relatedWorkLogId: "w8" },
      { id: "s2", clientId: "afp", projectId: "docs", date: "2026-07-08", startTime: "14:05", endTime: "17:00", breakMinutes: 0, hourlyRate: 30, billable: true, relatedWorkLogId: "w8" },
      { id: "s3", clientId: "afp", projectId: "docs", date: "2026-07-08", startTime: "17:10", endTime: "17:49", breakMinutes: 0, hourlyRate: 30, billable: true, relatedWorkLogId: "w8" },
      { id: "s4", clientId: "afp", projectId: "bol", date: "2026-07-09", startTime: "09:12", endTime: "14:00", breakMinutes: 0, hourlyRate: 30, billable: true, relatedWorkLogId: "w9" },
      { id: "other-hours", clientId: "other", projectId: null, date: "2026-07-09", startTime: "09:00", endTime: "10:00", breakMinutes: 0, hourlyRate: 100, billable: true, relatedWorkLogId: null },
    ],
    workRecords: [
      {
        id: "w8", clientId: "afp", projectId: null, date: "2026-07-08", title: "July 8 work", summary: "Summary 8",
        detailedWorkDescription: "Reviewed, tested, and documented the automation workflow.", internalNotes: INTERNAL_SECRET,
        status: "done", clientVisible: true, includeInInvoice: true, includeInWorkReport: true,
        evidenceLinks: ["https://example.com/evidence"], relatedHoursIds: ["onsite", "s1", "s2", "s3"],
        deliverables: ["Workflow documentation"], testingPerformed: ["Extraction verification"], blockers: ["API credit limit"], followUpItems: ["Continue validation"],
      },
      {
        id: "w9", clientId: "afp", projectId: "bol", date: "2026-07-09", title: "July 9 work", summary: "Summary 9",
        detailedWorkDescription: "Implemented routing and concurrency improvements.", internalNotes: INTERNAL_SECRET,
        status: "done", clientVisible: true, includeInInvoice: true, includeInWorkReport: true,
        evidenceLinks: [], relatedHoursIds: ["s4"], deliverables: ["Unmatched route"], testingPerformed: ["Batch routing"], blockers: [], followUpItems: [],
      },
    ],
    knowledgeRecords: [{
      id: "k1", clientId: "afp", projectId: "bol", title: "Flow reference", reportSummary: "Client-safe architecture reference.",
      internalNotes: INTERNAL_SECRET, clientVisible: true, includeInWorkReport: true, sourcePage: "https://example.com/source",
    }],
  };
}

function input(overrides: Partial<ReportBuilderInput> = {}): ReportBuilderInput {
  return {
    type: "simple-invoice",
    clientId: "afp",
    periodStart: "2026-07-08",
    periodEnd: "2026-07-09",
    projectIds: [],
    invoiceNumber: "AFP-2026-001",
    invoiceDate: "2026-07-10",
    paymentTerms: "Net 15",
    dueDate: "2026-07-25",
    customTitle: "",
    notes: "Thanks",
    executiveSummary: "",
    draftDescriptions: {},
    ...overrides,
  };
}

describe("report filtering", () => {
  it("documents the proposed Notion visibility fields without applying a schema", () => {
    expect(PROPOSED_NOTION_REPORT_FIELDS.workDone.map((field) => field.name)).toEqual([
      "Client Visible",
      "Include in Invoice",
      "Include in Work Report",
      "Detailed Work Description",
      "Internal Notes",
      "Evidence Links",
      "Related Hours",
    ]);
    expect(PROPOSED_NOTION_REPORT_FIELDS.knowledge.map((field) => field.name)).toContain("Report Summary");
  });

  it("filters inclusive date ranges", () => {
    expect(filterByDateRange(fixture().hours, "2026-07-09", "2026-07-09").map((row) => row.id)).toEqual(["s4", "other-hours"]);
  });

  it("filters projects without including missing projects", () => {
    expect(filterByProjects(fixture().hours, ["docs"]).map((row) => row.id)).toEqual(["s2", "s3"]);
  });

  it("filters clients", () => {
    expect(filterByClient(fixture().hours, "other").map((row) => row.id)).toEqual(["other-hours"]);
  });

  it("defaults missing visibility flags to excluded", () => {
    const record = { ...fixture().workRecords[0], clientVisible: null };
    const result = filterWorkRecordsForPrivacy([record], "simple-invoice");
    expect(result.included).toHaveLength(0);
    expect(result.excluded[0].reason).toMatch(/missing/);
  });

  it("requires Client Visible even when include flags are true", () => {
    const record = { ...fixture().workRecords[0], clientVisible: false };
    expect(filterWorkRecordsForPrivacy([record], "detailed-invoice").included).toHaveLength(0);
  });

  it("requires Include in Invoice for invoice reports", () => {
    const record = { ...fixture().workRecords[0], includeInInvoice: false };
    expect(filterWorkRecordsForPrivacy([record], "simple-invoice").excluded[0].reason).toMatch(/Invoice/);
  });

  it("requires Include in Work Report for work reports", () => {
    const record = { ...fixture().workRecords[0], includeInWorkReport: false };
    expect(filterWorkRecordsForPrivacy([record], "work-log-report").excluded[0].reason).toMatch(/Work Report/);
  });
});

describe("exact-minute billing", () => {
  it("computes elapsed minutes including overnight sessions and breaks", () => {
    expect(exactElapsedMinutes("23:30", "01:00", 15)).toBe(75);
  });

  it("calculates a line amount from exact minutes before cent rounding", () => {
    expect(amountFromExactMinutes(39, 30)).toBe(19.5);
    expect(amountFromExactMinutes(1, 10)).toBe(0.17);
  });

  it("preserves the approved historical $311.00 reconciliation", () => {
    const report = composeDetailedInvoice(fixture(), DEFAULT_REPORT_SETTINGS, input({ type: "detailed-invoice" }));
    expect(report.totals.billableMinutes).toBe(622);
    expect(report.totals.amountDue).toBe(311);
    expect(report.sessions.map((line) => line.amount)).toEqual([60, 87.5, 19.5, 144]);
  });
});

describe("invoice composition", () => {
  it("groups a simple invoice by project", () => {
    const report = composeSimpleInvoice(fixture(), DEFAULT_REPORT_SETTINGS, input());
    expect(report.type).toBe("simple-invoice");
    expect(report.projectTotals.map((row) => [row.label, row.amount])).toEqual([
      ["BOL Review Process V2", 204],
      ["Power Automate Documentation", 107],
    ]);
  });

  it("creates detailed line items and daily subtotals", () => {
    const report = composeDetailedInvoice(fixture(), DEFAULT_REPORT_SETTINGS, input());
    expect(report.sessions).toHaveLength(4);
    expect(report.dailyTotals.map((row) => [row.label, row.amount])).toEqual([
      ["2026-07-08", 167],
      ["2026-07-09", 144],
    ]);
  });

  it("honors project filters for a multi-project related work record", () => {
    const report = composeReport(fixture(), DEFAULT_REPORT_SETTINGS, input({ projectIds: ["docs"] }));
    expect(report.sessions.map((line) => line.id)).toEqual(["s2", "s3"]);
    expect(report.totals.amountDue).toBe(107);
  });

  it("excludes missing descriptions with a useful reason", () => {
    const data = fixture();
    data.workRecords[0].detailedWorkDescription = "";
    const report = composeReport(data, DEFAULT_REPORT_SETTINGS, input({ periodEnd: "2026-07-08" }));
    expect(report.sessions).toHaveLength(0);
    expect(report.excludedRecords.some((record) => record.reason.includes("description"))).toBe(true);
  });

  it("keeps a missing project as an explicit warning instead of crashing", () => {
    const data = fixture();
    data.projects = data.projects.filter((project) => project.id !== "docs");
    const report = composeReport(data, DEFAULT_REPORT_SETTINGS, input());
    expect(report.sessions.some((line) => line.projectName === "Missing project")).toBe(true);
    expect(report.warnings.some((warning) => warning.includes("project"))).toBe(true);
  });

  it("returns a useful empty state warning", () => {
    const report = composeReport(fixture(), DEFAULT_REPORT_SETTINGS, input({ periodStart: "2027-01-01", periodEnd: "2027-01-31" }));
    expect(report.sessions).toHaveLength(0);
    expect(report.warnings).toContain("No approved hours records match the selected filters.");
  });

  it("supports long descriptions without truncating report data", () => {
    const long = "Long client-visible detail ".repeat(300);
    const report = composeReport(fixture(), DEFAULT_REPORT_SETTINGS, input({
      type: "detailed-invoice",
      draftDescriptions: { w8: long },
    }));
    expect(report.sessions[0].description).toBe(long.trim());
    expect(serializeReportHtml(report)).toContain("Long client-visible detail");
  });
});

describe("work log report composition", () => {
  it("includes client-visible work, knowledge, evidence, deliverables, and verification", () => {
    const report = composeWorkLogReport(fixture(), DEFAULT_REPORT_SETTINGS, input({ type: "work-log-report" }));
    expect(report.workItems).toHaveLength(2);
    expect(report.knowledgeItems).toHaveLength(1);
    expect(report.workItems[0].deliverables).toContain("Workflow documentation");
    expect(report.workItems[0].testingPerformed).toContain("Extraction verification");
    expect(report.workItems[0].evidenceLinks).toContain("https://example.com/evidence");
  });

  it("reports billable and non-billable time separately", () => {
    const report = composeWorkLogReport(fixture(), DEFAULT_REPORT_SETTINGS, input());
    expect(report.totals.billableMinutes).toBe(622);
    expect(report.totals.nonBillableMinutes).toBe(120);
    expect(report.dailyTotals[0].exactMinutes).toBe(454);
  });
});

describe("immutability and deterministic safe exports", () => {
  it("draft edits do not mutate source records", () => {
    const data = fixture();
    const before = structuredClone(data);
    const report = composeReport(data, DEFAULT_REPORT_SETTINGS, input({ draftDescriptions: { w8: "Edited for this draft" } }));
    expect(report.sessions[0].description).toBe("Edited for this draft");
    expect(data).toEqual(before);
  });

  it("produces deterministic output for identical input", () => {
    const data = fixture();
    expect(composeReport(data, DEFAULT_REPORT_SETTINGS, input())).toEqual(
      composeReport(data, DEFAULT_REPORT_SETTINGS, input()),
    );
  });

  it("serializes Markdown with invoice totals", () => {
    const markdown = serializeReportMarkdown(composeReport(fixture(), DEFAULT_REPORT_SETTINGS, input()));
    expect(markdown).toContain("# Invoice");
    expect(markdown).toContain("**Amount due:** $311.00");
  });

  it("serializes stable JSON audit output", () => {
    const json = serializeReportJson(composeReport(fixture(), DEFAULT_REPORT_SETTINGS, input()));
    expect(JSON.parse(json).totals.amountDue).toBe(311);
    expect(json).toBe(serializeReportJson(composeReport(fixture(), DEFAULT_REPORT_SETTINGS, input())));
  });

  it("never exposes internal notes in Markdown, HTML, or JSON", () => {
    const report = composeWorkLogReport(fixture(), DEFAULT_REPORT_SETTINGS, input());
    expect(serializeReportMarkdown(report)).not.toContain(INTERNAL_SECRET);
    expect(serializeReportHtml(report)).not.toContain(INTERNAL_SECRET);
    expect(serializeReportJson(report)).not.toContain(INTERNAL_SECRET);
    expect(JSON.stringify(report)).not.toContain("internalNotes");
  });

  it("redacts excluded private titles from the JSON snapshot", () => {
    const data = fixture();
    data.workRecords.push({
      ...data.workRecords[0],
      id: "private-work",
      title: "Private acquisition discussion",
      clientVisible: false,
      relatedHoursIds: [],
    });
    const report = composeReport(data, DEFAULT_REPORT_SETTINGS, input());
    expect(report.excludedRecords.some((record) => record.title === "Private acquisition discussion")).toBe(true);
    expect(serializeReportJson(report)).not.toContain("Private acquisition discussion");
  });
});
