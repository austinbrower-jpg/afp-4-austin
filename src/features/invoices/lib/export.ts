import { jsPDF } from "jspdf";
import { formatCurrency, formatHours } from "@/lib/calculations";
import type { InvoiceReport } from "@/types/domain";

export interface WorkPerformedItem {
  title: string;
  description: string;
  hours: number;
}

export interface InvoiceBranding {
  businessName: string;
  logoPath: string;
  invoiceFooter: string;
  paymentInstructions: string;
}

export interface InvoiceExportData {
  invoice: InvoiceReport;
  clientName: string;
  workPerformed: WorkPerformedItem[];
  /** Falls back to Battle Bound Branding LLC defaults when omitted. */
  branding?: InvoiceBranding;
}

const DEFAULT_BRANDING: InvoiceBranding = {
  businessName: "Battle Bound Branding LLC",
  logoPath: "",
  invoiceFooter: "",
  paymentInstructions: "",
};

function escapeMdCell(value: string): string {
  return (value || "").replace(/\|/g, "\\|").replace(/\s*\n+\s*/g, " ").trim();
}

/** Builds the markdown representation used for both the .md export and clipboard copy. */
export function buildInvoiceMarkdown({ invoice, clientName, workPerformed, branding }: InvoiceExportData): string {
  const brand = branding ?? DEFAULT_BRANDING;
  const lines: string[] = [];
  lines.push(`# Invoice ${invoice.invoiceNumber}`);
  lines.push("");
  lines.push(`**From:** ${brand.businessName}  `);
  lines.push(`**Client:** ${clientName}  `);
  lines.push(`**Period:** ${invoice.periodStart} to ${invoice.periodEnd}  `);
  lines.push(`**Hourly Rate:** ${formatCurrency(invoice.hourlyRate)}/hr  `);
  lines.push(`**Total Hours:** ${formatHours(invoice.totalHours)}  `);
  lines.push(`**Total:** ${formatCurrency(invoice.totalAmount)}  `);
  lines.push(`**Status:** ${invoice.status}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(invoice.summary?.trim() || "_No summary provided._");
  lines.push("");
  lines.push("## Work Performed");
  lines.push("");
  if (workPerformed.length === 0) {
    lines.push("_No work log entries in this period._");
  } else {
    lines.push("| Item | Description | Hours |");
    lines.push("| --- | --- | --- |");
    for (const item of workPerformed) {
      lines.push(
        `| ${escapeMdCell(item.title)} | ${escapeMdCell(item.description)} | ${formatHours(item.hours)} |`,
      );
    }
  }
  lines.push("");
  lines.push(`**Total: ${formatHours(invoice.totalHours)} — ${formatCurrency(invoice.totalAmount)}**`);
  if (brand.paymentInstructions) {
    lines.push("");
    lines.push("## Payment Instructions");
    lines.push("");
    lines.push(brand.paymentInstructions);
  }
  lines.push("");
  lines.push("---");
  if (brand.invoiceFooter) lines.push("", brand.invoiceFooter);
  lines.push("", `_${brand.businessName}_`);
  return lines.join("\n");
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Triggers a browser download of the invoice as a .md file. */
export function downloadInvoiceMarkdown(data: InvoiceExportData): void {
  const md = buildInvoiceMarkdown(data);
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  triggerDownload(blob, `${data.invoice.invoiceNumber}.md`);
}

/** Copies the markdown representation of the invoice to the clipboard. */
export async function copyInvoiceMarkdown(data: InvoiceExportData): Promise<void> {
  const md = buildInvoiceMarkdown(data);
  await navigator.clipboard.writeText(md);
}

/** Generates and downloads a clean one-page PDF invoice. */
export function downloadInvoicePdf(data: InvoiceExportData): void {
  const { invoice, clientName, workPerformed, branding } = data;
  const brand = branding ?? DEFAULT_BRANDING;
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 48;
  let y = 44;
  const logoIsEmbeddable = brand.logoPath.startsWith("data:image");
  const titleX = logoIsEmbeddable ? marginX + 42 : marginX;
  if (logoIsEmbeddable) {
    try {
      doc.addImage(brand.logoPath, marginX, y - 4, 32, 32);
    } catch {
      // Malformed data URI - fall back to text-only branding.
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(brand.businessName, titleX, y);
  y += 22;
  doc.setFontSize(20);
  doc.text("INVOICE", titleX, y);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(invoice.invoiceNumber, pageWidth - marginX, y, { align: "right" });

  y += 20;
  doc.setFontSize(9.5);
  doc.setTextColor(120);
  doc.text(`Status: ${invoice.status.toUpperCase()}`, pageWidth - marginX, y, { align: "right" });
  doc.setTextColor(0);

  y += 16;
  doc.setDrawColor(210);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 26;

  doc.setFontSize(11);
  const headerRows: [string, string][] = [
    ["Client", clientName],
    ["Period", `${invoice.periodStart} to ${invoice.periodEnd}`],
    ["Hourly Rate", `${formatCurrency(invoice.hourlyRate)}/hr`],
    ["Total Hours", formatHours(invoice.totalHours)],
  ];
  for (const [label, value] of headerRows) {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, marginX, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, marginX + 110, y);
    y += 17;
  }

  y += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Summary", marginX, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const summaryLines = doc.splitTextToSize(invoice.summary?.trim() || "No summary provided.", pageWidth - marginX * 2);
  doc.text(summaryLines, marginX, y);
  y += summaryLines.length * 12.5 + 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Work Performed", marginX, y);
  y += 16;

  const hoursColX = pageWidth - marginX - 40;
  const itemColWidth = hoursColX - marginX - 14;

  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("ITEM", marginX, y);
  doc.text("HOURS", hoursColX, y);
  doc.setTextColor(0);
  y += 8;
  doc.setDrawColor(230);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 16;

  const items: WorkPerformedItem[] =
    workPerformed.length > 0
      ? workPerformed
      : [{ title: "No work log entries in this period.", description: "", hours: 0 }];

  for (const item of items) {
    if (y > pageHeight - 110) {
      doc.addPage();
      y = 56;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    const titleLines = doc.splitTextToSize(item.title, itemColWidth);
    doc.text(titleLines, marginX, y);
    doc.setFont("helvetica", "normal");
    doc.text(item.hours ? formatHours(item.hours) : "-", hoursColX, y);
    y += titleLines.length * 12;

    if (item.description) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(110);
      const descLines = doc.splitTextToSize(item.description, itemColWidth);
      doc.text(descLines, marginX, y);
      doc.setTextColor(0);
      y += descLines.length * 11;
    }
    y += 10;
  }

  if (y > pageHeight - 80) {
    doc.addPage();
    y = 56;
  }
  y += 6;
  doc.setDrawColor(210);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 22;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(
    `Total: ${formatHours(invoice.totalHours)}  -  ${formatCurrency(invoice.totalAmount)}`,
    pageWidth - marginX,
    y,
    { align: "right" },
  );

  if (brand.paymentInstructions) {
    if (y > pageHeight - 100) {
      doc.addPage();
      y = 56;
    } else {
      y += 26;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Payment Instructions", marginX, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(90);
    const instructionLines = doc.splitTextToSize(brand.paymentInstructions, pageWidth - marginX * 2);
    doc.text(instructionLines, marginX, y);
    doc.setTextColor(0);
  }

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120);
    const footerLabel = brand.invoiceFooter ? `${brand.invoiceFooter} · ${brand.businessName}` : brand.businessName;
    doc.text(footerLabel, pageWidth / 2, pageHeight - 26, { align: "center" });
    doc.setTextColor(0);
  }

  doc.save(`${invoice.invoiceNumber}.pdf`);
}
