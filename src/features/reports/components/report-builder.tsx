"use client";

import { useState } from "react";
import { addDays, format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Database, Eye, LockKeyhole } from "lucide-react";
import { apiGet } from "@/lib/api-client/http";
import { composeReport } from "@/lib/reports/engine";
import { useBrowserReportSettings } from "@/features/reports/lib/browser-report-settings";
import type { ReportBuilderData } from "@/lib/reports/data-source";
import type {
  ReportBuilderInput,
  ReportDataSource,
  ReportDataset,
  ReportSettings,
  ReportType,
} from "@/lib/reports/types";
import { DEFAULT_REPORT_SETTINGS } from "@/lib/reports/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ReportExportActions } from "./report-export-actions";
import { ReportPreview } from "./report-preview";
import { InvoiceSavePanel } from "./invoice-save-panel";

interface BuilderState extends ReportBuilderInput {
  source: ReportDataSource;
}

const REPORT_LABELS: Record<ReportType, string> = {
  "simple-invoice": "Simple Invoice",
  "detailed-invoice": "Detailed Invoice",
  "work-log-report": "Work Log Report",
};

function dateBounds(dataset: ReportDataset): { start: string; end: string } {
  const dates = dataset.hours.map((entry) => entry.date).sort();
  const today = format(new Date(), "yyyy-MM-dd");
  return { start: dates[0] ?? today, end: dates.at(-1) ?? today };
}

function makeInitialState(
  dataset: ReportDataset,
  source: ReportDataSource,
  settings: ReportSettings,
): BuilderState {
  const bounds = dateBounds(dataset);
  const invoiceDate = format(new Date(), "yyyy-MM-dd");
  return {
    source,
    type: "simple-invoice",
    clientId: dataset.clients[0]?.id ?? "",
    periodStart: bounds.start,
    periodEnd: bounds.end,
    projectIds: [],
    invoiceNumber: `AFP-${invoiceDate.slice(0, 4)}-001`,
    invoiceDate,
    paymentTerms: settings.defaultPaymentTerms,
    dueDate: format(addDays(new Date(`${invoiceDate}T12:00:00`), 15), "yyyy-MM-dd"),
    customTitle: "",
    notes: settings.defaultInvoiceNotes,
    executiveSummary: "",
    draftDescriptions: {},
  };
}

function LoadingBuilder() {
  return <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]"><Skeleton className="h-[720px]" /><Skeleton className="h-[900px]" /></div>;
}

