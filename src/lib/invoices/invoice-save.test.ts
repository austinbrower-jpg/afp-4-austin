import { describe, expect, it, vi } from "vitest";
import {
  assertInvoiceSaveAllowed,
  buildInvoiceSavePlan,
  buildInvoiceSavePreflight,
  INVOICE_SAVE_CONFIRMATION_PHRASE,
  isInvoiceSaveEnabled,
} from "./invoice-save";
import { applyInvoiceSave } from "./invoice-save-apply";
import { composeSavedInvoiceView } from "./invoice-saved-view";
import { buildJuly810ReportDataset } from "@/lib/notion/relation-backfill/july8-10-dataset";
import { DEFAULT_REPORT_SETTINGS } from "@/lib/reports/types";
import type { BaseEntity, HoursEntry, InvoiceReport, WorkLog } from "@/types/domain";

const dataset = buildJuly810ReportDataset();
const clientId = dataset.clients[0].id;

const baseRequest = {
  type: "simple-invoice" as const,
  clientId,
  periodStart: "2026-07-08",
  periodEnd: "2026-07-10",
  projectIds: [] as string[],
  invoiceNumber: "AFP-2026-010",
  invoiceDate: "2026-07-11",
  dueDate: "2026-07-26",
  paymentTerms: "Net 15",
  customTitle: "",
  notes: "",
  executiveSummary: "",
  draftDescriptions: {},
};

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

function hoursFromDataset(): HoursEntry[] {
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
    sessionId:
      h.id === "hrs-jul8-onsite"
        ? "AFP-2026-07-08-001"
        : h.id === "hrs-jul8-bol"
          ? "AFP-2026-07-08-002"
          : h.id === "hrs-jul8-padocs"
            ? "AFP-2026-07-08-003"
            : h.id === "hrs-jul9-bol"
              ? "AFP-2026-07-09-001"
              : h.id === "hrs-jul10-bol"
                ? "AFP-2026-07-10-001"
                : h.id === "hrs-jul8-quarantine"
                  ? "AFP-2026-07-08-004"
                  : null,
    billingStatus: (h.billingStatus as HoursEntry["billingStatus"]) ?? (h.billable ? "ready-to-invoice" : "reviewed"),
    invoiceReportId: null,
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
    workLogId:
      w.id === "wl-jul8"
        ? "AFP-WORK-2026-07-08-001"
        : w.id === "wl-jul9"
          ? "AFP-WORK-2026-07-09-001"
          : "AFP-WORK-2026-07-10-001",
    approvalStatus: "approved" as const,
    invoiceReportId: null,
  }));
}

function stubInvoice(overrides: Partial<InvoiceReport> = {}): InvoiceReport {
  return {
    id: "inv-1",
    ...stubEntity("inv-1"),
    workspaceId: "ws",
    clientId,
    invoiceNumber: "AFP-2026-009",
    periodStart: "2026-07-08",
    periodEnd: "2026-07-10",
    hourlyRate: 30,
    totalHours: 16.45,
    totalAmount: 493.5,
    summary: "July invoice",
    lineItems: [],
    hoursEntryIds: ["hrs-jul8-bol"],
    workDoneIds: ["wl-jul8"],
    status: "sent",
    invoiceDate: "2026-07-11",
    dueDate: "2026-07-26",
    paymentTerms: "Net 15",
    ...overrides,
  };
}

