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

export function ReportExportActions({ report }: { report: ReportDocument }) {
  const copy = async () => {
    try {
      await copyReportMarkdown(report);
      toast.success("Markdown copied to clipboard");
    } catch {
      toast.error("Clipboard access was not available");
    }
  };
  const print = () => {
    if (!openPrintReport(report)) toast.error("Allow pop-ups to open the print-friendly report");
  };
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" onClick={() => downloadReportPdf(report)}><FileDown />PDF</Button>
      <Button size="sm" variant="outline" onClick={print}><Printer />Print HTML</Button>
      <Button size="sm" variant="outline" onClick={() => downloadReportHtml(report)}><FileCode2 />HTML</Button>
      <Button size="sm" variant="outline" onClick={() => downloadReportMarkdown(report)}><Download />Markdown</Button>
      <Button size="sm" variant="outline" onClick={copy}><Copy />Copy</Button>
      <Button size="sm" variant="outline" onClick={() => downloadReportJson(report)}><Download />JSON</Button>
    </div>
  );
}

