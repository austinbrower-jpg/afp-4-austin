import { getAppDataSource } from "@/lib/data/runtime";
import { DEFAULT_REPORT_SETTINGS, type ReportSettings } from "@/lib/reports/types";

function environmentSettings(): ReportSettings {
  return {
    ...DEFAULT_REPORT_SETTINGS,
    contractorName: process.env.REPORT_CONTRACTOR_NAME || DEFAULT_REPORT_SETTINGS.contractorName,
    businessName: process.env.REPORT_BUSINESS_NAME || "",
    email: process.env.REPORT_EMAIL || "",
    phone: process.env.REPORT_PHONE || "",
    address: process.env.REPORT_ADDRESS || "",
    defaultHourlyRate: Number(process.env.REPORT_DEFAULT_HOURLY_RATE || DEFAULT_REPORT_SETTINGS.defaultHourlyRate),
    defaultPaymentTerms: process.env.REPORT_DEFAULT_PAYMENT_TERMS || DEFAULT_REPORT_SETTINGS.defaultPaymentTerms,
    defaultInvoiceNotes: process.env.REPORT_DEFAULT_INVOICE_NOTES || DEFAULT_REPORT_SETTINGS.defaultInvoiceNotes,
    logoPath: process.env.REPORT_LOGO_PATH || "",
    clientDisplayName: process.env.REPORT_CLIENT_DISPLAY_NAME || "",
    clientBillingContact: process.env.REPORT_CLIENT_BILLING_CONTACT || "",
    clientBillingEmail: process.env.REPORT_CLIENT_BILLING_EMAIL || "",
  };
}

export async function getReportSettings(): Promise<ReportSettings> {
  if (getAppDataSource() === "notion") return environmentSettings();
  const { initDb, reportSettingsRepo } = await import("@/lib/db");
  initDb();
  return reportSettingsRepo.get();
}
