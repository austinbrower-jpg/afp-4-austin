export type ReportBuilderLoadState = "loading" | "error" | "ready";

export function getReportBuilderLoadState(input: {
  builderHasData: boolean;
  settingsHaveData: boolean;
  hasError: boolean;
}): ReportBuilderLoadState {
  if (input.hasError) return "error";
  if (!input.builderHasData || !input.settingsHaveData) return "loading";
  return "ready";
}
