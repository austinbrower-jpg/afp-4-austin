import { connection } from "next/server";
import { WorkspaceClientCard } from "@/features/settings/components/workspace-client-card";
import { NotionConnectionCard } from "@/features/settings/components/notion-connection-card";
import { NotionMappingCard } from "@/features/settings/components/notion-mapping-card";
import { ConflictsCard } from "@/features/settings/components/conflicts-card";
import { MigrationPreviewCard } from "@/features/settings/components/migration-preview-card";
import { MigrationImportCard } from "@/features/settings/components/migration-import-card";
import { DesktopAppCard } from "@/features/settings/components/desktop-app-card";
import { ReportSettingsCard } from "@/features/settings/components/report-settings-card";
import { NotionProductionCard } from "@/features/settings/components/notion-production-card";
import { getRuntimeConfig } from "@/lib/data/runtime";

export default async function SettingsPage() {
  await connection();
  const config = getRuntimeConfig();
  const notion = config.mode === "notion";
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Runtime data source, report identity, and protected Notion configuration.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <WorkspaceClientCard readOnly={notion} />
        <ReportSettingsCard notionMode={notion} />
        {notion ? <NotionProductionCard config={config} /> : <NotionConnectionCard />}
        <NotionMappingCard />
        {!notion && <MigrationPreviewCard />}
        {!notion && <MigrationImportCard />}
        {!notion && <ConflictsCard />}
        <DesktopAppCard />
      </div>
    </div>
  );
}
