import { NextRequest, NextResponse } from "next/server";
import { getDataProvider } from "@/lib/data/provider";
import { dataErrorResponse, NO_STORE_HEADERS } from "@/lib/data/route-utils";
import { searchInvoices } from "@/lib/invoices/search";
export const runtime="nodejs"; export const dynamic="force-dynamic";
export async function GET(request: NextRequest) { try { const q=request.nextUrl.searchParams.get("q") ?? ""; const p=await getDataProvider(); const [invoices,clients,projects,hours,workLogs]=await Promise.all([p.invoices.list(),p.clients.list(),p.projects.list(),p.hours.list(),p.workLogs.list()]); return NextResponse.json(searchInvoices(invoices,{clients,projects,hours,workLogs},q), { headers: NO_STORE_HEADERS }); } catch(e) { return dataErrorResponse(e); } }
