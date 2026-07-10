"use client";

import { jsPDF } from "jspdf";
import type { ReportDocument } from "@/lib/reports/types";
import {
  formatMinutes,
  formatMoney,
  serializeReportHtml,
  serializeReportJson,
  serializeReportMarkdown,
} from "@/lib/reports/serializers";

function filename(report: ReportDocument, extension: string): string {
  const base = `${report.type}-${report.invoice.number || report.invoice.periodEnd}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base || "report"}.${extension}`;
}

function downloadText(value: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function downloadReportMarkdown(report: ReportDocument) {
  downloadText(serializeReportMarkdown(report), filename(report, "md"), "text/markdown;charset=utf-8");
}

export function downloadReportJson(report: ReportDocument) {
  downloadText(serializeReportJson(report), filename(report, "json"), "application/json;charset=utf-8");
}

export function downloadReportHtml(report: ReportDocument) {
  downloadText(serializeReportHtml(report), filename(report, "html"), "text/html;charset=utf-8");
}

export function openPrintReport(report: ReportDocument): boolean {
  const url = URL.createObjectURL(new Blob([serializeReportHtml(report)], { type: "text/html;charset=utf-8" }));
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return opened !== null;
}

export async function copyReportMarkdown(report: ReportDocument) {
  await navigator.clipboard.writeText(serializeReportMarkdown(report));
}

export function downloadReportPdf(report: ReportDocument) {
  const pdf = new jsPDF({ unit: "pt", format: "letter", orientation: "portrait" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 48;
  const contentWidth = pageWidth - margin * 2;
  const footerY = pageHeight - 26;
  let y = 0;

  const drawHeader = () => {
    pdf.setFillColor(23, 61, 94);
    pdf.rect(0, 0, pageWidth, 64, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(17);
    pdf.text(report.title, margin, 31);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.text(`${report.client.name} · ${report.invoice.periodStart} to ${report.invoice.periodEnd}`, margin, 47);
    pdf.text(report.source.label, pageWidth - margin, 47, { align: "right" });
    pdf.setTextColor(23, 32, 51);
    y = 88;
  };

  const newPage = () => {
    pdf.addPage();
    drawHeader();
  };

  const ensure = (height: number) => {
    if (y + height > footerY - 18) newPage();
  };

  const text = (value: string, options: { bold?: boolean; size?: number; indent?: number; gap?: number } = {}) => {
    const size = options.size ?? 9;
    const indent = options.indent ?? 0;
    const lines = pdf.splitTextToSize(value || "—", contentWidth - indent) as string[];
    const height = lines.length * (size + 3);
    ensure(height + (options.gap ?? 5));
    pdf.setFont("helvetica", options.bold ? "bold" : "normal");
    pdf.setFontSize(size);
    pdf.text(lines, margin + indent, y);
    y += height + (options.gap ?? 5);
  };

  const heading = (value: string) => {
    ensure(28);
    y += 6;
    pdf.setDrawColor(205, 215, 224);
    pdf.line(margin, y + 15, pageWidth - margin, y + 15);
    text(value, { bold: true, size: 12, gap: 9 });
  };

  const labelValue = (label: string, value: string) => text(`${label}: ${value}`, { size: 8, gap: 2 });

  drawHeader();
  const from = [report.contractor.name, report.contractor.businessName].filter(Boolean).join(" · ") || "—";
  labelValue("From", from);
  labelValue("Client", report.client.name);
  if (report.type !== "work-log-report") {
    labelValue("Invoice", report.invoice.number || "Not provided");
    labelValue("Invoice date", report.invoice.invoiceDate || "Not provided");
    labelValue("Due date / terms", `${report.invoice.dueDate || "Not provided"} · ${report.invoice.paymentTerms || "Not provided"}`);
  }
  heading(report.type === "work-log-report" ? "Executive summary" : "Summary");
  text(report.summary);

  if (report.type === "detailed-invoice") {
    heading("Billable sessions");
    for (const line of report.sessions.filter((session) => session.billable)) {
      ensure(52);
      text(`${line.date}  ${line.startTime}–${line.endTime}  ·  ${formatMinutes(line.exactMinutes)}  ·  ${formatMoney(line.amount)}`, { bold: true, size: 9, gap: 2 });
      text(`${line.projectName} — ${line.description}`, { size: 8, indent: 10, gap: 7 });
    }
  } else if (report.type === "work-log-report") {
    heading("Daily work breakdown");
    for (const item of report.workItems) {
      text(`${item.date} · ${item.title}`, { bold: true, size: 10, gap: 2 });
      text(`${item.projectName} — ${item.description}`, { size: 8, indent: 10, gap: 4 });
      for (const [label, entries] of [
        ["Deliverables", item.deliverables],
        ["Testing", item.testingPerformed],
        ["Blockers", item.blockers],
        ["Follow-up", item.followUpItems],
        ["Evidence", item.evidenceLinks],
      ] as const) {
        if (entries.length) text(`${label}: ${entries.join(" • ")}`, { size: 7, indent: 16, gap: 3 });
      }
      text(`Related time: ${formatMinutes(item.relatedHoursMinutes)}`, { size: 7, indent: 16, gap: 8 });
    }
    if (report.knowledgeItems.length) {
      heading("Related knowledge");
      for (const item of report.knowledgeItems) {
        text(`${item.title} · ${item.projectName}`, { bold: true, size: 9, gap: 2 });
        text(item.summary, { size: 8, indent: 10, gap: 6 });
      }
    }
  }

  if (report.type === "detailed-invoice" || report.type === "work-log-report") {
    heading(report.type === "work-log-report" ? "Hours by day" : "Daily subtotals");
    for (const row of report.dailyTotals) {
      text(`${row.label}: ${formatMinutes(row.exactMinutes)} · ${formatMoney(row.amount)}`, { size: 9, gap: 3 });
    }
  }

  heading(report.type === "work-log-report" ? "Hours by project" : "Project totals");
  for (const row of report.projectTotals) {
    text(`${row.label}: ${formatMinutes(row.exactMinutes)} · ${formatMoney(row.amount)}`, { size: 9, gap: 3 });
  }
  if (report.type === "work-log-report") {
    heading("Time summary");
    text(`Billable ${formatMinutes(report.totals.billableMinutes)} · Non-billable ${formatMinutes(report.totals.nonBillableMinutes)}`, { bold: true, size: 11 });
  } else {
    heading("Amount due");
    text(`${formatMoney(report.totals.amountDue)} · ${formatMinutes(report.totals.billableMinutes)} billable`, { bold: true, size: 15 });
    if (report.invoice.notes) {
      heading("Notes");
      text(report.invoice.notes);
    }
  }

  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(112, 122, 135);
    pdf.text(`${report.title} · Page ${page} of ${pages}`, pageWidth / 2, footerY, { align: "center" });
  }
  pdf.save(filename(report, "pdf"));
}
