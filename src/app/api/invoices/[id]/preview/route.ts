import { NextRequest, NextResponse } from "next/server";
import { getDataProvider } from "@/lib/data/provider";
import { dataErrorResponse, NO_STORE_HEADERS } from "@/lib/data/route-utils";
import { buildSavedInvoiceViewFromProvider } from "@/lib/invoices/invoice-saved-view";
import { getReportSettings } from "@/lib/reports/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

/** Read-only preview of a saved invoice using only its Included Hours and Work Done. */
export async function GET(_request: NextRequest, { params }: Context) {
  try {
    const provider = await getDataProvider();
    const invoice = await provider.invoices.findById((await params).id);
    if (!invoice) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
    const settings = await getReportSettings();
    const savedView = await buildSavedInvoiceViewFromProvider(invoice, provider, settings);
    return NextResponse.json(
      {
        report: savedView.report,
        immutableTotals: savedView.immutableTotals,
        liveDriftWarnings: savedView.liveDriftWarnings,
        relationWarnings: savedView.warnings,
        writesPerformed: false,
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    return dataErrorResponse(error);
  }
}
