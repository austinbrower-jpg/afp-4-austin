/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest";
import {
  buildClientBillingHistory,
  buildInvoiceDashboardData,
  summarizeInvoiceDashboard,
} from "./dashboard";

const base = {
  id: "x",
  workspaceId: "ws",
  clientId: "c1",
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
  notionPageId: null,
  notionDatabaseId: null,
  syncStatus: "local-only",
  lastSyncedAt: null,
  notionLastEditedTime: null,
} as const;

const client = {
  ...base,
  id: "c1",
  name: "AFP",
  color: "",
  status: "active",
  defaultHourlyRate: 100,
  timezone: "UTC",
  notes: "",
} as any;

const paidInvoice = {
  ...base,
  id: "i1",
  invoiceNumber: "1",
  periodStart: "2026-07-01",
  periodEnd: "2026-07-02",
  hourlyRate: 100,
  totalHours: 2,
  totalAmount: 200,
  summary: "",
  lineItems: [],
  hoursEntryIds: [],
  status: "paid",
  sentDate: "2026-07-03",
  paidDate: "2026-07-10",
} as any;

const hoursEntry = {
  ...base,
  id: "h1",
  projectId: null,
  date: "2026-07-01",
  startTime: "09:00",
  endTime: "11:30",
  breakMinutes: 30,
  totalHours: 2,
  hourlyRate: 100,
  billable: true,
  location: "",
  relatedWorkLogId: null,
  notes: "",
  source: "manual",
} as any;

describe("invoice dashboard summaries", () => {
  it("summarizes status, revenue, outstanding, payment time, and hours", () => {
    const sentInvoice = {
      ...paidInvoice,
      id: "i2",
      invoiceNumber: "2",
      periodStart: "2026-01-01",
      periodEnd: "2026-01-02",
      totalHours: 1,
      totalAmount: 100,
      status: "sent",
      sentDate: null,
      paidDate: null,
    };

    expect(summarizeInvoiceDashboard([paidInvoice, sentInvoice], [hoursEntry], "2026-07-13"))
      .toMatchObject({
        byStatus: { draft: 0, sent: 1, paid: 1, void: 0 },
        revenueThisMonth: 200,
        revenueYtd: 200,
        outstandingInvoices: 1,
        outstandingBalance: 100,
        averagePaymentTimeDays: 7,
        totalBillableHours: 2,
      });
  });

  it("builds client billing history", () => {
    expect(buildClientBillingHistory([client], [paidInvoice], [], [])[0]).toMatchObject({
      clientName: "AFP",
      totalRevenue: 200,
      lastInvoiceDate: "2026-07-02",
    });
  });

  it("filters one malformed native record instead of crashing the dashboard", () => {
    const malformedHours = { ...hoursEntry, id: "bad-hours", startTime: undefined } as any;
    const malformedInvoice = { ...paidInvoice, id: "bad-invoice", periodEnd: null } as any;

    const result = buildInvoiceDashboardData(
      [client],
      [paidInvoice, malformedInvoice],
      [hoursEntry, malformedHours],
      [],
      "2026-07-13",
    );

    expect(result.skipped).toMatchObject({ invoices: 1, hours: 1 });
    expect(result.data.summary.revenueThisMonth).toBe(200);
    expect(result.data.summary.byStatus.paid).toBe(1);
    expect(result.data.clients[0].hoursBilled).toBe(2);
  });
});
