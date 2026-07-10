import { NextRequest, NextResponse } from "next/server";
import { getDataProvider } from "@/lib/data/provider";
import { dataErrorResponse, NO_STORE_HEADERS } from "@/lib/data/route-utils";
import type { SearchResultItem } from "@/types/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const matches = (term: string, ...fields: Array<string | null | undefined>) => fields.some((field) => (field ?? "").toLowerCase().includes(term));

export async function GET(request: NextRequest) {
  try {
    const term = request.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";
    if (term.length < 2) return NextResponse.json([], { headers: NO_STORE_HEADERS });
    const provider = await getDataProvider();
    const [projects, workLogs, knowledge, hours, invoices] = await Promise.all([
      provider.projects.list(), provider.workLogs.list(), provider.knowledge.list(), provider.hours.list(), provider.invoices.list(),
    ]);
    const results: SearchResultItem[] = [];
    projects.filter((item) => matches(term, item.name, item.description, ...item.tags)).forEach((item) => results.push({ id: item.id, type: "project", title: item.name, subtitle: item.description || "Project", href: `/projects/${item.id}` }));
    workLogs.filter((item) => matches(term, item.title, item.summary, item.detailedNotes, item.invoiceDescription)).forEach((item) => results.push({ id: item.id, type: "worklog", title: item.title, subtitle: `Work log - ${item.date}`, href: `/work-done/${item.id}` }));
    knowledge.filter((item) => matches(term, item.title, item.content, ...item.tags)).forEach((item) => results.push({ id: item.id, type: "knowledge", title: item.title, subtitle: `${item.type} - Work Stuff`, href: `/knowledge/page/${item.id}` }));
    hours.filter((item) => matches(term, item.notes, item.location, item.date)).forEach((item) => results.push({ id: item.id, type: "hours", title: `${item.date} - ${item.startTime}–${item.endTime}`, subtitle: item.notes || item.location || "Hours entry", href: `/hours?entry=${item.id}` }));
    invoices.filter((item) => matches(term, item.invoiceNumber, item.summary)).forEach((item) => results.push({ id: item.id, type: "invoice", title: item.invoiceNumber, subtitle: `Invoice - ${item.periodStart} to ${item.periodEnd}`, href: `/invoices/${item.id}` }));
    return NextResponse.json(results.slice(0, 50), { headers: NO_STORE_HEADERS });
  } catch (error) { return dataErrorResponse(error); }
}
