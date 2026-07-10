"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { todayISO } from "@/lib/calculations";
import type { Project } from "@/types/domain";
import { useCreateWorkLog } from "../hooks/use-work-logs";
import { PRIORITY_LABEL, PRIORITY_OPTIONS, STATUS_LABEL, STATUS_OPTIONS } from "./status-priority";

interface WorkLogFormDialogProps {
  projects: Project[];
}

const NO_PROJECT = "__none__";

export function WorkLogFormDialog({ projects }: WorkLogFormDialogProps) {
  const router = useRouter();
  const { mutate: createWorkLog, isPending } = useCreateWorkLog();
  const [open, setOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState<string>(NO_PROJECT);
  const [date, setDate] = useState(todayISO());
  const [status, setStatus] = useState<string>("not-started");
  const [priority, setPriority] = useState<string>("medium");
  const [summary, setSummary] = useState("");

  const projectNameById = new Map(projects.map((p) => [p.id, p.name]));

  function reset() {
    setTitle("");
    setProjectId(NO_PROJECT);
    setDate(todayISO());
    setStatus("not-started");
    setPriority("medium");
    setSummary("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    createWorkLog(
      {
        title: title.trim(),
        projectId: projectId === NO_PROJECT ? null : projectId,
        date,
        status: status as never,
        priority: priority as never,
        summary,
      },
      {
        onSuccess: (created) => {
          toast.success("Work log created");
          setOpen(false);
          reset();
          router.push(`/work-done/${created.id}`);
        },
        onError: () => toast.error("Failed to create work log"),
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
      <DialogTrigger render={<Button />}>
        <Plus className="size-4" />
        New work log
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>New work log</DialogTitle>
            <DialogDescription>
              Capture the basics now — you can fill in detailed notes, invoice
              description, and related hours after creating it.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="wl-title">Title</Label>
            <Input
              id="wl-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Rebuild invoice PDF export"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wl-date">Date</Label>
              <Input
                id="wl-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Project</Label>
              <Select value={projectId} onValueChange={(v) => setProjectId(v ?? NO_PROJECT)}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(v: string) =>
                      v === NO_PROJECT ? "No project" : projectNameById.get(v) ?? "No project"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PROJECT}>No project</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v ?? status)}>
                <SelectTrigger className="w-full">
                  <SelectValue>{(v: string) => STATUS_LABEL[v as keyof typeof STATUS_LABEL] ?? v}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v ?? priority)}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(v: string) => PRIORITY_LABEL[v as keyof typeof PRIORITY_LABEL] ?? v}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="wl-summary">Summary</Label>
            <Textarea
              id="wl-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="One or two sentences on what this covers…"
              className="min-h-20"
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating…" : "Create work log"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
