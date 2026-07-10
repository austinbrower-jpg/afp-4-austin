import { NextResponse } from "next/server";
import { getReportBuilderData } from "@/lib/reports/data-source";
import { dataErrorResponse, NO_STORE_HEADERS } from "@/lib/data/route-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Read-only source projection. Preview and export remain entirely client-side. */
export async function GET() {
  try {
    return NextResponse.json(await getReportBuilderData(), { headers: NO_STORE_HEADERS });
  } catch (error) {
    return dataErrorResponse(error);
  }
}
