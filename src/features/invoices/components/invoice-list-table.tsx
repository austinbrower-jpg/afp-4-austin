"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiGet } from "@/lib/api-client/http";
import { formatCurrency, formatHours } from "@/lib/calculations";
import type { Client, InvoiceReport } from "@/types/domain";
import { InvoiceStatusBadge } from "./invoice-status-badge";

function fmtDate(iso: string): string {
  try {
    return format(parseISO(iso), "MMM d, yyyy");
  } catch {
    return iso;
  }
}

function notionUrl(invoice: InvoiceReport): string | null {
  if (invoice.notionUrl) return invoice.notionUrl;
  if (!invoice.notionPageId) return null;
  return `https://www.notion.so/${invoice.notionPageId.replace(/-/g, "")}`;
}

export function InvoiceListTable({ invoices }: { invoices: InvoiceReport[] }) {
  const clientsQuery = useQuery({
    queryKey: ["clients"],
    queryFn: () => apiGet<Client[]>("/api/clients"),
  });
  const clientName = (clientId: string) =>
    clientsQuery.data?.find((client) => client.id === clientId)?.name ?? "—";

  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed py-16 text-center">
        <p className="text-sm font-medium">No invoices yet</p>
        <p className="text-sm text-muted-foreground">
          Save an invoice from Report Builder or generate one from billable hours.
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
            <TableHead>Client</TableHead>
            <TableHead>Period</TableHead>
            <TableHead className="text-right">Hours</TableHead>
            <TableHead className="text-right">Included</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Notion</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((invoice) => {
            const url = notionUrl(invoice);
            return (
              <TableRow key={invoice.id} className="cursor-pointer">
                <TableCell className="font-medium">
                  <Link href={`/invoices/${invoice.id}`} className="block hover:underline">
                    {invoice.invoiceNumber}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <Link href={`/invoices/${invoice.id}`} className="block">
                    {clientName(invoice.clientId)}
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
                    {invoice.hoursEntryIds.length}h / {invoice.workDoneIds?.length ?? 0}w
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
                <TableCell>
                  {url ? (
                    <a href={url} target="_blank" rel="noreferrer" className="text-sm underline">
                      Open
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
