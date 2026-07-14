import Link from "next/link";
import { UploadCloud } from "lucide-react";
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

export function MigrationImportCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UploadCloud className="size-4 text-muted-foreground" />
          Historical Notion Import
        </CardTitle>
        <CardDescription>
          One-time, narrowly scoped write of the corrected July 8-10 v2 historical records to Notion,
          with duplicate protection. Requires a typed confirmation phrase - never enables general
          sync.
        </CardDescription>
        <CardAction>
          <Badge variant="outline">Phase 6 · can write</Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <Button variant="outline" render={<Link href="/settings/migration-import" />}>
          Open import tool
        </Button>
      </CardContent>
    </Card>
  );
}
