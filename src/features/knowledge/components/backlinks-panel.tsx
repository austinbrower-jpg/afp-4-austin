"use client";

import Link from "next/link";
import { FileStack, Link2, ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { KnowledgePage } from "@/types/domain";
import { findInboundWikiLinks } from "../lib/wiki-links";
import { KnowledgeTypeBadge } from "./knowledge-type-badge";

interface BacklinksPanelProps {
  page: KnowledgePage;
  allPages: KnowledgePage[];
  childPages: KnowledgePage[];
}

function PageLink({ page }: { page: KnowledgePage }) {
  return (
    <Link
      href={`/knowledge/page/${page.id}`}
      className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60"
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate">{page.title}</span>
        <KnowledgeTypeBadge type={page.type} className="shrink-0" />
      </span>
      <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground" />
    </Link>
  );
}

function Section({
  icon: Icon,
  title,
  items,
  emptyLabel,
}: {
  icon: typeof FileStack;
  title: string;
  items: KnowledgePage[];
  emptyLabel: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5" />
        {title}
      </div>
      {items.length === 0 ? (
        <p className="px-2 py-1 text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="flex flex-col">
          {items.map((p) => (
            <PageLink key={p.id} page={p} />
          ))}
        </div>
      )}
    </div>
  );
}

export function BacklinksPanel({ page, allPages, childPages }: BacklinksPanelProps) {
  const byId = new Map(allPages.map((p) => [p.id, p]));
  const linksTo = page.backlinkIds.map((id) => byId.get(id)).filter((p): p is KnowledgePage => Boolean(p));
  const linkedFrom = findInboundWikiLinks(page, allPages);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Connections</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Section icon={FileStack} title="Child pages" items={childPages} emptyLabel="No child pages." />
        <Section icon={Link2} title="Links to" items={linksTo} emptyLabel="No outbound links." />
        <Section
          icon={ArrowUpRight}
          title="Linked from"
          items={linkedFrom}
          emptyLabel="No pages reference this one via [[wiki links]]."
        />
      </CardContent>
    </Card>
  );
}
