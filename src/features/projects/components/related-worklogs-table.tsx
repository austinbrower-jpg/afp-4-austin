import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WorkLogStatusBadge } from "@/components/shared/work-log-status-badge";
import { ClipboardList } from "lucide-react";
import type { WorkLog } from "@/types/domain";

export function RelatedWorkLogsTable({ workLogs }: { workLogs: WorkLog[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="size-4 text-muted-foreground" />
          Related Work Logs
        </CardTitle>
      </CardHeader>
      <CardContent>
        {workLogs.length === 0 ? (
          <p className="text-sm text-muted-foreground/70 italic">
            No work logs linked to this project yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <Link
                      href={`/work-done/${log.id}`}
                      className="font-medium hover:underline underline-offset-2"
                    >
                      {log.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(parseISO(log.date), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    <WorkLogStatusBadge status={log.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
