import { Monitor } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function DesktopAppCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Monitor className="size-4 text-muted-foreground" />
          Desktop App
        </CardTitle>
        <CardDescription>
          An Electron desktop wrapper is already scaffolded for this workspace.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>
          Run{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs text-foreground">
            npm run electron:dev
          </code>{" "}
          to open a dev desktop window against this app.
        </p>
        <p>
          Run{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs text-foreground">
            npm run electron:build
          </code>{" "}
          to package a distributable build.
        </p>
      </CardContent>
    </Card>
  );
}
