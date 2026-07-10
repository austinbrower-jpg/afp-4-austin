"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { computeTotalHours, formatHours } from "@/lib/calculations";
import type { HoursEntryInput } from "../lib/types";

export interface ProjectOption {
  id: string;
  name: string;
}

export interface WorkLogOption {
  id: string;
  title: string;
  date: string;
}

const NONE = "__none__";

export function HoursEntryFormFields({
  values,
  onChange,
  projects,
  workLogs,
  lockTiming = false,
}: {
  values: HoursEntryInput;
  onChange: (patch: Partial<HoursEntryInput>) => void;
  projects: ProjectOption[];
  workLogs: WorkLogOption[];
  lockTiming?: boolean;
}) {
  const previewHours = computeTotalHours(values.startTime, values.endTime, values.breakMinutes);

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="grid gap-1">
          <Label htmlFor="hours-date">Date</Label>
          <Input
            id="hours-date"
            type="date"
            value={values.date}
            disabled={lockTiming}
            onChange={(e) => onChange({ date: e.target.value })}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="hours-start">Start Time</Label>
          <Input
            id="hours-start"
            type="time"
            value={values.startTime}
            disabled={lockTiming}
            onChange={(e) => onChange({ startTime: e.target.value })}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="hours-end">End Time</Label>
          <Input
            id="hours-end"
            type="time"
            value={values.endTime}
            disabled={lockTiming}
            onChange={(e) => onChange({ endTime: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="grid gap-1">
          <Label htmlFor="hours-break">Break (minutes)</Label>
          <Input
            id="hours-break"
            type="number"
            min={0}
            step={5}
            value={values.breakMinutes}
            onChange={(e) => onChange({ breakMinutes: Math.max(0, Number(e.target.value) || 0) })}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="hours-rate">Hourly Rate ($)</Label>
          <Input
            id="hours-rate"
            type="number"
            min={0}
            step={5}
            value={values.hourlyRate}
            onChange={(e) => onChange({ hourlyRate: Math.max(0, Number(e.target.value) || 0) })}
          />
        </div>
        <div className="grid gap-1">
          <Label>Total Hours</Label>
          <div className="flex h-8 items-center text-sm text-muted-foreground">
            {formatHours(previewHours)} (auto-calculated)
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1">
          <Label htmlFor="hours-project">Project</Label>
          <Select
            value={values.projectId ?? NONE}
            onValueChange={(v) => onChange({ projectId: v === NONE ? null : (v as string) })}
          >
            <SelectTrigger id="hours-project" className="w-full">
              <SelectValue placeholder="No project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>No project</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="hours-worklog">Related Work Log</Label>
          <Select
            value={values.relatedWorkLogId ?? NONE}
            onValueChange={(v) => onChange({ relatedWorkLogId: v === NONE ? null : (v as string) })}
          >
            <SelectTrigger id="hours-worklog" className="w-full">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>None</SelectItem>
              {workLogs.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.title} ({w.date})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1">
          <Label htmlFor="hours-location">Location</Label>
          <Input
            id="hours-location"
            placeholder="e.g. Remote - Home Office"
            value={values.location}
            onChange={(e) => onChange({ location: e.target.value })}
          />
        </div>
        <div className="flex items-end gap-2 pb-1">
          <Switch
            id="hours-billable"
            checked={values.billable}
            onCheckedChange={(checked) => onChange({ billable: checked })}
          />
          <Label htmlFor="hours-billable">Billable</Label>
        </div>
      </div>

      <div className="grid gap-1">
        <Label htmlFor="hours-notes">Notes</Label>
        <Textarea
          id="hours-notes"
          rows={3}
          placeholder="What did you work on?"
          value={values.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
        />
      </div>
    </div>
  );
}
