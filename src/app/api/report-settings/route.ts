import { NextRequest, NextResponse } from "next/server";
import { getAppDataSource } from "@/lib/data/runtime";
import { dataErrorResponse, NO_STORE_HEADERS } from "@/lib/data/route-utils";
import { DEFAULT_REPORT_SETTINGS, type ReportSettings } from "@/lib/reports/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function environmentSettings(): ReportSettings {
  return {
    ...DEFAULT_REPORT_SETTINGS,
    contractorName: process.env.REPORT_CONTRACTOR_NAME || DEFAULT_REPORT_SETTINGS.contractorName,
    businessName: process.env.REPORT_BUSINESS_NAME || DEFAULT_REPORT_SETTINGS.businessName,
    email: process.env.REPORT_EMAIL || "",
    phone: process.env.REPORT_PHONE || "",
    address: process.env.REPORT_ADDRESS || "",
    // No new env vars: website/invoiceFooter/paymentInstructions use the
    // Battle Bound Branding defaults in Notion mode; editable in mock mode only.
    website: DEFAULT_REPORT_SETTINGS.website,
    defaultHourlyRate: Number(process.env.REPORT_DEFAULT_HOURLY_RATE || DEFAULT_REPORT_SETTINGS.defaultHourlyRate),
    defaultPaymentTerms: process.env.REPORT_DEFAULT_PAYMENT_TERMS || DEFAULT_REPORT_SETTINGS.defaultPaymentTerms,
    defaultInvoiceNotes: process.env.REPORT_DEFAULT_INVOICE_NOTES || DEFAULT_REPORT_SETTINGS.defaultInvoiceNotes,
    logoPath: process.env.REPORT_LOGO_PATH || DEFAULT_REPORT_SETTINGS.logoPath,
    invoiceFooter: DEFAULT_REPORT_SETTINGS.invoiceFooter,
    paymentInstructions: DEFAULT_REPORT_SETTINGS.paymentInstructions,
    clientDisplayName: process.env.REPORT_CLIENT_DISPLAY_NAME || "",
    clientBillingContact: process.env.REPORT_CLIENT_BILLING_CONTACT || "",
    clientBillingEmail: process.env.REPORT_CLIENT_BILLING_EMAIL || "",
  };
}

export async function GET() {
  try {
    if (getAppDataSource() === "notion") return NextResponse.json(environmentSettings(), { headers: NO_STORE_HEADERS });
    const { initDb, reportSettingsRepo } = await import("@/lib/db");
    initDb();
    return NextResponse.json(reportSettingsRepo.get(), { headers: NO_STORE_HEADERS });
  } catch (error) { return dataErrorResponse(error); }
}

export async function PATCH(request: NextRequest) {
  try {
    if (getAppDataSource() === "notion") {
      return NextResponse.json({ error: "Report settings are environment-managed in Notion production mode." }, { status: 405 });
    }
    const { initDb, reportSettingsRepo } = await import("@/lib/db");
    initDb();
    const body = await request.json().catch(() => null) as ReportSettings | null;
    if (!body || !body.contractorName?.trim() || !Number.isFinite(Number(body.defaultHourlyRate)) || Number(body.defaultHourlyRate) < 0) {
      return NextResponse.json({ error: "Invalid report settings." }, { status: 400 });
    }
    return NextResponse.json(reportSettingsRepo.save({ ...body, defaultHourlyRate: Number(body.defaultHourlyRate) }));
  } catch (error) { return dataErrorResponse(error); }
}

