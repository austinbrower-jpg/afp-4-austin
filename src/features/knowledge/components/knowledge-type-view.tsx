"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAllKnowledgePages } from "../hooks/use-knowledge-list";
import { CreatePageDialog } from "./create-page-dialog";
import { KnowledgePageTree } from "./knowledge-page-tree";
import { KnowledgePageFlatList } from "./knowledge-page-flat-list";
import { buildChildrenMap } from "../lib/tree";
import { slugLabel, slugToType, ALL_TYPES_SLUG } from "../lib/slugs";
import type { KnowledgePage } from "@/types/domain";

interface KnowledgeTypeViewProps {
  slug: string;
}

function collectSubtree(roots: KnowledgePage[], childrenMap: Map<string, KnowledgePage[]>): KnowledgePage[] {
  const result: KnowledgePage[] = [];
  const stack = [...roots];
  while (stack.length) {
    const node = stack.pop();
    if (!node) continue;
    result.push(node);
    for (const child of childrenMap.get(node.id) ?? []) stack.push(child);
  }
  return result;
}

export function KnowledgeTypeView({ slug }: KnowledgeTypeViewProps) {
  const isAll = slug === ALL_TYPES_SLUG;
  const filterType = slugToType(slug);
  const { data: allPages, isLoading } = useAllKnowledgePages();
  const [search, setSearch] = useState("");
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());

  const pages = useMemo(() => allPages ?? [], [allPages]);

  const roots = useMemo(
    () =>
      pages
        .filter((p) => p.parentId === null && (isAll || p.type === filterType))
        .sort((a, b) => a.title.localeCompare(b.title)),
    [pages, isAll, filterType],
  );

  const childrenMap = useMemo(() => buildChildrenMap(pages), [pages]);

  const visiblePages = useMemo(() => collectSubtree(roots, childrenMap), [roots, childrenMap]);

  const availableTags = useMemo(() => {
    const set = new Set<string>();
    for (const p of visiblePages) for (const t of p.tags) set.add(t);
    return Array.from(set).sort();
  }, [visiblePages]);

  const term = search.trim().toLowerCase();
  const isFiltering = term.length > 0 || activeTags.size > 0;

  const filteredPages = useMemo(() => {
    if (!isFiltering) return visiblePages;
    return visiblePages
      .filter((p) => {
        const matchesTerm =
          !term ||
          p.title.toLowerCase().includes(term) ||
          p.content.toLowerCase().includes(term) ||
          p.tags.some((t) => t.toLowerCase().includes(term));
        const matchesTags = activeTags.size === 0 || p.tags.some((t) => activeTags.has(t));
        return matchesTerm && matchesTags;
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [visiblePages, isFiltering, term, activeTags]);

  function toggleTag(tag: string) {
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{slugLabel(slug)}</h1>
          <p className="text-sm text-muted-foreground">
            {isAll
              ? "Every page across the knowledge base."
              : `Top-level ${slugLabel(slug).toLowerCase()} pages, with nested child pages underneath.`}
          </p>
        </div>
        <CreatePageDialog
          allPages={pages}
          defaultType={filterType ?? "notes"}
          typeLocked={!isAll}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="max-w-xs">
          <InputGroupAddon>
            <Search className="size-4 text-muted-foreground" />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Search title, content, tags…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </InputGroup>
        {availableTags.map((tag) => (
          <Badge
            key={tag}
            variant={activeTags.has(tag) ? "default" : "outline"}
            className="cursor-pointer select-none"
            role="button"
            tabIndex={0}
            onClick={() => toggleTag(tag)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggleTag(tag);
              }
            }}
          >
            {tag}
          </Badge>
        ))}
        {isFiltering && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setActiveTags(new Set());
            }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="size-3" />
            Clear filters
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-3/4" />
        </div>
      ) : roots.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          No {slugLabel(slug).toLowerCase()} pages yet. Create the first one.
        </div>
      ) : isFiltering ? (
        <KnowledgePageFlatList pages={filteredPages} allPages={pages} showTypeBadge={isAll} />
      ) : (
        <KnowledgePageTree roots={roots} childrenMap={childrenMap} allPages={pages} showTypeBadge={isAll} />
      )}
    </div>
  );
}
