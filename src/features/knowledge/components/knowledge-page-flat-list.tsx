"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import type { KnowledgePage } from "@/types/domain";
import { KnowledgeTypeBadge } from "./knowledge-type-badge";

interface KnowledgePageFlatListProps {
  pages: KnowledgePage[];
  allPages: KnowledgePage[];
  showTypeBadge?: boolean;
}

/** Flat, non-hierarchical list used for search/tag-filtered results, where tree context breaks down. */
export function KnowledgePageFlatList({ pages, allPages, showTypeBadge }: KnowledgePageFlatListProps) {
  const byId = new Map(allPages.map((p) => [p.id, p]));

  if (!pages.length) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No pages match.</p>;
  }

  return (
    <div className="flex flex-col">
      {pages.map((page) => {
        const parent = page.parentId ? byId.get(page.parentId) : undefined;
        return (
          <Link
            key={page.id}
            href={`/knowledge/page/${page.id}`}
            className="group flex items-center gap-2 rounded-md py-1.5 px-1.5 hover:bg-muted/60"
          >
            <span className="truncate text-sm font-medium">{page.title}</span>
            {showTypeBadge && <KnowledgeTypeBadge type={page.type} className="shrink-0" />}
            {parent && (
              <span className="shrink-0 truncate text-xs text-muted-foreground">in {parent.title}</span>
            )}
            {page.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="shrink-0 text-[10px]">
                {tag}
              </Badge>
            ))}
            <span className="ml-auto shrink-0 text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(page.updatedAt), { addSuffix: true })}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
