"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
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
import type { KnowledgePage, KnowledgeType } from "@/types/domain";
import { useCreateKnowledgePage } from "../hooks/use-knowledge-mutations";
import { KnowledgePageFields, NO_PARENT, type KnowledgePageFieldValues } from "./knowledge-page-fields";

interface CreatePageDialogProps {
  allPages: KnowledgePage[];
  defaultType: KnowledgeType;
  defaultParentId?: string | null;
  typeLocked?: boolean;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "ghost" | "secondary";
  triggerSize?: "default" | "sm" | "xs" | "icon-sm";
  onCreated?: (page: KnowledgePage) => void;
}

function initialValues(defaultType: KnowledgeType, defaultParentId?: string | null): KnowledgePageFieldValues {
  return {
    title: "",
    type: defaultType,
    tagsInput: "",
    parentId: defaultParentId ?? NO_PARENT,
    content: "",
  };
}

export function CreatePageDialog({
  allPages,
  defaultType,
  defaultParentId = null,
  typeLocked = false,
  triggerLabel = "New page",
  triggerVariant = "default",
  triggerSize = "sm",
  onCreated,
}: CreatePageDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<KnowledgePageFieldValues>(() =>
    initialValues(defaultType, defaultParentId),
  );
  const { mutate: createPage, isPending } = useCreateKnowledgePage();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setValues(initialValues(defaultType, defaultParentId));
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const title = values.title.trim();
    if (!title) return;

    createPage(
      {
        title,
        type: values.type,
        content: values.content,
        tags: values.tagsInput
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        parentId: values.parentId === NO_PARENT ? null : values.parentId,
      },
      {
        onSuccess: (page) => {
          setOpen(false);
          if (onCreated) onCreated(page);
          else router.push(`/knowledge/page/${page.id}`);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant={triggerVariant} size={triggerSize}>
            <Plus />
            {triggerLabel}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>New knowledge page</DialogTitle>
            <DialogDescription>
              Add a page to the knowledge base. Nest it under an existing page if it belongs there.
            </DialogDescription>
          </DialogHeader>
          <KnowledgePageFields
            values={values}
            onChange={setValues}
            parentOptions={allPages}
            typeLocked={typeLocked}
            idPrefix="kb-create"
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !values.title.trim()}>
              {isPending ? "Creating…" : "Create page"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
