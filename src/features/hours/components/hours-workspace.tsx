"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHoursEntries, useHoursStats } from "../hooks/use-hours";
import type { HoursRangeKey } from "../lib/ranges";
import type { TimerStopResult } from "../lib/timer-store";
import type { HoursEntryWithRelations } from "../lib/types";
import { HoursSummaryBar } from "./hours-summary-bar";
import { HoursRangeControl } from "./hours-range-control";
import { HoursTimerCard } from "./hours-timer-card";
import { HoursTable } from "./hours-table";
import { HoursEntryDialog } from "./hours-entry-dialog";
import { TimerStopDialog } from "./timer-stop-dialog";
import { DeleteEntryDialog } from "./delete-entry-dialog";
import type { ProjectOption, WorkLogOption } from "./hours-entry-form-fields";
import type { AppDataSourceMode } from "@/lib/data/runtime-config";

export function HoursWorkspace({
  projects,
  workLogs,
  defaultHourlyRate,
  dataSourceMode,
}: {
  projects: ProjectOption[];
  workLogs: WorkLogOption[];
  defaultHourlyRate: number;
  dataSourceMode: AppDataSourceMode;
}) {
  const [range, setRange] = useState<HoursRangeKey>("this-week");

  const { data: entries, isLoading } = useHoursEntries(range);
  const { data: allEntries, isLoading: isStatsLoading } = useHoursStats();

  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<HoursEntryWithRelations | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HoursEntryWithRelations | null>(null);

  const [timerCapture, setTimerCapture] = useState<TimerStopResult | null>(null);
  const [timerDialogOpen, setTimerDialogOpen] = useState(false);

  function openCreateDialog() {
    setEditingEntry(null);
    setEntryDialogOpen(true);
  }

  function openEditDialog(entry: HoursEntryWithRelations) {
    setEditingEntry(entry);
    setEntryDialogOpen(true);
  }

  function handleTimerStopped(capture: TimerStopResult) {
    setTimerCapture(capture);
    setTimerDialogOpen(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Hours Worked</h1>
        <p className="text-muted-foreground">
          Track billable time with a live timer or manual entries. Weekly/monthly totals and the
          invoice estimate always reflect the full log, independent of the table filter below.
        </p>
      </div>

      <HoursSummaryBar entries={allEntries ?? []} isLoading={isStatsLoading} />

      <HoursTimerCard onStopped={handleTimerStopped} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <HoursRangeControl value={range} onChange={setRange} />
        <Button size="sm" onClick={openCreateDialog}>
          <Plus className="size-3.5" />
          Add Entry
        </Button>
      </div>

      <HoursTable
        entries={entries ?? []}
        isLoading={isLoading}
        onEdit={openEditDialog}
        onDelete={setDeleteTarget}
        allowDelete={dataSourceMode === "mock"}
      />

      <HoursEntryDialog
        open={entryDialogOpen}
        onOpenChange={setEntryDialogOpen}
        entry={editingEntry}
        defaultHourlyRate={defaultHourlyRate}
        projects={projects}
        workLogs={workLogs}
        dataSourceMode={dataSourceMode}
      />

      <TimerStopDialog
        open={timerDialogOpen}
        onOpenChange={(open) => {
          setTimerDialogOpen(open);
          if (!open) setTimerCapture(null);
        }}
        capture={timerCapture}
        defaultHourlyRate={defaultHourlyRate}
        projects={projects}
        workLogs={workLogs}
        dataSourceMode={dataSourceMode}
      />

      {dataSourceMode === "mock" && <DeleteEntryDialog entry={deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)} />}
    </div>
  );
}
