"use client";

import Link from "next/link";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { KnowledgePage } from "@/types/domain";
import { KnowledgeTypeBadge } from "./knowledge-type-badge";
import { CreatePageDialog } from "./create-page-dialog";
import { cn } from "@/lib/utils";

interface KnowledgePageTreeProps {
  roots: KnowledgePage[];
  childrenMap: Map<string, KnowledgePage[]>;
  allPages: KnowledgePage[];
  /** Show the type badge on every row (used in the "All types" view). */
  showTypeBadge?: boolean;
}

export function KnowledgePageTree({ roots, childrenMap, allPages, showTypeBadge }: KnowledgePageTreeProps) {
  if (!roots.length) return null;
  return (
    <div className="flex flex-col">
      {roots.map((page) => (
        <TreeNode
          key={page.id}
          page={page}
          depth={0}
          childrenMap={childrenMap}
          allPages={allPages}
          showTypeBadge={showTypeBadge}
        />
      ))}
    </div>
  );
}

function TreeNode({
  page,
  depth,
  childrenMap,
  allPages,
  showTypeBadge,
}: {
  page: KnowledgePage;
  depth: number;
  childrenMap: Map<string, KnowledgePage[]>;
  allPages: KnowledgePage[];
  showTypeBadge?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const children = childrenMap.get(page.id) ?? [];
  const hasChildren = children.length > 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div
        className="group flex items-center gap-1.5 rounded-md py-1.5 pr-1.5 hover:bg-muted/60"
        style={{ paddingLeft: `${depth * 1.25}rem` }}
      >
        {hasChildren ? (
          <CollapsibleTrigger
            className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
            aria-label={open ? "Collapse" : "Expand"}
          >
            <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} />
          </CollapsibleTrigger>
        ) : (
          <span className="size-5 shrink-0" />
        )}

        <Link
          href={`/knowledge/page/${page.id}`}
          className="flex min-w-0 flex-1 items-center gap-2 py-0.5"
        >
          <span className="truncate text-sm font-medium">{page.title}</span>
          {showTypeBadge && <KnowledgeTypeBadge type={page.type} className="shrink-0" />}
          {page.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary" className="shrink-0 text-[10px]">
              {tag}
            </Badge>
          ))}
        </Link>

        <span className="shrink-0 text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(page.updatedAt), { addSuffix: true })}
        </span>

        <div className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
          <CreatePageDialog
            allPages={allPages}
            defaultType={page.type}
            defaultParentId={page.id}
            triggerLabel="Add child"
            triggerVariant="ghost"
            triggerSize="xs"
          />
        </div>
      </div>

      {hasChildren && (
        <CollapsibleContent>
          {children.map((child) => (
            <TreeNode
              key={child.id}
              page={child}
              depth={depth + 1}
              childrenMap={childrenMap}
              allPages={allPages}
              showTypeBadge={showTypeBadge}
            />
          ))}
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}
