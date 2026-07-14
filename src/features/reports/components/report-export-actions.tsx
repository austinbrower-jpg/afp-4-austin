"use client";

import { Copy, Download, FileCode2, FileDown, Printer } from "lucide-react";
import { toast } from "sonner";
import type { ReportDocument } from "@/lib/reports/types";
import { Button } from "@/components/ui/button";
import {
  copyReportMarkdown,
  downloadReportHtml,
  downloadReportJson,
  downloadReportMarkdown,
  downloadReportPdf,
  openPrintReport,
} from "../lib/export";

export function ReportExportActions({ report, onExport }: { report: ReportDocument; onExport?: () => void }) {
  const copy = async () => {
    try {
      await copyReportMarkdown(report);
      onExport?.();
      toast.success("Markdown copied to clipboard");
    } catch {
      toast.error("Clipboard access was not available");
    }
  };
  const print = async () => {
    try {
      if (!(await openPrintReport(report))) toast.error("Allow pop-ups to open the print-friendly report");
      else onExport?.();
    } catch {
      toast.error("Failed to open the print-friendly report");
    }
  };
  const pdf = async () => {
    try {
      await downloadReportPdf(report);
      onExport?.();
    } catch {
      toast.error("Failed to generate PDF");
    }
  };
  const html = async () => {
    try {
      await downloadReportHtml(report);
      onExport?.();
    } catch {
      toast.error("Failed to generate HTML file");
    }
  };
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" onClick={pdf}><FileDown />PDF</Button>
      <Button size="sm" variant="outline" onClick={print}><Printer />Print HTML</Button>
      <Button size="sm" variant="outline" onClick={html}><FileCode2 />HTML</Button>
      <Button size="sm" variant="outline" onClick={() => { downloadReportMarkdown(report); onExport?.(); }}><Download />Markdown</Button>
      <Button size="sm" variant="outline" onClick={copy}><Copy />Copy</Button>
      <Button size="sm" variant="outline" onClick={() => { downloadReportJson(report); onExport?.(); }}><Download />JSON</Button>
    </div>
  );
}
