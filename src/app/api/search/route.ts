import { NextRequest, NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { hoursRepo } from "@/lib/db/repositories/hours";
import { workLogRepo } from "@/lib/db/repositories/worklogs";
import { projectRepo } from "@/lib/db/repositories/projects";
import { knowledgeRepo } from "@/lib/db/repositories/knowledge";
import { invoiceRepo } from "@/lib/db/repositories/invoices";

import type { SearchResultItem } from "@/types/api";

export type { SearchResultItem };

function matches(term: string, ...fields: (string | null | undefined)[]): boolean {
  const lower = term.toLowerCase();
  return fields.some((f) => (f ?? "").toLowerCase().includes(lower));
}

export async function GET(request: NextRequest) {
  initDb();
  const term = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (term.length < 2) {
    return NextResponse.json<SearchResultItem[]>([]);
  }

  const results: SearchResultItem[] = [];

  for (const p of projectRepo.all()) {
    if (matches(term, p.name, p.description, ...p.tags)) {
      results.push({
        id: p.id,
        type: "project",
        title: p.name,
        subtitle: p.description || "Project",
        href: `/projects/${p.id}`,
      });
    }
  }

  for (const w of workLogRepo.all()) {
    if (matches(term, w.title, w.summary, w.detailedNotes, w.invoiceDescription)) {
      results.push({
        id: w.id,
        type: "worklog",
        title: w.title,
        subtitle: `Work log - ${w.date}`,
        href: `/work-done/${w.id}`,
      });
    }
  }

  for (const k of knowledgeRepo.all()) {
    if (matches(term, k.title, k.content, ...k.tags)) {
      results.push({
        id: k.id,
        type: "knowledge",
        title: k.title,
        subtitle: `${k.type} - Work Stuff`,
        href: `/knowledge/page/${k.id}`,
      });
    }
  }

  for (const h of hoursRepo.all()) {
    if (matches(term, h.notes, h.location, h.date)) {
      results.push({
        id: h.id,
        type: "hours",
        title: `${h.date} - ${h.startTime}–${h.endTime}`,
        subtitle: h.notes || h.location || "Hours entry",
        href: `/hours?entry=${h.id}`,
      });
    }
  }

  for (const i of invoiceRepo.all()) {
    if (matches(term, i.invoiceNumber, i.summary)) {
      results.push({
        id: i.id,
        type: "invoice",
        title: i.invoiceNumber,
        subtitle: `Invoice - ${i.periodStart} to ${i.periodEnd}`,
        href: `/invoices/${i.id}`,
      });
    }
  }

  return NextResponse.json<SearchResultItem[]>(results.slice(0, 50));
}
