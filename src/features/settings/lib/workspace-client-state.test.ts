import { describe, expect, it } from "vitest";
import type { SettingsResponse } from "@/types/api";
import type { Client, Workspace } from "@/types/domain";
import { workspaceClientViewState } from "./workspace-client-state";

const workspace = { name: "AFP Notion Workspace" } as Workspace;
const client = { id: "client-page", name: "Anytime Fuel Pros" } as Client;

describe("workspaceClientViewState", () => {
  it("represents the request loading state", () => {
    expect(workspaceClientViewState({ data: undefined, isLoading: true, error: null }))
      .toEqual({ status: "loading" });
  });

  it("resolves loading to a no-client state after an empty Notion response", () => {
    const data: SettingsResponse = { workspace, client: null };
    expect(workspaceClientViewState({ data, isLoading: false, error: null }))
      .toEqual({ status: "empty", workspaceName: "AFP Notion Workspace" });
  });

  it("resolves to a configured client state", () => {
    const data: SettingsResponse = { workspace, client };
    expect(workspaceClientViewState({ data, isLoading: false, error: null }))
      .toEqual({ status: "configured", workspaceName: "AFP Notion Workspace", client });
  });

  it("resolves to an explicit server error", () => {
    const error = new Error('{"error":"Notion read (client) failed: rate limited"}');
    expect(workspaceClientViewState({ data: undefined, isLoading: false, error }))
      .toEqual({ status: "error", message: "Notion read (client) failed: rate limited" });
  });
});
