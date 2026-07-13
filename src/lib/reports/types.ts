export type ReportType = "simple-invoice" | "detailed-invoice" | "work-log-report";

export type ReportDataSource = "local-mock" | "historical-preview" | "notion";

export interface ReportClient {
  id: string;
  name: string;
  defaultHourlyRate: number;
}

export interface ReportProject {
  id: string;
  clientId: string;
  name: string;
}

export interface ReportHoursRecord {
  id: string;
  clientId: string;
  projectId: string | null;
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  hourlyRate: number;
  billable: boolean;
  relatedWorkLogId: string | null;
  relatedWorkDoneIds?: string[];
  migrationKey?: string | null;
  billingStatus?: string | null;
  invoiceReportId?: string | null;
}

export interface ReportWorkRecord {
  id: string;
  clientId: string;
  projectId: string | null;
  date: string;
  title: string;
  summary: string;
  detailedWorkDescription: string;
  /** Never copied into a composed report or serializer output. */
  internalNotes: string;
  status: "not-started" | "in-progress" | "blocked" | "done";
  clientVisible: boolean | null;
  includeInInvoice: boolean | null;
  includeInWorkReport: boolean | null;
  evidenceLinks: string[];
  relatedHoursIds: string[];
  deliverables: string[];
  testingPerformed: string[];
  blockers: string[];
  followUpItems: string[];
  approvalStatus?: string | null;
}

export interface ReportKnowledgeRecord {
  id: string;
  clientId: string | null;
  projectId: string | null;
  title: string;
  reportSummary: string;
  /** Never copied into a composed report or serializer output. */
  internalNotes: string;
  clientVisible: boolean | null;
  includeInWorkReport: boolean | null;
  sourcePage: string | null;
}

export interface ReportDataset {
  source: ReportDataSource;
  label: string;
  description: string;
  clients: ReportClient[];
  projects: ReportProject[];
  hours: ReportHoursRecord[];
  workRecords: ReportWorkRecord[];
  knowledgeRecords: ReportKnowledgeRecord[];
}

export interface ReportSettings {
  contractorName: string;
  businessName: string;
  email: string;
  phone: string;
  address: string;
  defaultHourlyRate: number;
  defaultPaymentTerms: string;
  defaultInvoiceNotes: string;
  logoPath: string;
  clientDisplayName: string;
  clientBillingContact: string;
  clientBillingEmail: string;
}

export interface ReportBuilderInput {
  type: ReportType;
  clientId: string;
  periodStart: string;
  periodEnd: string;
  projectIds: string[];
  invoiceNumber: string;
  invoiceDate: string;
  paymentTerms: string;
  dueDate: string;
  customTitle: string;
  notes: string;
  executiveSummary: string;
  draftDescriptions: Record<string, string>;
  /** When viewing an existing invoice, allow its already-invoiced hours */
  viewingInvoiceId?: string | null;
}

export interface ReportExcludedRecord {
  id: string;
  kind: "hours" | "work-done" | "knowledge";
  title: string;
  reason: string;
  matchSource?: string;
}

export interface ReportIncludedRecord {
  id: string;
  kind: "hours" | "work-done" | "knowledge";
  title: string;
}

export interface ReportSessionLine {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  exactMinutes: number;
  projectId: string | null;
  projectName: string;
  description: string;
  hourlyRate: number;
  billable: boolean;
  amount: number;
}

export interface ReportSubtotal {
  key: string;
  label: string;
  exactMinutes: number;
  amount: number;
}

export interface ReportWorkItem {
  id: string;
  date: string;
  title: string;
  description: string;
  projectName: string;
  status: ReportWorkRecord["status"];
  evidenceLinks: string[];
  deliverables: string[];
  testingPerformed: string[];
  blockers: string[];
  followUpItems: string[];
  relatedHoursMinutes: number;
}

export interface ReportKnowledgeItem {
  id: string;
  title: string;
  summary: string;
  projectName: string;
  sourcePage: string | null;
}

/** Safe, exportable document. It intentionally has no internal-notes property. */
export interface ReportDocument {
  schemaVersion: 1;
  type: ReportType;
  title: string;
  source: { type: ReportDataSource; label: string };
  generatedForPreviewAt: string;
  client: {
    name: string;
    billingContact: string;
    billingEmail: string;
  };
  contractor: {
    name: string;
    businessName: string;
    email: string;
    phone: string;
    address: string;
    logoPath: string;
  };
  invoice: {
    number: string;
    invoiceDate: string;
    periodStart: string;
    periodEnd: string;
    paymentTerms: string;
    dueDate: string;
    notes: string;
  };
  summary: string;
  sessions: ReportSessionLine[];
  projectTotals: ReportSubtotal[];
  dailyTotals: ReportSubtotal[];
  workItems: ReportWorkItem[];
  knowledgeItems: ReportKnowledgeItem[];
  totals: {
    billableMinutes: number;
    nonBillableMinutes: number;
    amountDue: number;
    hourlyRates: number[];
  };
  includedRecords: ReportIncludedRecord[];
  excludedRecords: ReportExcludedRecord[];
  warnings: string[];
}

export const DEFAULT_REPORT_SETTINGS: ReportSettings = {
  contractorName: "Austin Brower",
  businessName: "",
  email: "",
  phone: "",
  address: "",
  defaultHourlyRate: 30,
  defaultPaymentTerms: "Net 15",
  defaultInvoiceNotes: "Thank you for your business.",
  logoPath: "",
  clientDisplayName: "",
  clientBillingContact: "",
  clientBillingEmail: "",
};

