import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api-client/http";
import { DEFAULT_HOURS_SAVE_ERROR, hoursSaveErrorMessage } from "./save-error";

describe("hoursSaveErrorMessage", () => {
  it("surfaces the server-provided API error message", () => {
    const error = new ApiError(400, JSON.stringify({ error: "No workspace/client configured." }));
    expect(hoursSaveErrorMessage(error)).toBe("No workspace/client configured.");
  });

  it("surfaces a plain API error response", () => {
    expect(hoursSaveErrorMessage(new ApiError(502, "Notion request failed."))).toBe("Notion request failed.");
  });

  it("uses the generic fallback for unexpected errors", () => {
    expect(hoursSaveErrorMessage(new Error("internal detail"))).toBe(DEFAULT_HOURS_SAVE_ERROR);
  });
});
