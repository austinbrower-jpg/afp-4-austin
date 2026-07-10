import { NextResponse } from "next/server";
import { getReportBuilderData } from "@/lib/reports/data-source";

/** Read-only source projection. Preview and export remain entirely client-side. */
export async function GET() {
  return NextResponse.json(getReportBuilderData());
}

