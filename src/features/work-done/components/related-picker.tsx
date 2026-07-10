"use client";

import { ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface RelatedPickerOption {
  id: string;
  primary: string;
  secondary: string;
}

interface RelatedPickerProps {
  label: string;
  emptyLabel: string;
  options: RelatedPickerOption[];
  value: string[];
  onChange: (next: string[]) => void;
}

/** Generic multi-select popover backed by checkboxes, used for related hours / knowledge. */
export function RelatedPicker({
  label,
  emptyLabel,
  options,
  value,
  onChange,
}: RelatedPickerProps) {
  function toggle(id: string) {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  }

  const selected = options.filter((o) => value.includes(o.id));

  return (
    <div className="flex flex-col gap-2">
      <Popover>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              className="w-full justify-between font-normal"
            />
          }
        >
          <span className="text-muted-foreground">
            {value.length === 0
              ? label
              : `${value.length} selected`}
          </span>
          <ChevronsUpDown className="size-3.5 text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <ScrollArea className="max-h-72">
            <div className="flex flex-col gap-0.5 p-1.5">
              {options.length === 0 ? (
                <p className="px-2 py-3 text-sm text-muted-foreground">{emptyLabel}</p>
              ) : (
                options.map((option) => {
                  const checked = value.includes(option.id);
                  return (
                    <label
                      key={option.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggle(option.id)}
                      />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate">{option.primary}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {option.secondary}
                        </span>
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {selected.map((option) => (
            <li
              key={option.id}
              className="rounded-full border border-border bg-muted/30 px-2 py-0.5 text-xs text-foreground"
            >
              {option.primary}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
