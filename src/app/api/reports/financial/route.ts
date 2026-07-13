import { NextResponse } from "next/server";
import { getDataProvider } from "@/lib/data/provider";
import { dataErrorResponse, NO_STORE_HEADERS } from "@/lib/data/route-utils";
import { clientRevenueReport, hoursByProjectReport, invoiceAgingReport, monthlyRevenueReport, projectProfitabilityReport } from "@/lib/reports/reporting";
export const runtime="nodejs"; export const dynamic="force-dynamic";
export async function GET() { try { const p=await getDataProvider(); const [clients,projects,invoices,hours]=await Promise.all([p.clients.list(),p.projects.list(),p.invoices.list(),p.hours.list()]); return NextResponse.json({ monthlyRevenue: monthlyRevenueReport(invoices), clientRevenue: clientRevenueReport(clients,invoices), projectProfitability: projectProfitabilityReport(projects,hours), hoursByProject: hoursByProjectReport(projects,hours), invoiceAging: invoiceAgingReport(invoices) }, { headers: NO_STORE_HEADERS }); } catch(e) { return dataErrorResponse(e); } }
