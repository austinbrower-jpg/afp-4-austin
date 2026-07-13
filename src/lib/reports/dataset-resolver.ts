import type { ReportDataset, ReportDataSource } from "./types";

/**
 * Resolves a requested data-source identifier against the available report
 * datasets. Falls back to the recommended dataset when the requested value
 * doesn't match any available dataset - e.g. an unknown or legacy value
 * restored from stale browser state - so a bad identifier never silently
 * resolves to whichever dataset happens to be first in the array (the bug
 * that occurred when two datasets shared the "historical-preview" source).
 *
 * Pure and free of "server-only" imports so it can run in both the
 * "use client" Report Builder and in tests.
 */
export function resolveReportDataset(
  datasets: readonly ReportDataset[],
  requestedSource: string,
  recommendedSource: ReportDataSource,
): ReportDataset {
  const requested = datasets.find((dataset) => dataset.source === requestedSource);
  if (requested) return requested;

  const fallback = datasets.find((dataset) => dataset.source === recommendedSource);
  if (fallback) return fallback;

  if (datasets.length === 0) {
    throw new Error("No report datasets are available to resolve.");
  }
  return datasets[0];
}
