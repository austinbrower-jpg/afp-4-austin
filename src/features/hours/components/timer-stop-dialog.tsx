"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCreateHoursEntry } from "../hooks/use-hours";
import { HoursEntryFormFields, type ProjectOption, type WorkLogOption } from "./hours-entry-form-fields";
import type { HoursEntryInput } from "../lib/types";
import type { TimerStopResult } from "../lib/timer-store";
import { useHoursTimerStore } from "../lib/timer-store";
import type { AppDataSourceMode } from "@/lib/data/runtime-config";
import { hoursSaveErrorMessage } from "../lib/save-error";

/**
 * Shown after Stop is pressed in timer mode. Date/start/end are locked to
 * what the timer captured; project, billable, and notes stay editable
 * before the shift is persisted with source: "timer".
 */
export function TimerStopDialog({
  open,
  onOpenChange,
  capture,
  defaultHourlyRate,
  projects,
  workLogs,
  dataSourceMode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  capture: TimerStopResult | null;
  defaultHourlyRate: number;
  projects: ProjectOption[];
  workLogs: WorkLogOption[];
  dataSourceMode: AppDataSourceMode;
}) {
  const [values, setValues] = useState<HoursEntryInput | null>(null);
  // Populate the form exactly when the dialog transitions from closed to
  // open (rather than in an effect), so it starts fresh each time Stop
  // captures a new shift without an extra render pass.
  const [wasOpen, setWasOpen] = useState(open);
  if (open && capture && !wasOpen) {
    setWasOpen(true);
    setValues({
      date: capture.date,
      startTime: capture.startTime,
      endTime: capture.endTime,
      breakMinutes: 0,
      hourlyRate: defaultHourlyRate,
      billable: true,
      location: "",
      projectId: null,
      relatedWorkLogId: null,
      notes: "",
      source: "timer",
    });
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  const createMutation = useCreateHoursEntry();
  const resetTimerDraft = useHoursTimerStore((state) => state.reset);

  function patch(update: Partial<HoursEntryInput>) {
    setValues((prev) => (prev ? { ...prev, ...update } : prev));
  }

  async function handleSave() {
    if (!values) return;
    try {
      await createMutation.mutateAsync({ ...values, source: "timer" });
      toast.success(dataSourceMode === "notion" ? "Saved to Notion" : "Timer entry saved");
      resetTimerDraft();
      onOpenChange(false);
    } catch (error) {
      toast.error(hoursSaveErrorMessage(error, "Failed to save timer entry"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Confirm Timer Entry</DialogTitle>
          <DialogDescription>
            {capture
              ? `Logged ${capture.date} · ${capture.startTime}–${capture.endTime}. Fill in the details before saving.`
              : "Fill in the draft details before saving."}
          </DialogDescription>
        </DialogHeader>

        {values && (
          <HoursEntryFormFields
            values={values}
            onChange={patch}
            projects={projects}
            workLogs={workLogs}
            lockTiming
          />
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={createMutation.isPending}>
            Keep Draft
          </Button>
          <Button onClick={handleSave} disabled={createMutation.isPending || !values}>
            {createMutation.isPending ? "Saving…" : dataSourceMode === "notion" ? "Save to Notion" : "Save Entry"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
