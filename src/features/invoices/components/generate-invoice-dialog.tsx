"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, subWeeks } from "date-fns";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";
import { CalendarIcon, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getWeekRange } from "@/lib/calculations";
import { useGenerateInvoice } from "../hooks/use-invoices";

function lastFullWeek(): DateRange {
  const { start, end } = getWeekRange(subWeeks(new Date(), 1));
  return { from: start, to: end };
}

export function GenerateInvoiceDialog() {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<DateRange | undefined>(lastFullWeek());
  const generate = useGenerateInvoice();
  const router = useRouter();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) setRange(lastFullWeek());
  }

  async function handleGenerate() {
    if (!range?.from || !range?.to) {
      toast.error("Pick a start and end date.");
      return;
    }
    const periodStart = format(range.from, "yyyy-MM-dd");
    const periodEnd = format(range.to, "yyyy-MM-dd");
    try {
      const invoice = await generate.mutateAsync({ periodStart, periodEnd });
      setOpen(false);
      toast.success(`Generated ${invoice.invoiceNumber}`);
      router.push(`/invoices/${invoice.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate invoice");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button>
            <Plus />
            Generate Invoice
          </Button>
        }
      />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Generate invoice</DialogTitle>
          <DialogDescription>
            Pulls billable hours and work logged in the selected period into a new draft report.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Period</span>
            <Button variant="ghost" size="sm" onClick={() => setRange(lastFullWeek())}>
              Last full week
            </Button>
          </div>
          <Popover>
            <PopoverTrigger
              render={
                <Button variant="outline" className="w-full justify-start font-normal">
                  <CalendarIcon />
                  {range?.from ? format(range.from, "MMM d, yyyy") : "Start date"}
                  {" – "}
                  {range?.to ? format(range.to, "MMM d, yyyy") : "End date"}
                </Button>
              }
            />
            <PopoverContent className="w-auto p-2" align="start">
              <Calendar
                mode="range"
                selected={range}
                onSelect={setRange}
                defaultMonth={range?.from}
                numberOfMonths={1}
              />
            </PopoverContent>
          </Popover>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={generate.isPending}>
            {generate.isPending && <Loader2 className="animate-spin" />}
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
