import { InvoiceDetailView } from "@/features/invoices/components/invoice-detail-view";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <InvoiceDetailView invoiceId={id} />;
}
