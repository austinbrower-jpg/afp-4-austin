"use client";

import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { InvoiceStatus } from "@/types/domain";
import { useUpdateInvoice } from "../hooks/use-invoices";

const STATUS_OPTIONS: InvoiceStatus[] = ["draft", "sent", "paid", "void"];

export function InvoiceStatusSelect({
  invoiceId,
  status,
}: {
  invoiceId: string;
  status: InvoiceStatus;
}) {
  const update = useUpdateInvoice(invoiceId);

  async function handleChange(next: InvoiceStatus | null) {
    if (!next || next === status) return;
    try {
      await update.mutateAsync({ status: next });
      toast.success(`Marked as ${next}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    }
  }

  return (
    <Select value={status} onValueChange={handleChange} disabled={update.isPending}>
      <SelectTrigger size="sm" className="capitalize">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map((s) => (
          <SelectItem key={s} value={s} className="capitalize">
            {s}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
