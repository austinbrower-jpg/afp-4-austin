import { NextResponse } from "next/server";
import { getDataProvider } from "@/lib/data/provider";
import { dataErrorResponse, NO_STORE_HEADERS } from "@/lib/data/route-utils";
import { buildInvoiceDashboardData } from "@/lib/invoices/dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  try {
    const provider = await getDataProvider();
    const [clients, invoices, hours, workLogs] = await Promise.all([
      provider.clients.list(),
      provider.invoices.list(),
      provider.hours.list(),
      provider.workLogs.list(),
    ]);
    const result = buildInvoiceDashboardData(clients, invoices, hours, workLogs);
    const skipped = Object.values(result.skipped).reduce((total, count) => total + count, 0);
    console.info("[invoice-dashboard] completed", {
      durationMs: Date.now() - startedAt,
      clients: result.data.clients.length,
      skippedRecords: skipped,
    });
    return NextResponse.json(result.data, { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.warn("[invoice-dashboard] failed", {
      durationMs: Date.now() - startedAt,
      category: error instanceof Error ? error.name : "unexpected",
    });
    return dataErrorResponse(error, "Invoice Dashboard data could not be loaded.");
  }
}
