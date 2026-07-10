"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import type { Priority, Project, ProjectStatus } from "@/types/domain";
import { useDeleteProject, useProject, useUpdateProject } from "../hooks/use-project";
import { RelatedHoursTable } from "./related-hours-table";
import { RelatedWorkLogsTable } from "./related-worklogs-table";
import { RelatedKnowledgeTable } from "./related-knowledge-table";
import {
  ColorSwatch,
  PRIORITY_LABEL,
  PRIORITY_OPTIONS,
  PROJECT_COLOR_PRESETS,
  STATUS_LABEL,
  STATUS_OPTIONS,
} from "./badges";

interface FormState {
  name: string;
  description: string;
  status: ProjectStatus;
  priority: Priority;
  color: string;
  tagsInput: string;
  notes: string;
}

function toFormState(project: Project): FormState {
  return {
    name: project.name,
    description: project.description,
    status: project.status,
    priority: project.priority,
    color: project.color,
    tagsInput: project.tags.join(", "),
    notes: project.notes,
  };
}

export function ProjectDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { data, isLoading, isError } = useProject(id);
  const { mutate: updateProject, isPending: isSaving } = useUpdateProject(id);
  const { mutate: deleteProject, isPending: isDeleting } = useDeleteProject();

  const [form, setForm] = useState<FormState | null>(null);

  // Re-sync the local form whenever we navigate to a different project, or
  // whenever our own save round-trips (updatedAt changes) - not on every
  // background refetch, so in-progress edits aren't clobbered. Adjusted
  // during render rather than in an effect, per React's guidance.
  const [syncedKey, setSyncedKey] = useState<string | null>(null);
  const currentKey = data?.project ? `${id}:${data.project.updatedAt}` : null;
  if (data?.project && currentKey !== syncedKey) {
    setSyncedKey(currentKey);
    setForm(toFormState(data.project));
  }

  if (isLoading || !form) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-start gap-3">
        <Button variant="ghost" size="sm" render={<Link href="/projects" />}>
          <ArrowLeft />
          Back to projects
        </Button>
        <p className="text-muted-foreground">
          This project could not be found. It may have been deleted.
        </p>
      </div>
    );
  }

  const { project, hours, workLogs, knowledge } = data;

  const isDirty = JSON.stringify(form) !== JSON.stringify(toFormState(project));

  function handleSave() {
    if (!form) return;
    const tags = form.tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    updateProject({
      name: form.name.trim() || project.name,
      description: form.description,
      status: form.status,
      priority: form.priority,
      color: form.color,
      tags,
      notes: form.notes,
    });
  }

  function handleDelete() {
    deleteProject(id, {
      onSuccess: () => router.push("/projects"),
    });
  }

  const tagPreview = form.tagsInput
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" render={<Link href="/projects" />}>
          <ArrowLeft />
          Back to projects
        </Button>

        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button variant="destructive" size="sm">
                <Trash2 />
                Delete project
              </Button>
            }
          />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete &ldquo;{project.name}&rdquo;?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes the project record itself. Hours, work logs, and
                documentation already linked to it are not deleted, but will
                no longer show a project association.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={isDeleting}
                onClick={handleDelete}
              >
                {isDeleting ? "Deleting…" : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ColorSwatch color={form.color} className="size-4" />
            <CardTitle className="text-lg">Project details</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as ProjectStatus })}
              >
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
              <Select
                value={form.priority}
                onValueChange={(v) => setForm({ ...form, priority: v as Priority })}
              >
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
            <Label htmlFor="project-color">Color</Label>
            <div className="flex flex-wrap items-center gap-2">
              {PROJECT_COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, color: c })}
                  aria-label={`Use color ${c}`}
                  className="size-6 rounded-full ring-1 ring-foreground/10 transition-transform data-[active=true]:scale-110 data-[active=true]:ring-2 data-[active=true]:ring-foreground"
                  data-active={form.color === c}
                  style={{ backgroundColor: c }}
                />
              ))}
              <Input
                id="project-color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="w-28"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-tags">Tags</Label>
            <Input
              id="project-tags"
              value={form.tagsInput}
              onChange={(e) => setForm({ ...form, tagsInput: e.target.value })}
              placeholder="comma, separated, tags"
            />
            {tagPreview.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {tagPreview.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[0.7rem]">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-notes">Notes</Label>
            <Textarea
              id="project-notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={4}
              placeholder="Anything worth remembering about this project…"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            {isDirty && !isSaving && (
              <span className="text-xs text-muted-foreground">Unsaved changes</span>
            )}
            <Button onClick={handleSave} disabled={!isDirty || isSaving}>
              {isSaving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <RelatedHoursTable hours={hours} />
        <RelatedWorkLogsTable workLogs={workLogs} />
      </div>

      <RelatedKnowledgeTable pages={knowledge} />
    </div>
  );
}
