import { Cloud, LockKeyhole } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { RuntimeConfigResult } from "@/lib/data/runtime-config";
import { PHASE11_RELATIONAL_SCHEMA_PROPOSAL, PROPOSED_NOTION_SCHEMA_CHANGES } from "@/lib/notion/schema-requirements";

export function NotionProductionCard({ config }: { config: RuntimeConfigResult }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Cloud className="size-4" />Notion Production Mode</CardTitle>
        <CardDescription>Direct Notion reads and explicit targeted writes. General sync is disabled.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">APP_DATA_SOURCE=notion</Badge>
          <Badge variant="outline">SQLite disabled</Badge>
          <Badge variant="outline">Sync disabled</Badge>
        </div>
        <p className="flex gap-2 text-muted-foreground"><LockKeyhole className="mt-0.5 size-4 shrink-0" />Access protection: {config.accessProtection.replaceAll("-", " ")}.</p>
        <div className="space-y-2 rounded-lg border p-3">
          <p className="font-medium">Additive schema preview only</p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {PROPOSED_NOTION_SCHEMA_CHANGES.map((field) => (
              <li key={`${field.entity}-${field.notionName}`}>
                {field.databaseLabel}: <code>{field.notionName}</code> ({field.expectedType}){field.status === "deferred" ? " — deferred" : ""}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">No schema-apply action exists. Use the read-only verifier below and the relation backfill preview to compare proposals with live databases.</p>
        </div>
        <div className="space-y-2 rounded-lg border p-3">
          <p className="font-medium">Phase 11 relational proposal (additive only)</p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {PHASE11_RELATIONAL_SCHEMA_PROPOSAL.flatMap((db) =>
              db.properties.map((prop) => (
                <li key={`${db.database}-${prop.name}`}>
                  {db.database}: <code>{prop.name}</code> ({prop.type})
                </li>
              )),
            )}
          </ul>
        </div>
        {config.errors.length > 0 && <ul className="list-disc space-y-1 pl-5 text-destructive">{config.errors.map((error) => <li key={error}>{error}</li>)}</ul>}
      </CardContent>
    </Card>
  );
}
