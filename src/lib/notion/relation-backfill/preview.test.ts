import { describe, expect, it } from "vitest";
import { buildRelationBackfillPreview, isImmutablePreview } from "./preview";
import { validateSchemaProposal } from "../relational-schema-proposal";
import { composeSimpleInvoice } from "@/lib/reports/engine";
import { DEFAULT_REPORT_SETTINGS } from "@/lib/reports/types";
import { buildJuly810ReportDataset } from "./july8-10-dataset";
import { JULY8_10_OPERATIONAL_TOTALS } from "./july8-10-source";

describe("relation backfill preview", () => {
  it("produces immutable previews with no writes", () => {
    const a = buildRelationBackfillPreview();
    const b = buildRelationBackfillPreview();
    expect(a.writesPerformed).toBe(false);
    expect(a.readOnly).toBe(true);
    expect(isImmutablePreview(a, b)).toBe(true);
  });

  it("matches corrected July 8–10 operational totals", () => {
    const preview = buildRelationBackfillPreview();
    expect(preview.totals.billableMinutes).toBe(JULY8_10_OPERATIONAL_TOTALS.billableMinutes);
    expect(preview.totals.nonBillableMinutes).toBe(JULY8_10_OPERATIONAL_TOTALS.nonBillableMinutes);
    expect(preview.totals.amount).toBe(JULY8_10_OPERATIONAL_TOTALS.amount);
    expect(preview.totals.matchesExpected).toBe(true);
  });

  it("includes quarantine row in preview but not operational totals", () => {
    const preview = buildRelationBackfillPreview();
    expect(preview.quarantineRows.length).toBe(1);
    expect(preview.quarantineRows[0].label).toContain("17:10");
    expect(preview.diagnostics[0]).toContain("Superseded historical record");
  });

  it("validates additive schema proposal", () => {
    expect(validateSchemaProposal().valid).toBe(true);
  });
});

describe("July 8–10 report dataset totals", () => {
  it("preserves 987 billable minutes, 120 non-billable minutes, and $493.50", () => {
    const july810 = buildJuly810ReportDataset();
    const report = composeSimpleInvoice(july810, DEFAULT_REPORT_SETTINGS, {
      clientId: july810.clients[0].id,
      periodStart: "2026-07-08",
      periodEnd: "2026-07-10",
      projectIds: [],
      invoiceNumber: "AFP-2026-010",
      invoiceDate: "2026-07-11",
      paymentTerms: "Net 15",
      dueDate: "2026-07-26",
      customTitle: "",
      notes: "",
      executiveSummary: "",
      draftDescriptions: {},
    });
    expect(report.totals.billableMinutes).toBe(987);
    expect(report.totals.nonBillableMinutes).toBe(0);
    expect(report.totals.amountDue).toBe(493.5);
    const nonBillableExcluded = report.excludedRecords.filter((r) => r.reason.includes("Non-billable"));
    expect(nonBillableExcluded.some((r) => r.title.includes("09:00"))).toBe(true);
    const supersededExcluded = report.excludedRecords.filter((r) => r.matchSource === "Superseded");
    expect(supersededExcluded.length).toBe(1);
  });
});
