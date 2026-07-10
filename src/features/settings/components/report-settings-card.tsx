"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSliders } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPatch } from "@/lib/api-client/http";
import type { ReportSettings } from "@/lib/reports/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

const queryKey = ["report-settings"] as const;

export function ReportSettingsCard({ readOnly = false }: { readOnly?: boolean }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => apiGet<ReportSettings>("/api/report-settings"),
  });
  const mutation = useMutation({
    mutationFn: (settings: ReportSettings) =>
      apiPatch<ReportSettings>("/api/report-settings", settings),
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKey, saved);
      setForm(saved);
      toast.success("Report settings saved locally");
    },
    onError: (error: Error) => toast.error(error.message || "Unable to save report settings"),
  });
  const [form, setForm] = useState<ReportSettings | null>(null);
  if (data && form === null) setForm({ ...data });

  if (isLoading || !form || !data) {
    return (
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle>Contractor & Report Settings</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-48 w-full" /></CardContent>
      </Card>
    );
  }

  const set = (key: keyof ReportSettings, value: string | number) =>
    setForm({ ...form, [key]: value });
  const isDirty = JSON.stringify(form) !== JSON.stringify(data);
  const invalidRate = !Number.isFinite(Number(form.defaultHourlyRate)) || Number(form.defaultHourlyRate) < 0;

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FileSliders className="size-4" />Contractor & Report Settings</CardTitle>
        <CardDescription>
          Local-only invoice identity and billing defaults. These values are never written to Notion.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {([
            ["contractorName", "Contractor name", "Austin Brower"],
            ["businessName", "Business name", "Optional"],
            ["email", "Email", "contractor@example.com"],
            ["phone", "Phone", "Optional"],
            ["clientDisplayName", "Client display name", "Defaults to selected client"],
            ["clientBillingContact", "Client billing contact", "Optional"],
            ["clientBillingEmail", "Client billing email", "billing@example.com"],
            ["defaultPaymentTerms", "Default payment terms", "Net 15"],
            ["logoPath", "Optional logo path", "/absolute/path/logo.png"],
          ] as const).map(([key, label, placeholder]) => (
            <div className="space-y-1.5" key={key}>
              <Label htmlFor={`report-${key}`}>{label}</Label>
              <Input id={`report-${key}`} value={form[key]} placeholder={placeholder} disabled={readOnly} onChange={(event) => set(key, event.target.value)} />
            </div>
          ))}
          <div className="space-y-1.5">
            <Label htmlFor="report-rate">Default hourly rate</Label>
            <Input id="report-rate" type="number" min="0" step="0.01" value={form.defaultHourlyRate} aria-invalid={invalidRate} disabled={readOnly} onChange={(event) => set("defaultHourlyRate", Number(event.target.value))} />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="report-address">Address</Label>
            <Textarea id="report-address" className="min-h-24" value={form.address} disabled={readOnly} onChange={(event) => set("address", event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="report-notes">Default invoice notes</Label>
            <Textarea id="report-notes" className="min-h-24" value={form.defaultInvoiceNotes} disabled={readOnly} onChange={(event) => set("defaultInvoiceNotes", event.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          {isDirty && <Button variant="ghost" onClick={() => setForm({ ...data })}>Discard</Button>}
          <Button disabled={readOnly || !isDirty || invalidRate || mutation.isPending} onClick={() => mutation.mutate(form)}>
            {mutation.isPending ? "Saving…" : "Save report settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
