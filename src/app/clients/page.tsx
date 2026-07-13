import Link from "next/link";
import { getDataProvider } from "@/lib/data/provider";
import { buildClientBillingHistory } from "@/lib/invoices/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatHours } from "@/lib/calculations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const provider = await getDataProvider();
  const [clients, projects, hours, invoices, workLogs] = await Promise.all([
    provider.clients.list(),
    provider.projects.list(),
    provider.hours.list(),
    provider.invoices.list(),
    provider.workLogs.list(),
  ]);
  const histories = buildClientBillingHistory(clients, invoices, hours, workLogs);
  const projectCounts = new Map<string, number>();
  for (const project of projects) {
    projectCounts.set(project.clientId, (projectCounts.get(project.clientId) ?? 0) + 1);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
        <p className="text-muted-foreground">
          Read-only client roster synced from Notion. Revenue, outstanding balance, and billing history at a glance.
        </p>
      </div>
      {clients.length === 0 ? (
        <p className="text-sm text-muted-foreground">No clients yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {histories.map((history) => {
            const client = clients.find((candidate) => candidate.id === history.clientId);
            if (!client) return null;
            return (
              <Link key={client.id} href={`/clients/${client.id}`} className="block h-full">
                <Card className="h-full transition-colors hover:bg-muted/40">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle>{client.name}</CardTitle>
                      <Badge variant="outline" className="capitalize">{client.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="block text-xs text-muted-foreground">Projects</span>
                      {projectCounts.get(client.id) ?? 0}
                    </div>
                    <div>
                      <span className="block text-xs text-muted-foreground">Hours billed</span>
                      {formatHours(history.hoursBilled)}
                    </div>
                    <div>
                      <span className="block text-xs text-muted-foreground">Revenue</span>
                      {formatCurrency(history.totalRevenue)}
                    </div>
                    <div>
                      <span className="block text-xs text-muted-foreground">Outstanding</span>
                      {formatCurrency(history.outstandingBalance)}
                    </div>
                    <div className="col-span-2">
                      <span className="block text-xs text-muted-foreground">Last invoice</span>
                      {history.lastInvoiceDate ?? "None"}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
