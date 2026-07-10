"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ArrowLeft, ExternalLink, GitBranch, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatHours } from "@/lib/calculations";
import type { Attachment, HoursEntry, KnowledgePage, Project, WorkLog } from "@/types/domain";
import { useDeleteWorkLog, useUpdateWorkLog } from "../hooks/use-work-logs";
import { AttachmentsListEditor } from "./attachments-list-editor";
import { EvidenceListEditor } from "./evidence-list-editor";
import { NotesMarkdownField } from "./notes-markdown-field";
import { RelatedPicker, type RelatedPickerOption } from "./related-picker";
import {
  PRIORITY_LABEL,
  PRIORITY_OPTIONS,
  STATUS_LABEL,
  STATUS_OPTIONS,
  PriorityBadge,
  StatusBadge,
} from "./status-priority";

const NO_PROJECT = "__none__";

interface WorkLogDetailProps {
  workLog: WorkLog;
  projects: Project[];
  hours: HoursEntry[];
  knowledge: KnowledgePage[];
}

export function WorkLogDetail({ workLog, projects, hours, knowledge }: WorkLogDetailProps) {
  const router = useRouter();
  const { mutate: updateWorkLog, isPending: isSaving } = useUpdateWorkLog(workLog.id);
  const { mutate: deleteWorkLog, isPending: isDeleting } = useDeleteWorkLog();

  const [title, setTitle] = useState(workLog.title);
  const [date, setDate] = useState(workLog.date);
  const [projectId, setProjectId] = useState(workLog.projectId ?? NO_PROJECT);
  const [status, setStatus] = useState<string>(workLog.status);
  const [priority, setPriority] = useState<string>(workLog.priority);
  const [summary, setSummary] = useState(workLog.summary);
  const [detailedNotes, setDetailedNotes] = useState(workLog.detailedNotes);
  const [invoiceDescription, setInvoiceDescription] = useState(workLog.invoiceDescription);
  const [relatedHoursIds, setRelatedHoursIds] = useState<string[]>(workLog.relatedHoursIds);
  const [relatedKnowledgeIds, setRelatedKnowledgeIds] = useState<string[]>(
    workLog.relatedKnowledgeIds,
  );
  const [evidence, setEvidence] = useState<string[]>(workLog.evidence);
  const [githubLink, setGithubLink] = useState(workLog.githubLink ?? "");
  const [attachments, setAttachments] = useState<Attachment[]>(workLog.attachments);

  const projectNameById = new Map(projects.map((p) => [p.id, p.name]));

  const hoursOptions: RelatedPickerOption[] = hours.map((h) => ({
    id: h.id,
    primary: `${formatShortDate(h.date)} · ${formatHours(h.totalHours)}`,
    secondary: h.notes || h.location || "Hours entry",
  }));

  const knowledgeOptions: RelatedPickerOption[] = knowledge.map((k) => ({
    id: k.id,
    primary: k.title,
    secondary: k.type,
  }));

  function handleSave() {
    updateWorkLog(
      {
        title: title.trim() || workLog.title,
        date,
        projectId: projectId === NO_PROJECT ? null : projectId,
        status: status as WorkLog["status"],
        priority: priority as WorkLog["priority"],
        summary,
        detailedNotes,
        invoiceDescription,
        relatedHoursIds,
        relatedKnowledgeIds,
        evidence,
        githubLink: githubLink.trim() ? githubLink.trim() : null,
        attachments,
      },
      {
        onSuccess: () => toast.success("Work log saved"),
        onError: () => toast.error("Failed to save work log"),
      },
    );
  }

  function handleDelete() {
    deleteWorkLog(workLog.id, {
      onSuccess: () => {
        toast.success("Work log deleted");
        router.push("/work-done");
      },
      onError: () => toast.error("Failed to delete work log"),
    });
  }

  return (
    <div className="flex flex-col gap-4 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/work-done" />}>
          <ArrowLeft className="size-4" />
          Back to Work Done
        </Button>
        <div className="flex items-center gap-2">
          <StatusBadge status={workLog.status} />
          <PriorityBadge priority={workLog.priority} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>Core fields describing this piece of work.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-base font-medium"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
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
            <Label htmlFor="summary">Summary</Label>
            <Textarea
              id="summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Short one or two sentence summary…"
              className="min-h-16"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="github">GitHub link (optional)</Label>
            <div className="flex items-center gap-2">
              <GitBranch className="size-4 shrink-0 text-muted-foreground" />
              <Input
                id="github"
                value={githubLink}
                onChange={(e) => setGithubLink(e.target.value)}
                placeholder="https://github.com/org/repo/pull/123"
              />
              {githubLink.trim() && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  nativeButton={false}
                  render={<a href={githubLink} target="_blank" rel="noreferrer" />}
                >
                  <ExternalLink className="size-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Detailed Notes</CardTitle>
            <CardDescription>
              Internal engineering notes (markdown supported). Never shown to the client.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NotesMarkdownField
              value={detailedNotes}
              onChange={setDetailedNotes}
              placeholder="What did you actually do? Implementation details, decisions, gotchas…"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invoice Description</CardTitle>
            <CardDescription>
              Client-facing text used on invoices. Edited independently of the notes above —
              it is never generated from or kept in sync with them.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={invoiceDescription}
              onChange={(e) => setInvoiceDescription(e.target.value)}
              placeholder="Plain-language description of the work delivered, suitable for the client to read…"
              className="min-h-48"
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Related Hours</CardTitle>
            <CardDescription>Link the hours entries this work log accounts for.</CardDescription>
          </CardHeader>
          <CardContent>
            <RelatedPicker
              label="Select hours entries…"
              emptyLabel="No hours entries yet."
              options={hoursOptions}
              value={relatedHoursIds}
              onChange={setRelatedHoursIds}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Related Knowledge</CardTitle>
            <CardDescription>Link supporting docs, notes, or research pages.</CardDescription>
          </CardHeader>
          <CardContent>
            <RelatedPicker
              label="Select knowledge pages…"
              emptyLabel="No knowledge pages yet."
              options={knowledgeOptions}
              value={relatedKnowledgeIds}
              onChange={setRelatedKnowledgeIds}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Evidence</CardTitle>
            <CardDescription>Free-text notes or links proving the work was done.</CardDescription>
          </CardHeader>
          <CardContent>
            <EvidenceListEditor value={evidence} onChange={setEvidence} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attachments</CardTitle>
            <CardDescription>Link supporting files by name and URL.</CardDescription>
          </CardHeader>
          <CardContent>
            <AttachmentsListEditor value={attachments} onChange={setAttachments} />
          </CardContent>
        </Card>
      </div>

      <div className="sticky bottom-0 -mx-6 mt-2 flex items-center justify-between gap-3 border-t border-border bg-background/95 px-6 py-3 backdrop-blur supports-backdrop-filter:bg-background/80">
        <AlertDialog>
          <AlertDialogTrigger render={<Button type="button" variant="destructive" />}>
            <Trash2 className="size-4" />
            Delete
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this work log?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes &ldquo;{workLog.title}&rdquo; and cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting…" : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Button type="button" onClick={handleSave} disabled={isSaving}>
          <Save className="size-4" />
          {isSaving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

function formatShortDate(iso: string): string {
  try {
    return format(parseISO(iso), "MMM d, yyyy");
  } catch {
    return iso;
  }
}
