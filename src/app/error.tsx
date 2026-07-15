"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.warn("[app-error] route render failed", {
      category: "render",
      digest: error.digest ?? null,
    });
  }, [error.digest]);

  return (
    <div className="mx-auto max-w-2xl py-16">
      <Alert variant="destructive">
        <AlertTriangle />
        <AlertTitle>Unable to load current workspace data</AlertTitle>
        <AlertDescription className="space-y-4">
          <p>The configured data source did not respond. No source records were changed.</p>
          <Button variant="outline" size="sm" onClick={unstable_retry}><RefreshCw />Try again</Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}
