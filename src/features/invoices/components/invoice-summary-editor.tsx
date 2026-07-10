"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateInvoice } from "../hooks/use-invoices";

export function InvoiceSummaryEditor({
  invoiceId,
  summary,
}: {
  invoiceId: string;
  summary: string;
}) {
  const [value, setValue] = useState(summary);
  // Re-sync the local draft whenever the upstream summary changes (initial
  // load, or after this component's own save round-trips) - adjusted during
  // render rather than in an effect, per React's guidance for this pattern.
  const [prevSummary, setPrevSummary] = useState(summary);
  if (summary !== prevSummary) {
    setPrevSummary(summary);
    setValue(summary);
  }

  const update = useUpdateInvoice(invoiceId);

  const dirty = value !== summary;

  async function handleSave() {
    try {
      await update.mutateAsync({ summary: value });
      toast.success("Summary saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save summary");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={4}
        placeholder="Summary of work performed this period..."
        className="min-h-24"
      />
      <div className="flex justify-end">
        <Button size="sm" onClick={handleSave} disabled={!dirty || update.isPending}>
          {update.isPending ? <Loader2 className="animate-spin" /> : <Save />}
          Save summary
        </Button>
      </div>
    </div>
  );
}
