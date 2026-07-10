import Link from "next/link";
import { FlaskConical } from "lucide-react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function MigrationPreviewCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="size-4 text-muted-foreground" />
          Historical Migration Dry Run
        </CardTitle>
        <CardDescription>
          Preview-only: what migrating the historical AFP-Work Notion pages (Hours Worked, Work
          Done) would create. Read-only - no Notion or SQLite writes.
        </CardDescription>
        <CardAction>
          <Badge variant="outline">Phase 5 · preview-only</Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <Button variant="outline" render={<Link href="/settings/migration-preview" />}>
          View migration preview
        </Button>
      </CardContent>
    </Card>
  );
}
