import { NextResponse } from "next/server";
import { buildRelationBackfillPreview } from "@/lib/notion/relation-backfill/preview";
import { getDataProvider } from "@/lib/data/provider";
import { NO_STORE_HEADERS } from "@/lib/data/route-utils";
import type { LiveNotionRow } from "@/lib/notion/relation-backfill/preview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Read-only July 8–10 relation backfill preview. GET only — no writes. */
export async function GET() {
  const liveRows: LiveNotionRow[] = [];
  try {
    const provider = await getDataProvider();
    if (provider.mode === "notion") {
      const [hours, workLogs, projects, clients] = await Promise.all([
        provider.hours.list(),
        provider.workLogs.list(),
        provider.projects.list(),
        provider.clients.list(),
      ]);
      const projectMap = new Map(projects.map((p) => [p.id, p.name]));
      const clientMap = new Map(clients.map((c) => [c.id, c.name]));
      const jul8_10 = (date: string) => date >= "2026-07-08" && date <= "2026-07-10";

      for (const entry of hours.filter((h) => jul8_10(h.date))) {
        liveRows.push({
          id: entry.id,
          url: entry.notionUrl,
          entity: "hours",
          date: entry.date,
          startTime: entry.startTime,
          endTime: entry.endTime,
          migrationKey: entry.externalId,
          sessionId: entry.sessionId ?? null,
          billingStatus: entry.billingStatus ?? null,
          projectId: entry.projectId,
          projectName: entry.projectId ? projectMap.get(entry.projectId) ?? null : null,
          clientId: entry.clientId,
          clientName: clientMap.get(entry.clientId) ?? null,
          relatedWorkDoneIds: entry.relatedWorkLogId ? [entry.relatedWorkLogId] : entry.relatedWorkDoneIds ?? [],
          billable: entry.billable,
        });
      }
      for (const log of workLogs.filter((w) => jul8_10(w.date))) {
        liveRows.push({
          id: log.id,
          url: log.notionUrl,
          entity: "work-done",
          date: log.date,
          title: log.title,
          workLogId: log.workLogId ?? null,
          approvalStatus: log.approvalStatus ?? null,
          projectId: log.projectId,
          projectName: log.projectId ? projectMap.get(log.projectId) ?? null : null,
          clientId: log.clientId,
          clientName: clientMap.get(log.clientId) ?? null,
          relatedHoursIds: log.relatedHoursIds,
        });
      }
    }
  } catch {
    // Preview still works from canonical source when Notion is unavailable.
  }

  const preview = buildRelationBackfillPreview(liveRows);
  return NextResponse.json(preview, { headers: NO_STORE_HEADERS });
}
