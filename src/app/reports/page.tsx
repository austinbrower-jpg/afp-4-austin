import { ReportBuilder } from "@/features/reports/components/report-builder";

export default function ReportsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Report Builder</h1>
        <p className="text-muted-foreground">Compose privacy-filtered invoices and detailed work reports without changing source records.</p>
      </div>
      <ReportBuilder />
    </div>
  );
}

