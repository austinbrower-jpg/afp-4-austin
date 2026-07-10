"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-2xl py-16">
      <Alert variant="destructive">
        <AlertTriangle />
        <AlertTitle>Unable to load current workspace data</AlertTitle>
        <AlertDescription className="space-y-4">
          <p>{error.message || "The configured data source returned an unexpected error."}</p>
          <Button variant="outline" size="sm" onClick={reset}><RefreshCw />Try again</Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}