describe("invoice save preflight", () => {
  it("reports $493.50 with 4 billable sessions and 3 work done rows", () => {
    const preflight = buildInvoiceSavePreflight(
      dataset,
      DEFAULT_REPORT_SETTINGS,
      baseRequest,
      [],
      hoursFromDataset(),
      workFromDataset(),
    );
    expect(preflight.writesPerformed).toBe(false);
    expect(preflight.readOnly).toBe(true);
    expect(preflight.totals.amount).toBe(493.5);
    expect(preflight.includedHours.length).toBe(4);
    expect(preflight.includedWorkDone.length).toBe(3);
    expect(preflight.ready).toBe(true);
  });

  it("blocks when preview gating fails without client", () => {
    const preflight = buildInvoiceSavePreflight(
      dataset,
      DEFAULT_REPORT_SETTINGS,
      { ...baseRequest, clientId: "missing" },
      [],
      hoursFromDataset(),
      workFromDataset(),
    );
    expect(preflight.ready).toBe(false);
    expect(preflight.gatingReasons.some((r) => r.includes("Client"))).toBe(true);
  });

  it("blocks already-invoiced hours", () => {
    const hours = hoursFromDataset().map((h) =>
      h.id === "hrs-jul8-bol" ? { ...h, billingStatus: "invoiced" as const, invoiceReportId: "inv-1" } : h,
    );
    const preflight = buildInvoiceSavePreflight(
      dataset,
      DEFAULT_REPORT_SETTINGS,
      baseRequest,
      [stubInvoice()],
      hours,
      workFromDataset(),
    );
    expect(preflight.ready).toBe(false);
    expect(preflight.duplicateConflicts.some((c) => c.message.includes("Already invoiced"))).toBe(true);
  });

  it("blocks paid hours", () => {
    const hours = hoursFromDataset().map((h) =>
      h.id === "hrs-jul8-bol" ? { ...h, billingStatus: "paid" as const } : h,
    );
    const preflight = buildInvoiceSavePreflight(
      dataset,
      DEFAULT_REPORT_SETTINGS,
      baseRequest,
      [],
      hours,
      workFromDataset(),
    );
    expect(preflight.ready).toBe(false);
    expect(preflight.duplicateConflicts.some((c) => c.code === "paid-hours")).toBe(true);
  });

  it("excludes superseded row from July 8 only range", () => {
    const preflight = buildInvoiceSavePreflight(
      {
        ...dataset,
        hours: dataset.hours.map((h) =>
          h.id === "hrs-jul8-quarantine" ? { ...h, billingStatus: "superseded" } : h,
        ),
      },
      DEFAULT_REPORT_SETTINGS,
      { ...baseRequest, periodStart: "2026-07-08", periodEnd: "2026-07-08" },
      [],
      hoursFromDataset(),
      workFromDataset(),
    );
    expect(preflight.duplicateConflicts.some((c) => c.code === "superseded")).toBe(false);
    expect(preflight.includedHours.every((h) => h.id !== "hrs-jul8-quarantine")).toBe(true);
  });

  it("blocks missing session id", () => {
    const hours = hoursFromDataset().map((h) =>
      h.id === "hrs-jul8-bol" ? { ...h, sessionId: null } : h,
    );
    const preflight = buildInvoiceSavePreflight(
      dataset,
      DEFAULT_REPORT_SETTINGS,
      baseRequest,
      [],
      hours,
      workFromDataset(),
    );
    expect(preflight.duplicateConflicts.some((c) => c.code === "missing-session-id")).toBe(true);
  });

  it("requires confirmation phrase for live save", () => {
    const prev = process.env.NOTION_INVOICE_SAVE_ENABLED;
    process.env.NOTION_INVOICE_SAVE_ENABLED = "true";
    try {
      expect(() => assertInvoiceSaveAllowed("wrong")).toThrow(INVOICE_SAVE_CONFIRMATION_PHRASE);
    } finally {
      process.env.NOTION_INVOICE_SAVE_ENABLED = prev;
    }
  });

  it("defaults live save to disabled", () => {
    expect(isInvoiceSaveEnabled()).toBe(false);
  });

  it("builds invoice creation payload with relations", () => {
    const plan = buildInvoiceSavePlan(
      dataset,
      DEFAULT_REPORT_SETTINGS,
      baseRequest,
      [],
      hoursFromDataset(),
      workFromDataset(),
    );
    expect(plan.invoicePayload.status).toBe("draft");
    expect(plan.invoicePayload.hoursEntryIds.length).toBe(4);
    expect(plan.invoicePayload.workDoneIds.length).toBe(3);
    expect(plan.invoicePayload.totalAmount).toBe(493.5);
  });

  it("detects duplicate invoice number for idempotent resolve", () => {
    const plan = buildInvoiceSavePlan(
      dataset,
      DEFAULT_REPORT_SETTINGS,
      baseRequest,
      [stubInvoice({ invoiceNumber: "AFP-2026-010", notionPageId: "existing-page" })],
      hoursFromDataset(),
      workFromDataset(),
    );
    expect(plan.existingInvoiceId).toBe("existing-page");
    expect(plan.writeSteps[0].phase).toBe("link-invoice-relations");
  });
});

describe("invoice save apply (mocked)", () => {
  it("refuses when save is disabled", async () => {
    await expect(
      applyInvoiceSave({
        notion: { pages: { create: vi.fn(), update: vi.fn(), retrieve: vi.fn() } } as never,
        invoiceDatabaseId: "db",
        dataset,
        settings: DEFAULT_REPORT_SETTINGS,
        request: { ...baseRequest, confirmationPhrase: INVOICE_SAVE_CONFIRMATION_PHRASE },
        existingInvoices: [],
        allHours: hoursFromDataset(),
        allWork: workFromDataset(),
        workspaceId: "ws",
      }),
    ).rejects.toThrow("NOTION_INVOICE_SAVE_ENABLED");
  });
});

describe("saved invoice immutable view", () => {
  it("composes from included relations only and preserves saved totals", () => {
    const hours = hoursFromDataset();
    const work = workFromDataset();
    const invoice = stubInvoice({
      invoiceNumber: "AFP-2026-010",
      hoursEntryIds: hours.filter((h) => h.billable).map((h) => h.id),
      workDoneIds: work.map((w) => w.id),
      status: "draft",
    });
    const view = composeSavedInvoiceView(invoice, hours, work, dataset, DEFAULT_REPORT_SETTINGS);
    expect(view.immutableTotals.totalAmount).toBe(493.5);
    expect(view.sessionIds.length).toBeGreaterThan(0);
    expect(view.workLogIds.length).toBe(3);
  });
});

describe("invoice status mapping", () => {
  it("treats void as non-blocking for duplicate billing", async () => {
    const { isCancelledInvoice } = await import("./invoice-locking");
    expect(isCancelledInvoice("void")).toBe(true);
  });

  it("does not auto-unlock void invoices for billing blocks", async () => {
    const { invoiceBlocksNewBilling } = await import("./invoice-status");
    expect(invoiceBlocksNewBilling("void")).toBe(false);
    expect(invoiceBlocksNewBilling("sent")).toBe(true);
  });
});
