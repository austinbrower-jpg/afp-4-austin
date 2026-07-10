import "server-only";
import { getDb } from "../client";
import { DEFAULT_REPORT_SETTINGS, type ReportSettings } from "@/lib/reports/types";

type Row = Record<string, unknown>;

function fromRow(row: Row): ReportSettings {
  return {
    contractorName: row.contractor_name as string,
    businessName: row.business_name as string,
    email: row.email as string,
    phone: row.phone as string,
    address: row.address as string,
    defaultHourlyRate: row.default_hourly_rate as number,
    defaultPaymentTerms: row.default_payment_terms as string,
    defaultInvoiceNotes: row.default_invoice_notes as string,
    logoPath: row.logo_path as string,
    clientDisplayName: row.client_display_name as string,
    clientBillingContact: row.client_billing_contact as string,
    clientBillingEmail: row.client_billing_email as string,
  };
}

export const reportSettingsRepo = {
  get(): ReportSettings {
    const row = getDb().prepare("SELECT * FROM report_settings WHERE id = 'default'").get() as Row | undefined;
    return row ? fromRow(row) : { ...DEFAULT_REPORT_SETTINGS };
  },

  save(settings: ReportSettings): ReportSettings {
    getDb().prepare(`
      INSERT INTO report_settings (
        id, contractor_name, business_name, email, phone, address,
        default_hourly_rate, default_payment_terms, default_invoice_notes,
        logo_path, client_display_name, client_billing_contact, client_billing_email
      ) VALUES (
        'default', @contractorName, @businessName, @email, @phone, @address,
        @defaultHourlyRate, @defaultPaymentTerms, @defaultInvoiceNotes,
        @logoPath, @clientDisplayName, @clientBillingContact, @clientBillingEmail
      ) ON CONFLICT(id) DO UPDATE SET
        contractor_name = excluded.contractor_name,
        business_name = excluded.business_name,
        email = excluded.email,
        phone = excluded.phone,
        address = excluded.address,
        default_hourly_rate = excluded.default_hourly_rate,
        default_payment_terms = excluded.default_payment_terms,
        default_invoice_notes = excluded.default_invoice_notes,
        logo_path = excluded.logo_path,
        client_display_name = excluded.client_display_name,
        client_billing_contact = excluded.client_billing_contact,
        client_billing_email = excluded.client_billing_email
    `).run(settings);
    return { ...settings };
  },
};

