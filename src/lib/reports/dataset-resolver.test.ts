import { describe, expect, it } from "vitest";
import { resolveReportDataset } from "./dataset-resolver";
import { buildJuly810ReportDataset } from "@/lib/notion/relation-backfill/july8-10-dataset";
import type { ReportDataset } from "./types";

function historicalFixture(): ReportDataset {
  return {
    source: "historical-preview",
    label: "Historical preview data",
    description: "Approved read-only July 8-9, 2026 AFP preview; no import is required.",
    clients: [{ id: "historical-anytime-fuel-pros", name: "Anytime Fuel Pros", defaultHourlyRate: 30 }],
    projects: [],
    hours: [
      { id: "historical-hours-1", clientId: "historical-anytime-fuel-pros", projectId: null, date: "2026-07-08", startTime: "09:00", endTime: "11:00", breakMinutes: 0, hourlyRate: 30, billable: true, relatedWorkLogId: null },
    ],
    workRecords: [],
    knowledgeRecords: [],
  };
}

function localMockFixture(): ReportDataset {
  return {
    source: "local-mock",
    label: "Local mock data",
    description: "SQLite development records.",
    clients: [{ id: "mock-client", name: "Mock Client", defaultHourlyRate: 50 }],
    projects: [],
    hours: [],
    workRecords: [],
    knowledgeRecords: [],
  };
}

describe("resolveReportDataset", () => {
  it("Historical Preview selects the historical dataset", () => {
    const historical = historicalFixture();
    const july810 = buildJuly810ReportDataset();
    const datasets = [historical, july810];

    const resolved = resolveReportDataset(datasets, "historical-preview", "local-mock");

    expect(resolved).toBe(historical);
    expect(resolved.clients[0]?.id).toBe("historical-anytime-fuel-pros");
  });

  it("July 8-10 Corrected selects the corrected dataset", () => {
    const historical = historicalFixture();
    const july810 = buildJuly810ReportDataset();
    const datasets = [historical, july810];

    const resolved = resolveReportDataset(datasets, "july-8-10-corrected", "local-mock");

    expect(resolved).toBe(july810);
    expect(resolved.label).toBe("July 8–10 corrected dataset");
  });

  it("switching between the two datasets does not reuse the wrong records", () => {
    const historical = historicalFixture();
    const july810 = buildJuly810ReportDataset();
    const datasets = [historical, july810];

    const first = resolveReportDataset(datasets, "historical-preview", "local-mock");
    const second = resolveReportDataset(datasets, "july-8-10-corrected", "local-mock");

    expect(first).not.toBe(second);
    expect(first.clients[0]?.id).not.toBe(second.clients[0]?.id);
    expect(first.hours.map((h) => h.id)).not.toEqual(second.hours.map((h) => h.id));
  });

  it("restores the correct dataset from a saved/serialized identifier", () => {
    const historical = historicalFixture();
    const july810 = buildJuly810ReportDataset();
    const localMock = localMockFixture();
    const datasets = [localMock, historical, july810];

    // Simulate round-tripping a persisted selection (e.g. browser storage or
    // a URL param) through serialization before it's used to restore state.
    const restoredHistorical = JSON.parse(JSON.stringify({ source: "historical-preview" })).source;
    const restoredJuly810 = JSON.parse(JSON.stringify({ source: "july-8-10-corrected" })).source;

    expect(resolveReportDataset(datasets, restoredHistorical, "local-mock")).toBe(historical);
    expect(resolveReportDataset(datasets, restoredJuly810, "local-mock")).toBe(july810);
  });

  it("falls back to the recommended dataset for an unknown or legacy source value instead of silently picking the wrong one", () => {
    const historical = historicalFixture();
    const july810 = buildJuly810ReportDataset();
    const localMock = localMockFixture();
    // Recommended is deliberately NOT first in the array, so a naive
    // "just return datasets[0]" implementation would fail this assertion.
    const datasets = [historical, july810, localMock];

    const resolved = resolveReportDataset(datasets, "some-legacy-value-nobody-recognizes", "local-mock");

    expect(resolved).toBe(localMock);
  });

  it("falls back to the first dataset when even the recommended source is unavailable, without throwing", () => {
    const historical = historicalFixture();
    const july810 = buildJuly810ReportDataset();
    const datasets = [historical, july810];

    const resolved = resolveReportDataset(datasets, "totally-unknown", "notion");

    expect(resolved).toBe(historical);
  });

  it("throws a clear error instead of returning undefined when no datasets are available", () => {
    expect(() => resolveReportDataset([], "local-mock", "local-mock")).toThrow(/no report datasets/i);
  });
});
