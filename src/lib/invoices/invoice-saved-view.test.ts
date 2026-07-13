import { describe, expect, it } from "vitest";
import {
  applyImmutableSnapshotToReport,
  composeSavedInvoiceView,
  detectSavedInvoiceDrift,
} from "./invoice-saved-view";
import { buildInvoiceSavePreflight } from "./invoice-save";
import { buildJuly810ReportDataset } from "@/lib/notion/relation-backfill/july8-10-dataset";
import { DEFAULT_REPORT_SETTINGS } from "@/lib/reports/types";
import type { BaseEntity, HoursEntry, InvoiceReport, WorkLog } from "@/types/domain";

const dataset = buildJuly810ReportDataset();
const clientId = dataset.clients[0].id;
const invoiceId = "inv-saved-001";

function stubEntity(id: string): Pick<BaseEntity, "notionPageId" | "notionDatabaseId" | "syncStatus" | "lastSyncedAt" | "notionLastEditedTime" | "createdAt" | "updatedAt"> {
  return {
    notionPageId: id,
    notionDatabaseId: "db",
    syncStatus: "synced",
    lastSyncedAt: null,
    notionLastEditedTime: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
  };
}

function hoursFromDataset(invoiced = true): HoursEntry[] {
  const billableIds = new Set([
    "hrs-jul8-bol",
    "hrs-jul8-padocs",
    "hrs-jul9-bol",
    "hrs-jul10-bol",
  ]);
  return dataset.hours.map((h) => ({
    id: h.id,
    ...stubEntity(h.id),
    workspaceId: "ws",
    clientId: h.clientId,
    projectId: h.projectId,
    date: h.date,
    startTime: h.startTime,
    endTime: h.endTime,
    breakMinutes: h.breakMinutes,
    totalHours: 0,
    hourlyRate: h.hourlyRate,
    billable: h.billable,
    location: "",
    relatedWorkLogId: h.relatedWorkLogId,
    relatedWorkDoneIds: h.relatedWorkDoneIds,
    notes: "",
    source: "manual" as const,
    externalId: h.migrationKey ?? null,
    sessionId: h.id,
    billingStatus: billableIds.has(h.id) && invoiced ? ("invoiced" as const) : (h.billingStatus as HoursEntry["billingStatus"]) ?? (h.billable ? "ready-to-invoice" : "reviewed"),
    invoiceReportId: billableIds.has(h.id) && invoiced ? invoiceId : null,
  }));
}

function workFromDataset(): WorkLog[] {
  return dataset.workRecords.map((w) => ({
    id: w.id,
    ...stubEntity(w.id),
    workspaceId: "ws",
    clientId: w.clientId,
    projectId: w.projectId,
    title: w.title,
    date: w.date,
    status: "done" as const,
    priority: "medium" as const,
    summary: w.summary,
    invoiceDescription: w.detailedWorkDescription,
    detailedWorkDescription: w.detailedWorkDescription,
    detailedNotes: w.internalNotes,
    internalNotes: w.internalNotes,
    githubLink: null,
    clientVisible: w.clientVisible === true,
    includeInInvoice: w.includeInInvoice === true,
    includeInWorkReport: w.includeInWorkReport === true,
    evidence: [],
    attachments: [],
    relatedHoursIds: w.relatedHoursIds,
    relatedKnowledgeIds: [],
    workLogId: w.id,
    approvalStatus: "approved" as const,
    invoiceReportId: invoiceId,
  }));
}

function savedInvoice(): InvoiceReport {
  const billableIds = ["hrs-jul8-bol", "hrs-jul8-padocs", "hrs-jul9-bol", "hrs-jul10-bol"];
  return {
    id: invoiceId,
    ...stubEntity(invoiceId),
    workspaceId: "ws",
    clientId,
    invoiceNumber: "AFP-2026-001",
    periodStart: "2026-07-08",
    periodEnd: "2026-07-10",
    hourlyRate: 30,
    totalHours: 16.45,
    totalAmount: 493.5,
    summary: "July services",
    lineItems: [],
    hoursEntryIds: billableIds,
    workDoneIds: ["wl-jul8", "wl-jul9", "wl-jul10"],
    status: "draft",
    invoiceDate: "2026-07-11",
    dueDate: "2026-07-26",
    paymentTerms: "Net 15",
  };
}

