"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatHours } from "@/lib/calculations";
import type { InvoiceReport } from "@/types/domain";
import { InvoiceStatusBadge } from "./invoice-status-badge";

function fmtDate(iso: string): string {
  try {
    return format(parseISO(iso), "MMM d, yyyy");
  } catch {
    return iso;
  }
}

export function InvoiceListTable({ invoices }: { invoices: InvoiceReport[] }) {
  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed py-16 text-center">
        <p className="text-sm font-medium">No invoices yet</p>
        <p className="text-sm text-muted-foreground">
          Generate one from a range of billable hours to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Invoice #</TableHead>
            <TableHead>Period</TableHead>
            <TableHead className="text-right">Hours</TableHead>
            <TableHead className="text-right">Rate</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((invoice) => (
            <TableRow key={invoice.id} className="cursor-pointer">
              <TableCell className="font-medium">
                <Link href={`/invoices/${invoice.id}`} className="block hover:underline">
                  {invoice.invoiceNumber}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">
                <Link href={`/invoices/${invoice.id}`} className="block">
                  {fmtDate(invoice.periodStart)} – {fmtDate(invoice.periodEnd)}
                </Link>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                <Link href={`/invoices/${invoice.id}`} className="block">
                  {formatHours(invoice.totalHours)}
                </Link>
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                <Link href={`/invoices/${invoice.id}`} className="block">
                  {formatCurrency(invoice.hourlyRate)}/hr
                </Link>
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                <Link href={`/invoices/${invoice.id}`} className="block">
                  {formatCurrency(invoice.totalAmount)}
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/invoices/${invoice.id}`} className="block">
                  <InvoiceStatusBadge status={invoice.status} />
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
