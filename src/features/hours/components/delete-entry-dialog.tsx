"use client";

import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDeleteHoursEntry } from "../hooks/use-hours";
import type { HoursEntryWithRelations } from "../lib/types";

export function DeleteEntryDialog({
  entry,
  onOpenChange,
}: {
  entry: HoursEntryWithRelations | null;
  onOpenChange: (open: boolean) => void;
}) {
  const deleteMutation = useDeleteHoursEntry();

  async function handleDelete() {
    if (!entry) return;
    try {
      await deleteMutation.mutateAsync(entry.id);
      toast.success("Hours entry deleted");
      onOpenChange(false);
    } catch {
      toast.error("Failed to delete hours entry");
    }
  }

  return (
    <AlertDialog open={Boolean(entry)} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete hours entry?</AlertDialogTitle>
          <AlertDialogDescription>
            {entry
              ? `This removes the ${entry.date} entry (${entry.startTime}–${entry.endTime}) permanently. This can't be undone.`
              : "This can't be undone."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
