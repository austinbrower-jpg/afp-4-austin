import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Clock } from "lucide-react";
import { formatCurrency, formatHours, sumBillableAmount, sumHours } from "@/lib/calculations";
import type { HoursEntry } from "@/types/domain";

export function RelatedHoursTable({ hours }: { hours: HoursEntry[] }) {
  const totalHours = sumHours(hours);
  const billableAmount = sumBillableAmount(hours);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" />
            Related Hours
          </CardTitle>
          <span className="text-sm text-muted-foreground">
            {formatHours(totalHours)} total · {formatCurrency(billableAmount)} billable
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {hours.length === 0 ? (
          <p className="text-sm text-muted-foreground/70 italic">
            No hours logged against this project yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Billable</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {hours.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{format(parseISO(entry.date), "MMM d, yyyy")}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {entry.startTime}–{entry.endTime}
                  </TableCell>
                  <TableCell>{formatHours(entry.totalHours)}</TableCell>
                  <TableCell>
                    <Badge variant={entry.billable ? "secondary" : "outline"}>
                      {entry.billable ? "Billable" : "Non-billable"}
                    </Badge>
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
