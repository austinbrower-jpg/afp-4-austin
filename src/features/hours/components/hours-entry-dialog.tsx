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
import { todayISO } from "@/lib/calculations";
import { useCreateHoursEntry, useUpdateHoursEntry } from "../hooks/use-hours";
import { HoursEntryFormFields, type ProjectOption, type WorkLogOption } from "./hours-entry-form-fields";
import type { HoursEntryInput } from "../lib/types";
import type { HoursEntryWithRelations } from "../lib/types";
import type { AppDataSourceMode } from "@/lib/data/runtime-config";
import { hoursSaveErrorMessage } from "../lib/save-error";

function blankValues(defaultHourlyRate: number): HoursEntryInput {
  return {
    date: todayISO(),
    startTime: "09:00",
    endTime: "17:00",
    breakMinutes: 0,
    hourlyRate: defaultHourlyRate,
    billable: true,
    location: "",
    projectId: null,
    relatedWorkLogId: null,
    notes: "",
    source: "manual",
  };
}

function valuesFromEntry(entry: HoursEntryWithRelations): HoursEntryInput {
  return {
    date: entry.date,
    startTime: entry.startTime,
    endTime: entry.endTime,
    breakMinutes: entry.breakMinutes,
    hourlyRate: entry.hourlyRate,
    billable: entry.billable,
    location: entry.location,
    projectId: entry.projectId,
    relatedWorkLogId: entry.relatedWorkLogId,
    notes: entry.notes,
    source: entry.source,
  };
}

export function HoursEntryDialog({
  open,
  onOpenChange,
  entry,
  defaultHourlyRate,
  projects,
  workLogs,
  dataSourceMode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the dialog edits this entry; otherwise it creates a new manual entry. */
  entry?: HoursEntryWithRelations | null;
  defaultHourlyRate: number;
  projects: ProjectOption[];
  workLogs: WorkLogOption[];
  dataSourceMode: AppDataSourceMode;
}) {
  const [values, setValues] = useState<HoursEntryInput>(() =>
    entry ? valuesFromEntry(entry) : blankValues(defaultHourlyRate),
  );
  // Reset the form exactly when the dialog transitions from closed to open,
  // rather than in an effect - avoids an extra render and, unlike the effect
  // version, won't clobber in-progress edits if `entry` changes reference
  // from a background refetch while the dialog stays open.
  const [wasOpen, setWasOpen] = useState(open);
  if (open && !wasOpen) {
    setWasOpen(true);
    setValues(entry ? valuesFromEntry(entry) : blankValues(defaultHourlyRate));
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  const createMutation = useCreateHoursEntry();
  const updateMutation = useUpdateHoursEntry();
  const isEdit = Boolean(entry);
  const isSaving = createMutation.isPending || updateMutation.isPending;

  function patch(update: Partial<HoursEntryInput>) {
    setValues((prev) => ({ ...prev, ...update }));
  }

  async function handleSave() {
    try {
      if (isEdit && entry) {
        await updateMutation.mutateAsync({ id: entry.id, input: values });
        toast.success(dataSourceMode === "notion" ? "Saved to Notion" : "Hours entry updated");
      } else {
        await createMutation.mutateAsync({ ...values, source: "manual" });
        toast.success(dataSourceMode === "notion" ? "Saved to Notion" : "Hours entry added");
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(hoursSaveErrorMessage(error));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Hours Entry" : "Add Hours Entry"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the details of this time entry."
              : dataSourceMode === "notion" ? "This remains a draft until you explicitly save it to Notion." : "Manually log a block of time worked."}
          </DialogDescription>
        </DialogHeader>

        <HoursEntryFormFields
          values={values}
          onChange={patch}
          projects={projects}
          workLogs={workLogs}
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving…" : dataSourceMode === "notion" ? "Save to Notion" : isEdit ? "Save Changes" : "Add Entry"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
