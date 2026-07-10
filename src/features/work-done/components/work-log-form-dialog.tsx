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
import { Checkbox } from "@/components/ui/checkbox";
import { todayISO } from "@/lib/calculations";
import type { Project } from "@/types/domain";
import { useCreateWorkLog } from "../hooks/use-work-logs";
import { PRIORITY_LABEL, PRIORITY_OPTIONS, STATUS_LABEL, STATUS_OPTIONS } from "./status-priority";
import type { AppDataSourceMode } from "@/lib/data/runtime-config";

interface WorkLogFormDialogProps {
  projects: Project[];
  dataSourceMode: AppDataSourceMode;
}

const NO_PROJECT = "__none__";

export function WorkLogFormDialog({ projects, dataSourceMode }: WorkLogFormDialogProps) {
  const router = useRouter();
  const { mutate: createWorkLog, isPending } = useCreateWorkLog();
  const [open, setOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState<string>(NO_PROJECT);
  const [date, setDate] = useState(todayISO());
  const [status, setStatus] = useState<string>("not-started");
  const [priority, setPriority] = useState<string>("medium");
  const [summary, setSummary] = useState("");
  const [invoiceDescription, setInvoiceDescription] = useState("");
  const [detailedWorkDescription, setDetailedWorkDescription] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [evidenceLinks, setEvidenceLinks] = useState("");
  const [clientVisible, setClientVisible] = useState(false);
  const [includeInInvoice, setIncludeInInvoice] = useState(false);
  const [includeInWorkReport, setIncludeInWorkReport] = useState(false);

  const projectNameById = new Map(projects.map((p) => [p.id, p.name]));

  function reset() {
    setTitle("");
    setProjectId(NO_PROJECT);
    setDate(todayISO());
    setStatus("not-started");
    setPriority("medium");
    setSummary("");
    setInvoiceDescription("");
    setDetailedWorkDescription("");
    setInternalNotes("");
    setEvidenceLinks("");
    setClientVisible(false);
    setIncludeInInvoice(false);
    setIncludeInWorkReport(false);
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
        invoiceDescription,
        detailedWorkDescription,
        detailedNotes: internalNotes,
        internalNotes,
        clientVisible,
        includeInInvoice,
        includeInWorkReport,
        evidenceLinks: evidenceLinks.split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
        evidence: [],
        relatedHoursIds: [],
        relatedKnowledgeIds: [],
        githubLink: null,
        attachments: [],
      },
      {
        onSuccess: (created) => {
          toast.success(dataSourceMode === "notion" ? "Saved to Notion" : "Work log created");
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>New work log</DialogTitle>
            <DialogDescription>
              This form remains a local browser draft until you explicitly {dataSourceMode === "notion" ? "save it to Notion" : "create it"}.
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

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wl-invoice-description">Invoice Description</Label>
              <Textarea id="wl-invoice-description" value={invoiceDescription} onChange={(event) => setInvoiceDescription(event.target.value)} className="min-h-28" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wl-detailed-work">Detailed Work Description</Label>
              <Textarea id="wl-detailed-work" value={detailedWorkDescription} onChange={(event) => setDetailedWorkDescription(event.target.value)} className="min-h-28" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="wl-internal-notes">Internal Notes</Label>
            <Textarea id="wl-internal-notes" value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} className="min-h-24" />
            <p className="text-xs text-muted-foreground">Never included in client-facing exports.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="wl-evidence-links">Evidence Links</Label>
            <Textarea id="wl-evidence-links" value={evidenceLinks} onChange={(event) => setEvidenceLinks(event.target.value)} placeholder="One URL or evidence note per line" />
          </div>

          <div className="grid gap-2 rounded-lg border p-3 text-sm sm:grid-cols-3">
            <label className="flex items-center gap-2"><Checkbox checked={clientVisible} onCheckedChange={(checked) => {
              const visible = checked === true;
              setClientVisible(visible);
              if (!visible) {
                setIncludeInInvoice(false);
                setIncludeInWorkReport(false);
              }
            }} />Client Visible</label>
            <label className="flex items-center gap-2"><Checkbox checked={includeInInvoice} onCheckedChange={(checked) => setIncludeInInvoice(checked === true)} disabled={!clientVisible} />Include in Invoice</label>
            <label className="flex items-center gap-2"><Checkbox checked={includeInWorkReport} onCheckedChange={(checked) => setIncludeInWorkReport(checked === true)} disabled={!clientVisible} />Include in Work Report</label>
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
              {isPending ? "Saving…" : dataSourceMode === "notion" ? "Save to Notion" : "Create work log"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
