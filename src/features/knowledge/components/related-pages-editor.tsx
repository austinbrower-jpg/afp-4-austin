"use client";

import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { KnowledgePage } from "@/types/domain";

interface RelatedPagesEditorProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  candidates: KnowledgePage[];
  excludeId?: string;
}

const PICKER_PLACEHOLDER = "__pick__";

export function RelatedPagesEditor({ selectedIds, onChange, candidates, excludeId }: RelatedPagesEditorProps) {
  const byId = new Map(candidates.map((p) => [p.id, p]));
  const options = candidates.filter((p) => p.id !== excludeId && !selectedIds.includes(p.id));

  function add(id: string | null) {
    if (!id || id === PICKER_PLACEHOLDER) return;
    onChange([...selectedIds, id]);
  }

  function remove(id: string) {
    onChange(selectedIds.filter((existing) => existing !== id));
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label>Related pages (links to)</Label>
      <div className="flex flex-wrap items-center gap-1.5">
        {selectedIds.map((id) => {
          const page = byId.get(id);
          return (
            <Badge key={id} variant="secondary" className="gap-1 pr-1">
              {page?.title ?? id}
              <button
                type="button"
                onClick={() => remove(id)}
                className="rounded-full hover:bg-foreground/10"
                aria-label={`Remove link to ${page?.title ?? id}`}
              >
                <X className="size-3" />
              </button>
            </Badge>
          );
        })}
        <Select value={PICKER_PLACEHOLDER} onValueChange={add}>
          <SelectTrigger size="sm" className="h-7 text-xs">
            <SelectValue placeholder="Link a page…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={PICKER_PLACEHOLDER} disabled>
              Link a page…
            </SelectItem>
            {options.map((page) => (
              <SelectItem key={page.id} value={page.id}>
                {page.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
