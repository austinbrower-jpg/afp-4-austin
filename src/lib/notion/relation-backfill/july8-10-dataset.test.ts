import { describe, expect, it } from "vitest";
import { buildJuly810ReportDataset } from "./july8-10-dataset";

describe("buildJuly810ReportDataset source identifier", () => {
  it("uses a dedicated source identifier, not the shared historical-preview value", () => {
    const dataset = buildJuly810ReportDataset();
    expect(dataset.source).toBe("july-8-10-corrected");
    expect(dataset.source).not.toBe("historical-preview");
  });

  it("keeps its own client/hours data distinct from the historical preview dataset", () => {
    const dataset = buildJuly810ReportDataset();
    // Regression guard for the original bug: the July 8-10 dataset must not
    // be mistaken for (or resolve to) the separate "historical-preview"
    // dataset built in src/lib/reports/data-source.ts.
    expect(dataset.clients[0]?.id).not.toBe("historical-anytime-fuel-pros");
    expect(dataset.label).toBe("July 8–10 corrected dataset");
  });
});
