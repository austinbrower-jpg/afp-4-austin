"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface EvidenceListEditorProps {
  value: string[];
  onChange: (next: string[]) => void;
}

/** Add/remove list of free-text evidence notes or links (matches string[] domain field). */
export function EvidenceListEditor({ value, onChange }: EvidenceListEditorProps) {
  const [draft, setDraft] = useState("");

  function add() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onChange([...value, trimmed]);
    setDraft("");
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {value.map((item, index) => (
            <li
              key={index}
              className="flex items-start justify-between gap-2 rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 text-sm"
            >
              <span className="break-all">{item}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="shrink-0"
                onClick={() => remove(index)}
                aria-label={`Remove evidence ${index + 1}`}
              >
                <X className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input
          placeholder="Add evidence note or link…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" variant="outline" size="default" onClick={add}>
          <Plus className="size-4" />
          Add
        </Button>
      </div>
    </div>
  );
}
