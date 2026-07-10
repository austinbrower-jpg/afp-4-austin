"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RANGE_OPTIONS, type HoursRangeKey } from "../lib/ranges";

export function HoursRangeControl({
  value,
  onChange,
}: {
  value: HoursRangeKey;
  onChange: (value: HoursRangeKey) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as HoursRangeKey)}>
      <SelectTrigger className="w-40" size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {RANGE_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
