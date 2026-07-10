import { WorkspaceClientCard } from "@/features/settings/components/workspace-client-card";
import { NotionConnectionCard } from "@/features/settings/components/notion-connection-card";
import { NotionMappingCard } from "@/features/settings/components/notion-mapping-card";
import { ConflictsCard } from "@/features/settings/components/conflicts-card";
import { MigrationPreviewCard } from "@/features/settings/components/migration-preview-card";
import { MigrationImportCard } from "@/features/settings/components/migration-import-card";
import { DesktopAppCard } from "@/features/settings/components/desktop-app-card";

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Workspace, hourly rate, and Notion sync configuration.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <WorkspaceClientCard />
        <NotionConnectionCard />
        <NotionMappingCard />
        <MigrationPreviewCard />
        <MigrationImportCard />
        <ConflictsCard />
        <DesktopAppCard />
      </div>
    </div>
  );
}
