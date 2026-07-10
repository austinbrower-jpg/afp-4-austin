import { apiGet, apiPatch } from "@/lib/api-client/http";
import type { SettingsResponse, UpdateClientSettingsInput } from "@/types/api";
import type { Client } from "@/types/domain";

export type { SettingsResponse, UpdateClientSettingsInput };

export const settingsApi = {
  get: () => apiGet<SettingsResponse>("/api/settings"),
  updateClient: (patch: UpdateClientSettingsInput) =>
    apiPatch<Client>("/api/settings", patch),
};