describe("saved invoice preview", () => {
  it("includes Invoiced Hours and preserves immutable totals", () => {
    const view = composeSavedInvoiceView(
      savedInvoice(),
      hoursFromDataset(true),
      workFromDataset(),
      dataset,
      DEFAULT_REPORT_SETTINGS,
    );

    expect(view.report.sessions.filter((s) => s.billable)).toHaveLength(4);
    expect(view.report.totals.amountDue).toBe(493.5);
    expect(view.immutableTotals.totalAmount).toBe(493.5);
    expect(view.immutableTotals.totalHours).toBe(16.45);
    expect(JSON.stringify(view.report).toLowerCase()).not.toContain("internal notes");
  });

  it("warns when live source rows differ from saved snapshot", () => {
    const mutatedHours = hoursFromDataset(true).map((h) =>
      h.id === "hrs-jul8-bol" ? { ...h, hourlyRate: 45 } : h,
    );
    const view = composeSavedInvoiceView(
      savedInvoice(),
      mutatedHours,
      workFromDataset(),
      dataset,
      DEFAULT_REPORT_SETTINGS,
    );

    expect(view.report.totals.amountDue).toBe(493.5);
    expect(view.liveDriftWarnings.some((w) => w.includes("recompose"))).toBe(true);
  });

  it("applyImmutableSnapshotToReport keeps session lines but overlays totals", () => {
    const view = composeSavedInvoiceView(
      savedInvoice(),
      hoursFromDataset(true),
      workFromDataset(),
      dataset,
      DEFAULT_REPORT_SETTINGS,
    );
    const beforeAmount = view.report.totals.amountDue;
    const overlaid = applyImmutableSnapshotToReport(
      { ...view.report, totals: { ...view.report.totals, amountDue: 0 } },
      savedInvoice(),
    );
    expect(overlaid.totals.amountDue).toBe(493.5);
    expect(overlaid.sessions.length).toBe(view.report.sessions.length);
    expect(beforeAmount).toBe(493.5);
  });

  it("detectSavedInvoiceDrift reports count mismatch", () => {
    const view = composeSavedInvoiceView(
      savedInvoice(),
      hoursFromDataset(true),
      workFromDataset(),
      dataset,
      DEFAULT_REPORT_SETTINGS,
    );
    const drift = detectSavedInvoiceDrift(
      { ...view.report, sessions: view.report.sessions.slice(0, 1) },
      savedInvoice(),
      hoursFromDataset(true),
    );
    expect(drift.some((w) => w.includes("Included Hours count"))).toBe(true);
  });
});

describe("new invoice generation still blocks invoiced hours", () => {
  it("preflight is not ready when billable hours are already invoiced", () => {
    const hours = hoursFromDataset(true);
    const invoices: InvoiceReport[] = [
      {
        ...savedInvoice(),
        invoiceNumber: "AFP-2026-009",
        hoursEntryIds: ["hrs-jul8-bol"],
        status: "sent",
      },
    ];
    const preflight = buildInvoiceSavePreflight(
      dataset,
      DEFAULT_REPORT_SETTINGS,
      {
        type: "simple-invoice",
        clientId,
        periodStart: "2026-07-08",
        periodEnd: "2026-07-10",
        projectIds: [],
        invoiceNumber: "AFP-2026-002",
        invoiceDate: "2026-07-11",
        dueDate: "2026-07-26",
        paymentTerms: "Net 15",
        customTitle: "",
        notes: "",
        executiveSummary: "",
        draftDescriptions: {},
      },
      invoices,
      hours.map((h) => (h.id === "hrs-jul8-bol" ? { ...h, invoiceReportId: invoiceId } : h)),
      workFromDataset(),
    );
    expect(preflight.ready).toBe(false);
    expect(preflight.duplicateConflicts.length).toBeGreaterThan(0);
  });
});
