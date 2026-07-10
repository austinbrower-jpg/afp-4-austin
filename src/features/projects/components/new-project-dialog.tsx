"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import type { Priority, ProjectStatus } from "@/types/domain";
import { useCreateProject } from "../hooks/use-projects";
import {
  DEFAULT_PROJECT_COLOR,
  PRIORITY_LABEL,
  PRIORITY_OPTIONS,
  PROJECT_COLOR_PRESETS,
  STATUS_LABEL,
  STATUS_OPTIONS,
} from "./badges";

export function NewProjectDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("active");
  const [priority, setPriority] = useState<Priority>("medium");
  const [color, setColor] = useState(DEFAULT_PROJECT_COLOR);
  const [tagsInput, setTagsInput] = useState("");

  const { mutate: createProject, isPending } = useCreateProject();

  function reset() {
    setName("");
    setDescription("");
    setStatus("active");
    setPriority("medium");
    setColor(DEFAULT_PROJECT_COLOR);
    setTagsInput("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    createProject(
      { name: name.trim(), description, status, priority, color, tags },
      {
        onSuccess: (project) => {
          setOpen(false);
          reset();
          router.push(`/projects/${project.id}`);
        },
      },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger render={<Button><Plus /> New Project</Button>} />
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>
              Projects connect hours, work logs, and documentation together.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-project-name">Name</Label>
            <Input
              id="new-project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Website Redesign"
              autoFocus
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-project-description">Description</Label>
            <Textarea
              id="new-project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this project about?"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORITY_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-project-color">Color</Label>
            <div className="flex items-center gap-2">
              {PROJECT_COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Use color ${c}`}
                  className="size-6 rounded-full ring-1 ring-foreground/10 transition-transform data-[active=true]:scale-110 data-[active=true]:ring-2 data-[active=true]:ring-foreground"
                  data-active={color === c}
                  style={{ backgroundColor: c }}
                />
              ))}
              <Input
                id="new-project-color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-24"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-project-tags">Tags</Label>
            <Input
              id="new-project-tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="comma, separated, tags"
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending || !name.trim()}>
              {isPending ? "Creating…" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
