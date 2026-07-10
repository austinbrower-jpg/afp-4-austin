"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  copyInvoiceMarkdown,
  downloadInvoiceMarkdown,
  downloadInvoicePdf,
  type InvoiceExportData,
} from "../lib/export";

export function InvoiceExportActions({ data }: { data: InvoiceExportData }) {
  const [copying, setCopying] = useState(false);

  function handlePdf() {
    try {
      downloadInvoicePdf(data);
    } catch {
      toast.error("Failed to generate PDF");
    }
  }

  function handleMarkdown() {
    try {
      downloadInvoiceMarkdown(data);
    } catch {
      toast.error("Failed to generate markdown file");
    }
  }

  async function handleCopy() {
    setCopying(true);
    try {
      await copyInvoiceMarkdown(data);
      toast.success("Invoice copied to clipboard");
    } catch {
      toast.error("Failed to copy to clipboard");
    } finally {
      setCopying(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={handlePdf}>
        <Download />
        Export PDF
      </Button>
      <Button variant="outline" size="sm" onClick={handleMarkdown}>
        <FileText />
        Export Markdown
      </Button>
      <Button variant="outline" size="sm" onClick={handleCopy} disabled={copying}>
        <Copy />
        Copy to Clipboard
      </Button>
    </div>
  );
}
