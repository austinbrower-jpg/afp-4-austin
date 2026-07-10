"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { settingsApi, type UpdateClientSettingsInput } from "../api";

export const settingsQueryKey = ["settings"] as const;

export function useSettings() {
  return useQuery({
    queryKey: settingsQueryKey,
    queryFn: settingsApi.get,
    retry: false,
  });
}

export function useUpdateClientSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateClientSettingsInput) => settingsApi.updateClient(patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsQueryKey });
      toast.success("Settings saved");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save settings");
    },
  });
}
