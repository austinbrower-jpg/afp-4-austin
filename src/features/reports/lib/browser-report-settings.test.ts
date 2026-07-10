import { describe, expect, it } from "vitest";
import { DEFAULT_REPORT_SETTINGS } from "@/lib/reports/types";
import {
  BROWSER_REPORT_SETTINGS_KEY,
  parseBrowserReportSettings,
  readBrowserReportSettings,
  writeBrowserReportSettings,
} from "./browser-report-settings";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe("browser-local report settings", () => {
  it("saves and reloads report settings without any client dependency", () => {
    const storage = memoryStorage();
    const settings = {
      ...DEFAULT_REPORT_SETTINGS,
      contractorName: "Austin Brower",
      clientDisplayName: "AFP",
      defaultHourlyRate: 30,
    };

    writeBrowserReportSettings(storage, settings);

    expect(storage.getItem(BROWSER_REPORT_SETTINGS_KEY)).toBeTruthy();
    expect(readBrowserReportSettings(storage, DEFAULT_REPORT_SETTINGS)).toEqual(settings);
  });

  it("uses deployment defaults when no browser override exists", () => {
    expect(readBrowserReportSettings(memoryStorage(), DEFAULT_REPORT_SETTINGS))
      .toBe(DEFAULT_REPORT_SETTINGS);
  });

  it("falls back safely when stored data is invalid", () => {
    expect(parseBrowserReportSettings('{"defaultHourlyRate":-1}', DEFAULT_REPORT_SETTINGS))
      .toBe(DEFAULT_REPORT_SETTINGS);
    expect(parseBrowserReportSettings("not-json", DEFAULT_REPORT_SETTINGS))
      .toBe(DEFAULT_REPORT_SETTINGS);
  });
});
