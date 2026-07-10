"use client";

import { Download, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { MigrationDryRunResult } from "@/lib/notion/migration/types";

export function DownloadJsonButton({ result }: { result: MigrationDryRunResult }) {
  const json = JSON.stringify(result, null, 2);

  const handleDownload = () => {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `migration-dry-run-${result.generatedAt.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      toast.success("Dry-run JSON copied to clipboard");
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  };

  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={handleDownload}>
        <Download className="size-3.5" />
        Download JSON
      </Button>
      <Button variant="outline" onClick={handleCopy}>
        <Copy className="size-3.5" />
        Copy JSON
      </Button>
    </div>
  );
}
