import type { SettingsResponse } from "@/types/api";
import type { Client } from "@/types/domain";

export type WorkspaceClientViewState =
  | { status: "loading" }
  | { status: "empty"; workspaceName: string }
  | { status: "configured"; workspaceName: string; client: Client }
  | { status: "error"; message: string };

function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "Unable to load workspace configuration.";
  try {
    const parsed = JSON.parse(error.message) as { error?: unknown };
    if (typeof parsed.error === "string" && parsed.error.trim()) return parsed.error;
  } catch {
    // Plain Error messages are already suitable for display.
  }
  return error.message || "Unable to load workspace configuration.";
}

export function workspaceClientViewState(input: {
  data: SettingsResponse | undefined;
  isLoading: boolean;
  error: unknown;
}): WorkspaceClientViewState {
  if (input.isLoading) return { status: "loading" };
  if (input.error) return { status: "error", message: errorMessage(input.error) };
  if (!input.data) {
    return { status: "error", message: "Workspace configuration returned no data." };
  }

  const workspaceName = input.data.workspace?.name ?? "Workspace";
  if (!input.data.client) return { status: "empty", workspaceName };
  return { status: "configured", workspaceName, client: input.data.client };
}
