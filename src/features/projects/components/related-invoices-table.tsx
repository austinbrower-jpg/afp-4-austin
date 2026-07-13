import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InvoiceStatusBadge } from "@/features/invoices/components/invoice-status-badge";
import { Receipt } from "lucide-react";
import { formatCurrency } from "@/lib/calculations";
import type { InvoiceReport } from "@/types/domain";

export function RelatedInvoicesTable({ invoices }: { invoices: InvoiceReport[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="size-4 text-muted-foreground" />
          Invoices
        </CardTitle>
      </CardHeader>
      <CardContent>
        {invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground/70 italic">
            No invoices reference hours or work logs from this project yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell>
                    <Link
                      href={`/invoices/${invoice.id}`}
                      className="font-medium hover:underline underline-offset-2"
                    >
                      {invoice.invoiceNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {invoice.periodStart} to {invoice.periodEnd}
                  </TableCell>
                  <TableCell className="tabular-nums">{formatCurrency(invoice.totalAmount)}</TableCell>
                  <TableCell><InvoiceStatusBadge status={invoice.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
