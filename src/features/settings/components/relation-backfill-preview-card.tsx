import Link from "next/link";
import { GitBranch } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function RelationBackfillPreviewCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><GitBranch className="size-4" />Relation Backfill Preview</CardTitle>
        <CardDescription>Read-only July 8–10 explicit relation proposal. No Notion writes.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" render={<Link href="/settings/relation-backfill-preview" />}>
          Open backfill preview
        </Button>
      </CardContent>
    </Card>
  );
}
