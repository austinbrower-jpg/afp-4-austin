import { NextRequest, NextResponse } from "next/server";
import { initDb, reportSettingsRepo } from "@/lib/db";
import { DEFAULT_REPORT_SETTINGS, type ReportSettings } from "@/lib/reports/types";

export async function GET() {
  initDb();
  return NextResponse.json<ReportSettings>(reportSettingsRepo.get());
}

export async function PATCH(request: NextRequest) {
  initDb();
  const body = await request.json().catch(() => null) as Partial<ReportSettings> | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const current = reportSettingsRepo.get();
  const textKeys: Array<Exclude<keyof ReportSettings, "defaultHourlyRate">> = [
    "contractorName",
    "businessName",
    "email",
    "phone",
    "address",
    "defaultPaymentTerms",
    "defaultInvoiceNotes",
    "logoPath",
    "clientDisplayName",
    "clientBillingContact",
    "clientBillingEmail",
  ];
  const next = { ...current };
  for (const key of textKeys) {
    if (body[key] !== undefined) {
      if (typeof body[key] !== "string") {
        return NextResponse.json({ error: `${key} must be a string` }, { status: 400 });
      }
      next[key] = body[key];
    }
  }
  if (body.defaultHourlyRate !== undefined) {
    const rate = Number(body.defaultHourlyRate);
    if (!Number.isFinite(rate) || rate < 0) {
      return NextResponse.json({ error: "defaultHourlyRate must be non-negative" }, { status: 400 });
    }
    next.defaultHourlyRate = rate;
  }
  if (!next.contractorName.trim()) next.contractorName = DEFAULT_REPORT_SETTINGS.contractorName;
  return NextResponse.json<ReportSettings>(reportSettingsRepo.save(next));
}

