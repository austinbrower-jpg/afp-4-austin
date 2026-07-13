import { NextResponse } from "next/server";
import { getDataProvider } from "@/lib/data/provider";
import { dataErrorResponse, NO_STORE_HEADERS } from "@/lib/data/route-utils";
import { buildClientBillingHistory, summarizeInvoiceDashboard } from "@/lib/invoices/dashboard";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function GET() { try { const p=await getDataProvider(); const [clients,invoices,hours,workLogs]=await Promise.all([p.clients.list(),p.invoices.list(),p.hours.list(),p.workLogs.list()]); return NextResponse.json({ summary: summarizeInvoiceDashboard(invoices,hours), clients: buildClientBillingHistory(clients,invoices,hours,workLogs) }, { headers: NO_STORE_HEADERS }); } catch(e) { return dataErrorResponse(e); } }
