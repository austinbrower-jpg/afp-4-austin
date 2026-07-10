import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { formatHours } from "@/lib/calculations";
import type { WorkPerformedItem } from "../lib/export";

export interface WorkPerformedRow extends WorkPerformedItem {
  workLogId: string;
  href: string | null;
}

export function WorkPerformedList({ items }: { items: WorkPerformedRow[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No work log entries fall within this invoice&apos;s period.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li
          key={item.workLogId}
          className="flex items-start justify-between gap-4 rounded-lg border px-3 py-2.5"
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              {item.href ? (
                <Link
                  href={item.href}
                  className="truncate text-sm font-medium hover:underline"
                >
                  {item.title}
                </Link>
              ) : (
                <span className="truncate text-sm font-medium">{item.title}</span>
              )}
              {item.href && (
                <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
              )}
            </div>
            {item.description && (
              <p className="text-sm text-muted-foreground">{item.description}</p>
            )}
          </div>
          <span className="shrink-0 text-sm font-medium tabular-nums">
            {formatHours(item.hours)}
          </span>
        </li>
      ))}
    </ul>
  );
}
