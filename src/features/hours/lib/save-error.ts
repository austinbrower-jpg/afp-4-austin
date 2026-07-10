import { ApiError } from "@/lib/api-client/http";

export const DEFAULT_HOURS_SAVE_ERROR = "Failed to save hours entry";

export function hoursSaveErrorMessage(
  error: unknown,
  fallback = DEFAULT_HOURS_SAVE_ERROR,
): string {
  if (!(error instanceof ApiError)) return fallback;

  try {
    const payload = JSON.parse(error.message) as { error?: unknown };
    if (typeof payload.error === "string" && payload.error.trim()) {
      return payload.error;
    }
  } catch {
    const message = error.message.trim();
    if (message) return message;
  }

  return fallback;
}