export function ReportBuilder() {
  const builderQuery = useQuery({
    queryKey: ["report-builder-data"],
    queryFn: () => apiGet<ReportBuilderData>("/api/report-builder"),
  });
  const settingsQuery = useQuery({
    queryKey: ["report-settings"],
    queryFn: () => apiGet<ReportSettings>("/api/report-settings"),
  });
  const settings = useBrowserReportSettings(
    settingsQuery.data ?? DEFAULT_REPORT_SETTINGS,
    builderQuery.data?.recommendedSource === "notion",
  );
  const [state, setState] = useState<BuilderState | null>(null);
  const [hasPreview, setHasPreview] = useState(true);
  if (builderQuery.data && settingsQuery.data && state === null) {
    const source = builderQuery.data.recommendedSource;
    const dataset = builderQuery.data.datasets.find((candidate) => candidate.source === source)!;
    setState(makeInitialState(dataset, source, settings));
  }

  if (builderQuery.isError || settingsQuery.isError) {
    return <Alert variant="destructive"><AlertTriangle /><AlertTitle>Report data could not be loaded</AlertTitle><AlertDescription>{builderQuery.error?.message || settingsQuery.error?.message}</AlertDescription></Alert>;
  }
  if (builderQuery.isLoading || settingsQuery.isLoading || !state || !builderQuery.data || !settingsQuery.data) {
    return <LoadingBuilder />;
  }

  const dataset = builderQuery.data.datasets.find((candidate) => candidate.source === state.source)!;
  const clientProjects = dataset.projects.filter((project) => project.clientId === state.clientId);
  const report = composeReport(dataset, settings, state);
  const approvedDraftRecords = dataset.workRecords.filter((record) => {
    if (record.clientId !== state.clientId || record.date < state.periodStart || record.date > state.periodEnd) return false;
    if (record.clientVisible !== true) return false;
    if (state.type === "work-log-report" ? record.includeInWorkReport !== true : record.includeInInvoice !== true) return false;
    if (state.projectIds.length === 0) return true;
    if (record.projectId && state.projectIds.includes(record.projectId)) return true;
    return record.relatedHoursIds.some((id) => {
      const hours = dataset.hours.find((candidate) => candidate.id === id);
      return !!hours?.projectId && state.projectIds.includes(hours.projectId);
    });
  });

  const update = <K extends keyof BuilderState>(key: K, value: BuilderState[K]) => {
    setHasPreview(true);
    setState({ ...state, [key]: value });
  };
  const changeSource = (source: ReportDataSource) => {
    const next = builderQuery.data!.datasets.find((candidate) => candidate.source === source)!;
    setState({ ...makeInitialState(next, source, settings), type: state.type });
    setHasPreview(true);
  };
  const changeClient = (clientId: string) => {
    setHasPreview(true);
    setState({
      ...state,
      clientId,
      projectIds: [],
      draftDescriptions: {},
    });
  };
  const toggleProject = (id: string, checked: boolean) => update(
    "projectIds",
    checked ? [...state.projectIds, id] : state.projectIds.filter((projectId) => projectId !== id),
  );

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[390px_minmax(0,1fr)]">
      <aside className="space-y-5 xl:sticky xl:top-20">
        <Card>
          <CardHeader><CardTitle>Report setup</CardTitle><CardDescription>Filters and draft edits affect only this preview.</CardDescription></CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5"><Label>Data source</Label><Select value={state.source} onValueChange={(value) => changeSource(value as ReportDataSource)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{builderQuery.data.datasets.map((source) => <SelectItem key={source.source} value={source.source}>{source.label} ({source.hours.length})</SelectItem>)}</SelectContent></Select><div className="rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground"><Database className="mr-1 inline size-3" />{dataset.description}</div></div>
            <div className="space-y-1.5"><Label>Report type</Label><Select value={state.type} onValueChange={(value) => update("type", value as ReportType)}><SelectTrigger className="w-full"><SelectValue>{(value: string) => REPORT_LABELS[value as ReportType]}</SelectValue></SelectTrigger><SelectContent>{Object.entries(REPORT_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Client</Label><Select value={state.clientId} onValueChange={(value) => changeClient(value ?? "")}><SelectTrigger className="w-full"><SelectValue placeholder="No client available" /></SelectTrigger><SelectContent>{dataset.clients.map((client) => <SelectItem value={client.id} key={client.id}>{client.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label htmlFor="report-start">Start date</Label><Input id="report-start" type="date" value={state.periodStart} onChange={(event) => update("periodStart", event.target.value)} /></div><div className="space-y-1.5"><Label htmlFor="report-end">End date</Label><Input id="report-end" type="date" value={state.periodEnd} onChange={(event) => update("periodEnd", event.target.value)} /></div></div>
            <div className="space-y-2"><Label>Projects</Label>{clientProjects.length === 0 ? <p className="text-xs text-muted-foreground">No projects in this source.</p> : clientProjects.map((project) => <label className="flex items-center gap-2 text-sm" key={project.id}><Checkbox checked={state.projectIds.includes(project.id)} onCheckedChange={(checked) => toggleProject(project.id, checked === true)} /><span>{project.name}</span></label>)}<p className="text-xs text-muted-foreground">Leave all unchecked to include every project.</p></div>
            {state.type !== "work-log-report" && <div className="space-y-4 border-t pt-5"><div className="space-y-1.5"><Label htmlFor="invoice-number">Invoice number</Label><Input id="invoice-number" value={state.invoiceNumber} onChange={(event) => update("invoiceNumber", event.target.value)} /></div><div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label htmlFor="invoice-date">Invoice date</Label><Input id="invoice-date" type="date" value={state.invoiceDate} onChange={(event) => update("invoiceDate", event.target.value)} /></div><div className="space-y-1.5"><Label htmlFor="due-date">Due date</Label><Input id="due-date" type="date" value={state.dueDate} onChange={(event) => update("dueDate", event.target.value)} /></div></div><div className="space-y-1.5"><Label htmlFor="payment-terms">Payment terms</Label><Input id="payment-terms" value={state.paymentTerms} onChange={(event) => update("paymentTerms", event.target.value)} /></div></div>}
            <div className="space-y-1.5"><Label htmlFor="custom-title">Custom title <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="custom-title" value={state.customTitle} onChange={(event) => update("customTitle", event.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="report-summary">{state.type === "work-log-report" ? "Executive summary" : "Brief summary"} <span className="font-normal text-muted-foreground">(optional)</span></Label><Textarea id="report-summary" className="min-h-24" placeholder="Auto-generated when blank" value={state.executiveSummary} onChange={(event) => update("executiveSummary", event.target.value)} /></div>
            {state.type !== "work-log-report" && <div className="space-y-1.5"><Label htmlFor="invoice-notes">Invoice notes <span className="font-normal text-muted-foreground">(optional)</span></Label><Textarea id="invoice-notes" value={state.notes} onChange={(event) => update("notes", event.target.value)} /></div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Draft descriptions</CardTitle><CardDescription>Copied into report state only; source records are never updated.</CardDescription></CardHeader>
          <CardContent className="space-y-4">{approvedDraftRecords.length === 0 ? <p className="text-sm text-muted-foreground">No approved Work Done descriptions match these filters.</p> : approvedDraftRecords.map((record) => <div className="space-y-1.5" key={record.id}><Label htmlFor={`draft-${record.id}`}>{record.date} · {record.title}</Label><Textarea id={`draft-${record.id}`} className="min-h-24 text-xs" value={state.draftDescriptions[record.id] ?? record.detailedWorkDescription} onChange={(event) => update("draftDescriptions", { ...state.draftDescriptions, [record.id]: event.target.value })} /></div>)}</CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Included & excluded</CardTitle><CardDescription>Privacy decisions remain visible before export.</CardDescription></CardHeader>
          <CardContent><Tabs defaultValue="included"><TabsList className="w-full"><TabsTrigger value="included">Included ({report.includedRecords.length})</TabsTrigger><TabsTrigger value="excluded">Excluded ({report.excludedRecords.length})</TabsTrigger></TabsList><TabsContent value="included" className="mt-3 max-h-60 space-y-2 overflow-y-auto">{report.includedRecords.length === 0 ? <p className="text-muted-foreground">No records included.</p> : report.includedRecords.map((record) => <div className="flex gap-2 text-xs" key={`${record.kind}-${record.id}`}><CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" /><span><strong className="capitalize">{record.kind}</strong> · {record.title}</span></div>)}</TabsContent><TabsContent value="excluded" className="mt-3 max-h-60 space-y-3 overflow-y-auto">{report.excludedRecords.length === 0 ? <p className="text-muted-foreground">No records excluded.</p> : report.excludedRecords.map((record) => <div className="text-xs" key={`${record.kind}-${record.id}`}><div className="flex flex-wrap items-center gap-2"><LockKeyhole className="mt-0.5 size-3.5 shrink-0 text-amber-600" /><strong>{record.title}</strong>{record.matchSource && <Badge variant="outline" className="text-[10px]">{record.matchSource}</Badge>}</div><p className="ml-5 text-muted-foreground">{record.reason}</p></div>)}</TabsContent></Tabs></CardContent>
        </Card>
      </aside>

      <main className="min-w-0 space-y-5">
        <div className="flex flex-col justify-between gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-center"><div><div className="flex items-center gap-2"><Eye className="size-4" /><h2 className="font-semibold">Live preview</h2><Badge variant="outline">Read-only</Badge></div><p className="mt-1 text-xs text-muted-foreground">Exports use exactly the sanitized view shown below. Export does not save to Notion.</p></div><ReportExportActions report={report} onExport={() => setHasPreview(true)} /></div>
        {report.warnings.length > 0 && <Alert><AlertTriangle /><AlertTitle>Validation warnings</AlertTitle><AlertDescription><ul className="mt-1 list-disc pl-4">{report.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></AlertDescription></Alert>}
        {report.sessions.length === 0 && <div className="rounded-xl border border-dashed p-10 text-center"><h3 className="font-medium">No approved records for this selection</h3><p className="mt-2 text-sm text-muted-foreground">Try another source, period, or project. Records missing explicit visibility approval remain safely excluded.</p></div>}
        <ReportPreview report={report} />
        {(state.type === "simple-invoice" || state.type === "detailed-invoice") && (
          <InvoiceSavePanel
            dataset={dataset}
            report={report}
            builderState={{
              type: state.type,
              clientId: state.clientId,
              periodStart: state.periodStart,
              periodEnd: state.periodEnd,
              projectIds: state.projectIds,
              invoiceNumber: state.invoiceNumber,
              invoiceDate: state.invoiceDate,
              dueDate: state.dueDate,
              paymentTerms: state.paymentTerms,
              customTitle: state.customTitle,
              notes: state.notes,
              executiveSummary: state.executiveSummary,
              draftDescriptions: state.draftDescriptions,
            }}
            hasPreview={hasPreview && report.sessions.some((s) => s.billable)}
          />
        )}
      </main>
    </div>
  );
}
