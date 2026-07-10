"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Pencil, Trash2, Save, X as XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useKnowledgePage } from "../hooks/use-knowledge-page";
import { useAllKnowledgePages } from "../hooks/use-knowledge-list";
import { useUpdateKnowledgePage, useDeleteKnowledgePage } from "../hooks/use-knowledge-mutations";
import { KnowledgeTypeBadge } from "./knowledge-type-badge";
import { MarkdownView } from "./markdown-view";
import { BacklinksPanel } from "./backlinks-panel";
import { KnowledgePageFields, NO_PARENT, type KnowledgePageFieldValues } from "./knowledge-page-fields";
import { RelatedPagesEditor } from "./related-pages-editor";
import { getAncestorChain, validParentOptions } from "../lib/tree";
import { typeToSlug, TYPE_LABELS } from "../lib/slugs";

interface KnowledgePageViewProps {
  id: string;
}

export function KnowledgePageView({ id }: KnowledgePageViewProps) {
  const router = useRouter();
  const { data: page, isLoading, isError } = useKnowledgePage(id);
  const { data: allPagesData } = useAllKnowledgePages();
  const allPages = allPagesData ?? [];

  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState<KnowledgePageFieldValues | null>(null);
  const [relatedIds, setRelatedIds] = useState<string[]>([]);

  const { mutate: updatePage, isPending: isSaving } = useUpdateKnowledgePage(id);
  const { mutate: deletePage, isPending: isDeleting } = useDeleteKnowledgePage();

  function startEditing() {
    if (!page) return;
    setFields({
      title: page.title,
      type: page.type,
      tagsInput: page.tags.join(", "),
      parentId: page.parentId ?? NO_PARENT,
      content: page.content,
    });
    setRelatedIds(page.backlinkIds);
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setFields(null);
  }

  function save() {
    if (!fields) return;
    const title = fields.title.trim();
    if (!title) return;
    updatePage(
      {
        title,
        type: fields.type,
        content: fields.content,
        tags: fields.tagsInput
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        parentId: fields.parentId === NO_PARENT ? null : fields.parentId,
        backlinkIds: relatedIds,
      },
      { onSuccess: () => setEditing(false) },
    );
  }

  function handleDelete() {
    if (!page) return;
    deletePage(page.id, {
      onSuccess: () => router.push(`/knowledge/${typeToSlug(page.type)}`),
    });
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-8 w-96" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !page) {
    return (
      <div className="flex flex-col items-start gap-3">
        <h1 className="text-xl font-semibold">Page not found</h1>
        <p className="text-sm text-muted-foreground">
          This knowledge page doesn&apos;t exist or was deleted.
        </p>
        <Button variant="outline" render={<Link href="/knowledge/all">Back to knowledge base</Link>} />
      </div>
    );
  }

  const ancestors = getAncestorChain(page, allPages);
  const children = allPages.filter((p) => p.parentId === page.id);
  const parentOptions = validParentOptions(allPages, page.id);

  return (
    <div className="flex flex-col gap-5">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              render={
                <Link href={`/knowledge/${typeToSlug(page.type)}`}>{TYPE_LABELS[page.type]}</Link>
              }
            />
          </BreadcrumbItem>
          {ancestors.map((ancestor) => (
            <span key={ancestor.id} className="contents">
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink render={<Link href={`/knowledge/page/${ancestor.id}`}>{ancestor.title}</Link>} />
              </BreadcrumbItem>
            </span>
          ))}
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{page.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{page.title}</h1>
            <KnowledgeTypeBadge type={page.type} />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {page.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
            <span className="text-xs text-muted-foreground">
              Updated {formatDistanceToNow(new Date(page.updatedAt), { addSuffix: true })}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {editing ? (
            <>
              <Button variant="outline" size="sm" onClick={cancelEditing} disabled={isSaving}>
                <XIcon />
                Cancel
              </Button>
              <Button size="sm" onClick={save} disabled={isSaving || !fields?.title.trim()}>
                <Save />
                {isSaving ? "Saving…" : "Save"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={startEditing}>
                <Pencil />
                Edit
              </Button>
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button variant="destructive" size="sm">
                      <Trash2 />
                      Delete
                    </Button>
                  }
                />
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete &quot;{page.title}&quot;?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {children.length > 0
                        ? `This page has ${children.length} child page${children.length > 1 ? "s" : ""}, which will be promoted to top-level. This cannot be undone.`
                        : "This cannot be undone."}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                      {isDeleting ? "Deleting…" : "Delete"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_280px]">
        <div className="min-w-0 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
          {editing && fields ? (
            <div className="flex flex-col gap-4">
              <KnowledgePageFields
                values={fields}
                onChange={setFields}
                parentOptions={parentOptions}
                contentRows={16}
                idPrefix="kb-edit"
              />
              <RelatedPagesEditor
                selectedIds={relatedIds}
                onChange={setRelatedIds}
                candidates={allPages}
                excludeId={page.id}
              />
            </div>
          ) : (
            <MarkdownView content={page.content} allPages={allPages} currentPageId={page.id} />
          )}
        </div>

        <BacklinksPanel page={page} allPages={allPages} childPages={children} />
      </div>
    </div>
  );
}
