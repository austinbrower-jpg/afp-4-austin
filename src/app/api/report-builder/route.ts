import { NextResponse } from "next/server";
import { getReportBuilderData } from "@/lib/reports/data-source";
import { dataErrorResponse, NO_STORE_HEADERS } from "@/lib/data/route-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Read-only source projection. Preview and export remain entirely client-side. */
export async function GET() {
  const startedAt = Date.now();
  try {
    const data = await getReportBuilderData();
    console.info("[report-builder] completed", {
      durationMs: Date.now() - startedAt,
      datasets: data.datasets.length,
      currentHours: data.datasets[0]?.hours.length ?? 0,
    });
    return NextResponse.json(data, { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.warn("[report-builder] failed", {
      durationMs: Date.now() - startedAt,
      category: error instanceof Error ? error.name : "unexpected",
    });
    return dataErrorResponse(error, "Report Builder data could not be loaded.");
  }
}
