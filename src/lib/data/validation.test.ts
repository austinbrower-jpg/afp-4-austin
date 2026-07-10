import { describe, expect, it } from "vitest";
import { hoursInputSchema, workLogInputSchema } from "./validation";

describe("controlled write validation", () => {
  it("accepts a valid exact-time hours draft", () => {
    const result = hoursInputSchema.safeParse({
      date: "2026-07-10", startTime: "09:12", endTime: "14:00", breakMinutes: 0,
      hourlyRate: 30, billable: true, location: "Remote", projectId: "project-page",
      relatedWorkLogId: null, notes: "Verified batch routing", source: "timer",
    });
    expect(result.success).toBe(true);
  });

  it("rejects malformed time and negative rates before Notion is called", () => {
    const result = hoursInputSchema.safeParse({ date: "7/10/26", startTime: "9am", endTime: "5pm", hourlyRate: -1, billable: true });
    expect(result.success).toBe(false);
  });

  it("validates Work Done privacy fields and safe defaults", () => {
    const result = workLogInputSchema.parse({ projectId: null, title: "Completed verification", date: "2026-07-10" });
    expect(result.clientVisible).toBe(false);
    expect(result.includeInInvoice).toBe(false);
    expect(result.internalNotes).toBe("");
  });

  it("rejects a Work Done entry without a title", () => {
    expect(workLogInputSchema.safeParse({ projectId: null, title: "", date: "2026-07-10" }).success).toBe(false);
  });
});
