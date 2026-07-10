"use client";

import { useState } from "react";
import { Link2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Attachment } from "@/types/domain";

interface AttachmentsListEditorProps {
  value: Attachment[];
  onChange: (next: Attachment[]) => void;
}

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `att_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * There is no blob storage backend in this app, so "attachments" are honestly
 * just user-entered name + URL links (e.g. a Google Drive file, a Loom
 * recording, a screenshot host) rather than uploaded files.
 */
export function AttachmentsListEditor({ value, onChange }: AttachmentsListEditorProps) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  function add() {
    const trimmedName = name.trim();
    const trimmedUrl = url.trim();
    if (!trimmedName || !trimmedUrl) return;
    const attachment: Attachment = {
      id: makeId(),
      name: trimmedName,
      url: trimmedUrl,
      mimeType: "",
      sizeBytes: 0,
      addedAt: new Date().toISOString(),
    };
    onChange([...value, attachment]);
    setName("");
    setUrl("");
  }

  function remove(id: string) {
    onChange(value.filter((a) => a.id !== id));
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        Link an attachment by name and URL — files aren&apos;t uploaded or stored here.
      </p>
      {value.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {value.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 text-sm"
            >
              <a
                href={a.url}
                target="_blank"
                rel="noreferrer"
                className="flex min-w-0 items-center gap-1.5 text-primary hover:underline"
              >
                <Link2 className="size-3.5 shrink-0" />
                <span className="truncate">{a.name}</span>
              </a>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="shrink-0"
                onClick={() => remove(a.id)}
                aria-label={`Remove attachment ${a.name}`}
              >
                <X className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder="Attachment name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="sm:w-40"
        />
        <Input
          placeholder="https://…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={add} className="sm:shrink-0">
          <Plus className="size-4" />
          Link
        </Button>
      </div>
    </div>
  );
}
