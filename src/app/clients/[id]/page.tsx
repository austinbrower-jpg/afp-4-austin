import Link from "next/link";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getDataProvider } from "@/lib/data/provider";
import { buildClientBillingHistory } from "@/lib/invoices/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatHours, sumHours } from "@/lib/calculations";
import { InvoiceStatusBadge } from "@/features/invoices/components/invoice-status-badge";
import { ProjectStatusBadge } from "@/components/shared/project-status-badge";
import { WorkLogStatusBadge } from "@/components/shared/work-log-status-badge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const provider = await getDataProvider();
  const [client, projects, hours, invoices, workLogs] = await Promise.all([
    provider.clients.findById(id),
    provider.projects.list(),
    provider.hours.list(),
    provider.invoices.list(),
    provider.workLogs.list(),
  ]);
  if (!client) notFound();

  const clientProjects = projects.filter((project) => project.clientId === id);
  const clientHours = hours.filter((entry) => entry.clientId === id);
  const clientInvoices = invoices
    .filter((invoice) => invoice.clientId === id)
    .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));
  const clientWorkLogs = workLogs
    .filter((log) => log.clientId === id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const [history] = buildClientBillingHistory([client], invoices, hours, workLogs);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/clients" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          Back to clients
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
            <p className="text-sm text-muted-foreground">Read-only client record synced from Notion.</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="capitalize">{client.status}</Badge>
            {client.notionUrl && (
              <a
                href={client.notionUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm underline"
              >
                Open in Notion
                <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card size="sm">
          <CardHeader><CardTitle className="text-xs font-normal text-muted-foreground uppercase tracking-wide">Revenue</CardTitle></CardHeader>
          <CardContent className="text-xl font-semibold tabular-nums">{formatCurrency(history?.totalRevenue ?? 0)}</CardContent>
        </Card>
        <Card size="sm">
          <CardHeader><CardTitle className="text-xs font-normal text-muted-foreground uppercase tracking-wide">Outstanding</CardTitle></CardHeader>
          <CardContent className="text-xl font-semibold tabular-nums">{formatCurrency(history?.outstandingBalance ?? 0)}</CardContent>
        </Card>
        <Card size="sm">
          <CardHeader><CardTitle className="text-xs font-normal text-muted-foreground uppercase tracking-wide">Hours billed</CardTitle></CardHeader>
          <CardContent className="text-xl font-semibold tabular-nums">{formatHours(history?.hoursBilled ?? 0)}</CardContent>
        </Card>
        <Card size="sm">
          <CardHeader><CardTitle className="text-xs font-normal text-muted-foreground uppercase tracking-wide">Last invoice</CardTitle></CardHeader>
          <CardContent className="text-xl font-semibold">{history?.lastInvoiceDate ?? "None"}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Projects ({clientProjects.length})</CardTitle></CardHeader>
        <CardContent>
          {clientProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">No projects yet.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {clientProjects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell>
                      <Link href={`/projects/${project.id}`} className="font-medium hover:underline underline-offset-2">{project.name}</Link>
                    </TableCell>
                    <TableCell><ProjectStatusBadge status={project.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Invoices ({clientInvoices.length})</CardTitle></CardHeader>
        <CardContent>
          {clientInvoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices yet.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Period</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {clientInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      <Link href={`/invoices/${invoice.id}`} className="font-medium hover:underline underline-offset-2">{invoice.invoiceNumber}</Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{invoice.periodStart} to {invoice.periodEnd}</TableCell>
                    <TableCell className="tabular-nums">{formatCurrency(invoice.totalAmount)}</TableCell>
                    <TableCell><InvoiceStatusBadge status={invoice.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Work History ({clientWorkLogs.length})</CardTitle></CardHeader>
        <CardContent>
          {clientWorkLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No work logged yet.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {clientWorkLogs.slice(0, 25).map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Link href={`/work-done/${log.id}`} className="font-medium hover:underline underline-offset-2">{log.title}</Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{format(parseISO(log.date), "MMM d, yyyy")}</TableCell>
                    <TableCell><WorkLogStatusBadge status={log.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Hours Worked ({clientHours.length})</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{formatHours(sumHours(clientHours))} total logged for this client.</p>
        </CardContent>
      </Card>
    </div>
  );
}
