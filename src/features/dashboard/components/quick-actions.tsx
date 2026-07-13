import Link from "next/link";
import { ChartColumn, Clock, FileOutput, FileText } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface QuickAction {
  icon: LucideIcon;
  label: string;
  href: string;
}

const ACTIONS: QuickAction[] = [
  { icon: FileText, label: "Generate Invoice", href: "/reports" },
  { icon: FileOutput, label: "Generate Work Report", href: "/reports" },
  { icon: ChartColumn, label: "View Invoice Dashboard", href: "/invoices/dashboard" },
  { icon: Clock, label: "View Time History", href: "/hours" },
];

export function QuickActions() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2">
        {ACTIONS.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className="flex flex-col items-start gap-2 rounded-lg border p-3 text-sm font-medium transition-colors hover:border-foreground/20 hover:bg-muted/40"
          >
            <action.icon className="size-4 text-muted-foreground" />
            {action.label}
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
