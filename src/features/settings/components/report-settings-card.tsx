"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSliders } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPatch } from "@/lib/api-client/http";
import { DEFAULT_REPORT_SETTINGS, type ReportSettings } from "@/lib/reports/types";
import {
  saveBrowserReportSettings,
  useBrowserReportSettings,
} from "@/features/reports/lib/browser-report-settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

const queryKey = ["report-settings"] as const;

export function ReportSettingsCard({ notionMode = false }: { notionMode?: boolean }) {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({
    queryKey,
    queryFn: () => apiGet<ReportSettings>("/api/report-settings"),
  });
  const baseline = useBrowserReportSettings(
    settingsQuery.data ?? DEFAULT_REPORT_SETTINGS,
    notionMode,
  );
  const mutation = useMutation({
    mutationFn: (settings: ReportSettings) => notionMode
      ? Promise.resolve(saveBrowserReportSettings(settings))
      : apiPatch<ReportSettings>("/api/report-settings", settings),
    onSuccess: (saved) => {
      if (!notionMode) queryClient.setQueryData(queryKey, saved);
      setForm(null);
      toast.success("Report settings saved locally");
    },
    onError: (error: Error) => toast.error(error.message || "Unable to save report settings"),
  });
  const [form, setForm] = useState<ReportSettings | null>(null);

  if (settingsQuery.isLoading) {
    return (
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle>Contractor & Report Settings</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-48 w-full" /></CardContent>
      </Card>
    );
  }

  if (settingsQuery.isError || !settingsQuery.data) {
    return (
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Contractor & Report Settings</CardTitle>
          <CardDescription>Report settings could not be loaded.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-destructive">
            {settingsQuery.error instanceof Error ? settingsQuery.error.message : "Unexpected report settings error."}
          </p>
          <Button variant="outline" onClick={() => settingsQuery.refetch()}>Try again</Button>
        </CardContent>
      </Card>
    );
  }

  const activeForm = form ?? baseline;

  const set = (key: keyof ReportSettings, value: string | number) =>
    setForm({ ...activeForm, [key]: value });
  const isDirty = JSON.stringify(activeForm) !== JSON.stringify(baseline);
  const invalidRate = !Number.isFinite(Number(activeForm.defaultHourlyRate)) || Number(activeForm.defaultHourlyRate) < 0;

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FileSliders className="size-4" />Business Branding & Report Settings</CardTitle>
        <CardDescription>
          {notionMode
            ? "Browser-local branding, invoice identity, and billing defaults used on every export. These values are never written to Notion."
            : "Local-only branding, invoice identity, and billing defaults used on every export. These values are never written to Notion."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {([
            ["businessName", "Business name", "Battle Bound Branding LLC"],
            ["contractorName", "Contractor name", "Austin Brower"],
            ["email", "Business email", "hello@battleboundbranding.com"],
            ["phone", "Business phone", "Optional"],
            ["website", "Website", "https://battleboundbranding.com"],
            ["logoPath", "Business logo (URL or path)", "/absolute/path/logo.png"],
            ["clientDisplayName", "Client display name", "Defaults to selected client"],
            ["clientBillingContact", "Client billing contact", "Optional"],
            ["clientBillingEmail", "Client billing email", "billing@example.com"],
            ["defaultPaymentTerms", "Default payment terms", "Net 15"],
          ] as const).map(([key, label, placeholder]) => (
            <div className="space-y-1.5" key={key}>
              <Label htmlFor={`report-${key}`}>{label}</Label>
              <Input id={`report-${key}`} value={activeForm[key]} placeholder={placeholder} onChange={(event) => set(key, event.target.value)} />
            </div>
          ))}
          <div className="space-y-1.5">
            <Label htmlFor="report-rate">Default hourly rate</Label>
            <Input id="report-rate" type="number" min="0" step="0.01" value={activeForm.defaultHourlyRate} aria-invalid={invalidRate} onChange={(event) => set("defaultHourlyRate", Number(event.target.value))} />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="report-address">Business address</Label>
            <Textarea id="report-address" className="min-h-24" value={activeForm.address} onChange={(event) => set("address", event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="report-notes">Default invoice notes</Label>
            <Textarea id="report-notes" className="min-h-24" value={activeForm.defaultInvoiceNotes} onChange={(event) => set("defaultInvoiceNotes", event.target.value)} />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="report-footer">Invoice footer</Label>
            <Textarea id="report-footer" className="min-h-20" placeholder="Thank you for choosing Battle Bound Branding LLC." value={activeForm.invoiceFooter} onChange={(event) => set("invoiceFooter", event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="report-payment-instructions">Payment instructions</Label>
            <Textarea id="report-payment-instructions" className="min-h-20" placeholder="Optional wire/ACH/PayPal details shown on invoices" value={activeForm.paymentInstructions} onChange={(event) => set("paymentInstructions", event.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          {isDirty && <Button variant="ghost" onClick={() => setForm(null)}>Discard</Button>}
          <Button disabled={!isDirty || invalidRate || mutation.isPending} onClick={() => mutation.mutate(activeForm)}>
            {mutation.isPending ? "Saving…" : "Save report settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
