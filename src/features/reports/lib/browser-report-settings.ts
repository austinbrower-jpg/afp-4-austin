"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { ReportSettings } from "@/lib/reports/types";

export const BROWSER_REPORT_SETTINGS_KEY = "afp-workspace:report-settings:v1";
const CHANGE_EVENT = "afp-workspace:report-settings-change";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const STRING_FIELDS: Array<Exclude<keyof ReportSettings, "defaultHourlyRate">> = [
  "contractorName",
  "businessName",
  "email",
  "phone",
  "address",
  "defaultPaymentTerms",
  "defaultInvoiceNotes",
  "logoPath",
  "clientDisplayName",
  "clientBillingContact",
  "clientBillingEmail",
];

export function parseBrowserReportSettings(
  raw: string | null,
  fallback: ReportSettings,
): ReportSettings {
  if (!raw) return fallback;
  try {
    const value = JSON.parse(raw) as Partial<ReportSettings>;
    const merged = { ...fallback, ...value };
    if (
      !STRING_FIELDS.every((field) => typeof merged[field] === "string") ||
      !Number.isFinite(Number(merged.defaultHourlyRate)) ||
      Number(merged.defaultHourlyRate) < 0
    ) {
      return fallback;
    }
    return { ...merged, defaultHourlyRate: Number(merged.defaultHourlyRate) };
  } catch {
    return fallback;
  }
}

export function readBrowserReportSettings(
  storage: Pick<StorageLike, "getItem">,
  fallback: ReportSettings,
): ReportSettings {
  try {
    return parseBrowserReportSettings(storage.getItem(BROWSER_REPORT_SETTINGS_KEY), fallback);
  } catch {
    return fallback;
  }
}

export function writeBrowserReportSettings(
  storage: Pick<StorageLike, "setItem">,
  settings: ReportSettings,
): void {
  storage.setItem(BROWSER_REPORT_SETTINGS_KEY, JSON.stringify(settings));
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
  };
}

function noSubscription() {
  return () => undefined;
}

function browserSnapshot(): string {
  try {
    return window.localStorage.getItem(BROWSER_REPORT_SETTINGS_KEY) ?? "";
  } catch {
    return "";
  }
}

function emptySnapshot(): string {
  return "";
}

export function saveBrowserReportSettings(settings: ReportSettings): ReportSettings {
  writeBrowserReportSettings(window.localStorage, settings);
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return settings;
}

export function useBrowserReportSettings(
  fallback: ReportSettings,
  enabled: boolean,
): ReportSettings {
  const raw = useSyncExternalStore(
    enabled ? subscribe : noSubscription,
    enabled ? browserSnapshot : emptySnapshot,
    emptySnapshot,
  );
  return useMemo(
    () => (enabled ? parseBrowserReportSettings(raw, fallback) : fallback),
    [enabled, fallback, raw],
  );
}
