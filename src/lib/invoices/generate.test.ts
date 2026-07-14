import { describe, expect, it } from "vitest";
import { buildLineItems, buildSummary, nextInvoiceNumber } from "@/lib/invoices/generate";
import type { InvoiceReport, WorkLog } from "@/types/domain";

function invoice(overrides: Partial<InvoiceReport>): InvoiceReport {
  return {
    id: "inv_1",
    workspaceId: "ws_1",
    clientId: "cli_1",
    invoiceNumber: "AFP-2026-001",
    periodStart: "2026-06-01",
    periodEnd: "2026-06-07",
    hourlyRate: 100,
    totalHours: 10,
    totalAmount: 1000,
    summary: "",
    lineItems: [],
    hoursEntryIds: [],
    status: "draft",
    createdAt: "2026-06-08T00:00:00.000Z",
    updatedAt: "2026-06-08T00:00:00.000Z",
    notionPageId: null,
    notionDatabaseId: null,
    syncStatus: "local-only",
    lastSyncedAt: null,
    notionLastEditedTime: null,
    ...overrides,
  };
}

function worklog(overrides: Partial<WorkLog>): WorkLog {
  return {
    id: "wl_1",
    workspaceId: "ws_1",
    clientId: "cli_1",
    projectId: null,
    title: "Untitled",
    date: "2026-06-01",
    summary: "Summary",
    detailedNotes: "",
    invoiceDescription: "",
    status: "done",
    priority: "medium",
    relatedHoursIds: [],
    relatedKnowledgeIds: [],
    evidence: [],
    githubLink: null,
    attachments: [],
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    notionPageId: null,
    notionDatabaseId: null,
    syncStatus: "local-only",
    lastSyncedAt: null,
    notionLastEditedTime: null,
    ...overrides,
  };
}

describe("nextInvoiceNumber", () => {
  it("starts a fresh sequence from the first six alphanumeric characters of the client name", () => {
    expect(nextInvoiceNumber("Acme Fabrication Partners", [], 2026)).toBe(
      "ACMEFA-2026-001",
    );
  });

  it("falls back to a single-letter code when the client name has almost no alphanumeric characters", () => {
    expect(nextInvoiceNumber("---", [], 2026)).toBe("C-2026-001");
  });

  it("continues the numeric sequence from the highest existing invoice number", () => {
    const existing = [
      invoice({ invoiceNumber: "AFP-2026-001" }),
      invoice({ invoiceNumber: "AFP-2026-003" }),
      invoice({ invoiceNumber: "AFP-2026-002" }),
    ];
    expect(nextInvoiceNumber("AFP", existing, 2026)).toBe("AFP-2026-004");
  });

  it("preserves zero-padding width from the prior invoice number", () => {
    const existing = [invoice({ invoiceNumber: "AFP-0099" })];
    expect(nextInvoiceNumber("AFP", existing, 2026)).toBe("AFP-0100");
  });

  it("ignores invoice numbers with no trailing digits when finding the sequence", () => {
    const existing = [invoice({ invoiceNumber: "AFP-DRAFT" })];
    expect(nextInvoiceNumber("AFP", existing, 2026)).toBe("AFP-2026-001");
  });
});

describe("buildLineItems", () => {
  it("splits a day's billable hours evenly across same-day work logs", () => {
    const logs = [
      worklog({ id: "a", date: "2026-06-01", title: "Fix bug", invoiceDescription: "Fixed the bug" }),
      worklog({ id: "b", date: "2026-06-01", title: "Write docs", summary: "Docs summary" }),
    ];
    const items = buildLineItems(logs, [{ date: "2026-06-01", totalHours: 5 }]);

    expect(items).toEqual([
      { workLogId: "a", title: "Fix bug", description: "Fixed the bug", hours: 2.5 },
      { workLogId: "b", title: "Write docs", description: "Docs summary", hours: 2.5 },
    ]);
  });

  it("prefers invoiceDescription over summary, falling back when empty", () => {
    const logs = [worklog({ id: "a", invoiceDescription: "", summary: "Fallback summary" })];
    const items = buildLineItems(logs, []);
    expect(items[0].description).toBe("Fallback summary");
  });

  it("assigns zero hours for a work log on a date with no billable entries", () => {
    const logs = [worklog({ id: "a", date: "2026-06-02" })];
    const items = buildLineItems(logs, [{ date: "2026-06-01", totalHours: 5 }]);
    expect(items[0].hours).toBe(0);
  });

  it("skips superseded billable rows when building line items", () => {
    const logs = [worklog({ id: "a", date: "2026-06-01", title: "Fix bug", invoiceDescription: "Fixed the bug" })];
    const items = buildLineItems(logs, [
      { date: "2026-06-01", totalHours: 2.5, externalId: "afp-history-v2-superseded-hours-2026-06-01-0900-1100" },
      { date: "2026-06-01", totalHours: 2.5, externalId: "afp-history-v2-hours-2026-06-01-1100-1300-billable-bol-review-process-v2-v2" },
    ]);

    expect(items).toEqual([
      { workLogId: "a", title: "Fix bug", description: "Fixed the bug", hours: 2.5 },
    ]);
  });

  it("returns an empty list when there are no work logs", () => {
    expect(buildLineItems([], [{ date: "2026-06-01", totalHours: 5 }])).toEqual([]);
  });
});

describe("buildSummary", () => {
  it("includes the period, total hours, rate, and up to five highlights", () => {
    const lineItems = [
      { workLogId: "a", title: "Fix bug", description: "", hours: 2 },
      { workLogId: "b", title: "Write docs", description: "", hours: 3 },
    ];
    const summary = buildSummary("2026-06-01", "2026-06-07", lineItems, 5, 100);
    expect(summary).toBe(
      "Invoice for work performed 2026-06-01 to 2026-06-07 - 5.00h @ $100.00/hr. Highlights: Fix bug; Write docs.",
    );
  });

  it("omits the highlights clause when there are no line items", () => {
    const summary = buildSummary("2026-06-01", "2026-06-07", [], 0, 100);
    expect(summary).toBe("Invoice for work performed 2026-06-01 to 2026-06-07 - 0.00h @ $100.00/hr.");
  });

  it("caps highlights at the first five line items", () => {
    const lineItems = Array.from({ length: 7 }, (_, i) => ({
      workLogId: `wl_${i}`,
      title: `Task ${i}`,
      description: "",
      hours: 1,
    }));
    const summary = buildSummary("2026-06-01", "2026-06-07", lineItems, 7, 100);
    expect(summary).toContain("Task 0; Task 1; Task 2; Task 3; Task 4.");
    expect(summary).not.toContain("Task 5");
  });
});
