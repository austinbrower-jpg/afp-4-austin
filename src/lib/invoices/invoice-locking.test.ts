import { describe, expect, it } from "vitest";
import {
  buildInvoiceLockPlan,
  isIdempotentRetry,
  stripInternalNotes,
} from "./invoice-locking";

describe("invoice locking design", () => {
  const hours = [
    { id: "h1", billable: true, billingStatus: "ready-to-invoice", migrationKey: null, invoiceReportId: null },
    { id: "h2", billable: true, billingStatus: "invoiced", migrationKey: null, invoiceReportId: "inv-1" },
    { id: "h3", billable: true, billingStatus: null, migrationKey: "afp-history-v2-superseded-x", invoiceReportId: null },
    { id: "h4", billable: true, billingStatus: "ready-to-invoice", migrationKey: null, invoiceReportId: "inv-2" },
  ];
  const work = [
    { id: "w1", clientVisible: true, includeInInvoice: true, approvalStatus: "approved", internalNotes: "secret" },
    { id: "w2", clientVisible: false, includeInInvoice: true, approvalStatus: "approved" },
  ];
  const invoices = [
    { id: "inv-1", status: "sent", clientId: "c1", includedHoursIds: ["h2"], includedWorkDoneIds: [] },
    { id: "inv-2", status: "draft", clientId: "c1", includedHoursIds: ["h4"], includedWorkDoneIds: [] },
  ];

  it("refuses superseded and already-invoiced hours", () => {
    const plan = buildInvoiceLockPlan({
      invoiceId: "inv-new",
      clientId: "c1",
      candidates: [
        { hoursId: "h1", workIds: ["w1"] },
        { hoursId: "h2", workIds: ["w1"] },
        { hoursId: "h3", workIds: ["w1"] },
      ],
      hours,
      workRecords: work,
      existingInvoices: invoices,
    });
    expect(plan.hoursToMarkInvoiced).toEqual(["h1"]);
    expect(plan.failures.some((f) => f.code === "already-invoiced")).toBe(true);
    expect(plan.failures.some((f) => f.code === "superseded")).toBe(true);
  });

  it("refuses hours tied to another non-cancelled invoice", () => {
    const plan = buildInvoiceLockPlan({
      invoiceId: "inv-new",
      clientId: "c1",
      candidates: [{ hoursId: "h4", workIds: ["w1"] }],
      hours,
      workRecords: work,
      existingInvoices: invoices,
    });
    expect(plan.failures.some((f) => f.code === "tied-to-other-invoice")).toBe(true);
  });

  it("reports partial failure when some candidates succeed", () => {
    const extraHours = [
      ...hours,
      { id: "h5", billable: true, billingStatus: "ready-to-invoice", migrationKey: null, invoiceReportId: null },
    ];
    const plan = buildInvoiceLockPlan({
      invoiceId: "inv-new",
      clientId: "c1",
      candidates: [
        { hoursId: "h1", workIds: ["w1"] },
        { hoursId: "h5", workIds: ["w2"] },
      ],
      hours: extraHours,
      workRecords: work,
      existingInvoices: invoices,
    });
    expect(plan.hoursToMarkInvoiced).toEqual(["h1"]);
    expect(plan.failures.some((f) => f.code === "work-not-visible")).toBe(true);
    expect(plan.partialFailure).toBe(true);
  });

  it("is idempotent on retry", () => {
    const input = {
      invoiceId: "inv-new",
      clientId: "c1",
      candidates: [{ hoursId: "h1", workIds: ["w1"] }],
      hours,
      workRecords: work,
      existingInvoices: invoices,
    };
    const first = buildInvoiceLockPlan(input);
    const second = buildInvoiceLockPlan(input);
    expect(isIdempotentRetry(first, second)).toBe(true);
  });

  it("strips internal notes from export payloads", () => {
    expect(stripInternalNotes({ id: "w1", internalNotes: "secret", title: "x" })).toEqual({ id: "w1", title: "x" });
  });
});
