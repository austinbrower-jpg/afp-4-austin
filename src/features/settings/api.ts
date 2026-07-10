import { apiFetch, apiPatch } from "@/lib/api-client/http";
import type { SettingsResponse, UpdateClientSettingsInput } from "@/types/api";
import type { Client } from "@/types/domain";

export type { SettingsResponse, UpdateClientSettingsInput };

export const settingsApi = {
  get: () => apiFetch<SettingsResponse>("/api/settings", {
    signal: AbortSignal.timeout(15_000),
  }),
  updateClient: (patch: UpdateClientSettingsInput) =>
    apiPatch<Client>("/api/settings", patch),
};
