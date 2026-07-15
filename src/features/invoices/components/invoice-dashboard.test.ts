import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { InvoiceDashboardError, InvoiceDashboardView } from "./invoice-dashboard";

describe("InvoiceDashboard views", () => {
  it("renders valid native dashboard data", () => {
    const html = renderToStaticMarkup(createElement(InvoiceDashboardView, {
      data: {
        summary: {
          byStatus: { draft: 1, sent: 2, paid: 3, void: 0 },
          revenueThisMonth: 200,
          revenueYtd: 500,
          outstandingInvoices: 3,
          outstandingBalance: 100,
          averagePaymentTimeDays: 7,
          totalBillableHours: 12.5,
        },
        clients: [],
      },
    }));

    expect(html).toContain("Invoice Dashboard");
    expect(html).toContain("Revenue this month");
    expect(html).toContain("$200.00");
    expect(html).toContain("12.5");
  });

  it("renders a safe retry state after source failure", () => {
    const html = renderToStaticMarkup(createElement(InvoiceDashboardError, {
      retry: vi.fn(),
      isRetrying: false,
    }));

    expect(html).toContain("Invoice Dashboard could not be loaded");
    expect(html).toContain("Try again");
    expect(html).not.toContain("private");
  });
});
