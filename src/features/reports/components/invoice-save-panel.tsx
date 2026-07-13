"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, LockKeyhole, Save } from "lucide-react";
import { toast } from "sonner";
import { apiPost } from "@/lib/api-client/http";
import { INVOICE_SAVE_CONFIRMATION_PHRASE, type InvoiceSavePreflightResult } from "@/lib/invoices/invoice-save";
import type { ReportDataset, ReportDocument } from "@/lib/reports/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface BuilderSaveState {
  type: "simple-invoice" | "detailed-invoice";
  clientId: string;
  periodStart: string;
  periodEnd: string;
  projectIds: string[];
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  paymentTerms: string;
  customTitle: string;
  notes: string;
  executiveSummary: string;
  draftDescriptions: Record<string, string>;
}

interface InvoiceSavePanelProps {
  dataset: ReportDataset;
  report: ReportDocument;
  builderState: BuilderSaveState;
  hasPreview: boolean;
  onSaved?: (url: string | null) => void;
}

export function InvoiceSavePanel({
  dataset,
  report,
  builderState,
  hasPreview,
  onSaved,
}: InvoiceSavePanelProps) {
  const [confirmation, setConfirmation] = useState("");
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const [savedInvoiceNumber, setSavedInvoiceNumber] = useState<string | null>(null);
  const [partialFailure, setPartialFailure] = useState<string | null>(null);

  const preflightMutation = useMutation({
    mutationFn: () =>
      apiPost<InvoiceSavePreflightResult>("/api/invoices/save-preflight", {
        ...builderState,
        type: builderState.type,
      }),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      apiPost<{
        success: boolean;
        notionUrl?: string;
        invoiceNumber?: string;
        error?: string;
        partialState?: {
          invoiceId: string | null;
          hoursUpdated: string[];
          hoursRemaining: string[];
        };
      }>("/api/invoices/save", {
        ...builderState,
        confirmationPhrase: confirmation.trim(),
      }),
    onSuccess: (result) => {
      if (result.success) {
        setSavedUrl(result.notionUrl ?? null);
        setSavedInvoiceNumber(result.invoiceNumber ?? builderState.invoiceNumber);
        setPartialFailure(null);
        onSaved?.(result.notionUrl ?? null);
        toast.success("Saved to Notion");
      } else {
        setPartialFailure(result.error ?? "Save failed");
        toast.error(result.error ?? "Unable to save invoice");
      }
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Unable to save invoice";
      setPartialFailure(message);
      toast.error(message);
    },
  });

  const preflight = preflightMutation.data;
  const canRunPreflight =
    dataset.source === "notion" &&
    report.type !== "work-log-report" &&
    hasPreview &&
    builderState.invoiceNumber.trim().length > 0 &&
    builderState.clientId.length > 0;

  const saveDisabled =
    !canRunPreflight ||
    !preflight?.ready ||
    saveMutation.isPending ||
    Boolean(savedInvoiceNumber && savedInvoiceNumber === builderState.invoiceNumber);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Save className="size-4" />
          Save Invoice to Notion
        </CardTitle>
        <CardDescription>
          Preview and export remain read-only. Saving requires preflight, reconciliation, and typed confirmation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={!canRunPreflight || preflightMutation.isPending}
            onClick={() => preflightMutation.mutate()}
          >
            {preflightMutation.isPending ? "Checking…" : "Run save preflight"}
          </Button>
          {preflight && (
            <Badge variant={preflight.ready ? "default" : "destructive"}>
              {preflight.ready ? "Ready" : "Not ready"}
            </Badge>
          )}
          {preflight && <Badge variant="outline">writesPerformed=false</Badge>}
        </div>

        {preflight && (
          <div className="space-y-3 rounded-lg border bg-muted/30 p-3 text-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <span className="text-muted-foreground">Invoice</span>
                <p className="font-medium">{preflight.invoiceNumber}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Client</span>
                <p className="font-medium">{preflight.clientName}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Included Hours</span>
                <p className="font-medium">{preflight.includedHours.length}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Included Work Done</span>
                <p className="font-medium">{preflight.includedWorkDone.length}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Total</span>
                <p className="font-medium">${preflight.totals.amount.toFixed(2)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Billable hours</span>
                <p className="font-medium">{preflight.totals.billableHours}</p>
              </div>
            </div>

            {preflight.gatingReasons.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="size-4" />
                <AlertTitle>Preflight blocked</AlertTitle>
                <AlertDescription>
                  <ul className="mt-1 list-disc pl-4">
                    {preflight.gatingReasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {preflight.duplicateConflicts.length > 0 && (
              <div className="space-y-1">
                <p className="flex items-center gap-1 font-medium">
                  <LockKeyhole className="size-3.5" />
                  Duplicate billing diagnostics
                </p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {preflight.duplicateConflicts.map((conflict) => (
                    <li key={`${conflict.hoursId}-${conflict.code}`}>
                      {conflict.sessionId ? `${conflict.sessionId}: ` : ""}
                      {conflict.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {preflight.ready && (
              <ul className="space-y-1 text-xs">
                {preflight.includedHours.map((row) => (
                  <li key={row.id} className="flex items-center gap-1">
                    <CheckCircle2 className="size-3 text-emerald-600" />
                    {row.sessionId ?? row.id} · {row.date} · ${row.amount.toFixed(2)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="space-y-2 border-t pt-4">
          <Label htmlFor="invoice-save-confirm">
            Type <code className="text-xs">{INVOICE_SAVE_CONFIRMATION_PHRASE}</code> to enable save
          </Label>
          <Input
            id="invoice-save-confirm"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder={INVOICE_SAVE_CONFIRMATION_PHRASE}
            autoComplete="off"
          />
          {!preflight?.saveEnabled && (
            <p className="text-xs text-muted-foreground">
              Live save is disabled until <code>NOTION_INVOICE_SAVE_ENABLED=true</code> is approved.
            </p>
          )}
          <Button disabled={saveDisabled || !preflight?.saveEnabled} onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending ? "Saving…" : savedInvoiceNumber ? "Saved to Notion" : "Save Invoice to Notion"}
          </Button>
        </div>

        {savedUrl && (
          <a className="inline-flex items-center gap-1 text-sm underline" href={savedUrl} target="_blank" rel="noreferrer">
            Open saved invoice in Notion
            <ExternalLink className="size-3.5" />
          </a>
        )}

        {partialFailure && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>Partial failure or save blocked</AlertTitle>
            <AlertDescription>{partialFailure}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
