"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { KnowledgePage, KnowledgeType } from "@/types/domain";
import { ALL_KNOWLEDGE_TYPES, TYPE_LABELS } from "../lib/slugs";

export interface KnowledgePageFieldValues {
  title: string;
  type: KnowledgeType;
  tagsInput: string;
  parentId: string; // "none" = top-level
  content: string;
}

const NO_PARENT = "none";

interface KnowledgePageFieldsProps {
  values: KnowledgePageFieldValues;
  onChange: (values: KnowledgePageFieldValues) => void;
  parentOptions: KnowledgePage[];
  typeLocked?: boolean;
  contentRows?: number;
  idPrefix?: string;
}

export function KnowledgePageFields({
  values,
  onChange,
  parentOptions,
  typeLocked = false,
  contentRows = 8,
  idPrefix = "kb-page",
}: KnowledgePageFieldsProps) {
  function set<K extends keyof KnowledgePageFieldValues>(key: K, value: KnowledgePageFieldValues[K]) {
    onChange({ ...values, [key]: value });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-title`}>Title</Label>
        <Input
          id={`${idPrefix}-title`}
          value={values.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Page title"
          autoFocus
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-type`}>Type</Label>
          <Select
            value={values.type}
            onValueChange={(value) => set("type", value as KnowledgeType)}
            disabled={typeLocked}
          >
            <SelectTrigger id={`${idPrefix}-type`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ALL_KNOWLEDGE_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-parent`}>Parent page</Label>
          <Select
            value={values.parentId}
            onValueChange={(value) => set("parentId", value ?? NO_PARENT)}
          >
            <SelectTrigger id={`${idPrefix}-parent`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_PARENT}>No parent (top-level)</SelectItem>
              {parentOptions.map((page) => (
                <SelectItem key={page.id} value={page.id}>
                  {page.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-tags`}>Tags</Label>
        <Input
          id={`${idPrefix}-tags`}
          value={values.tagsInput}
          onChange={(e) => set("tagsInput", e.target.value)}
          placeholder="comma, separated, tags"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-content`}>Content (Markdown)</Label>
        <Textarea
          id={`${idPrefix}-content`}
          value={values.content}
          onChange={(e) => set("content", e.target.value)}
          placeholder={"Write in Markdown. Use [[Page Title]] to link to another page."}
          rows={contentRows}
          className="font-mono text-sm"
        />
      </div>
    </div>
  );
}

export { NO_PARENT };
