import { describe, expect, it } from "vitest";
import { getReportBuilderLoadState } from "./load-state";

describe("Report Builder load state", () => {
  it("exits loading after both requests succeed and state initializes", () => {
    expect(getReportBuilderLoadState({
      builderHasData: true,
      settingsHaveData: true,
      hasError: false,
    })).toBe("ready");
  });

  it("exits loading into an error state after a failed request", () => {
    expect(getReportBuilderLoadState({
      builderHasData: false,
      settingsHaveData: true,
      hasError: true,
    })).toBe("error");
  });

  it("stays loading only while required successful data is incomplete", () => {
    expect(getReportBuilderLoadState({
      builderHasData: true,
      settingsHaveData: false,
      hasError: false,
    })).toBe("loading");
  });
});
