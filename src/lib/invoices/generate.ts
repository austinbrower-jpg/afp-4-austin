import { formatCurrency, formatHours } from "@/lib/calculations";
import type { InvoiceLineItem, InvoiceReport, WorkLog } from "@/types/domain";

/**
 * Auto-generates the next invoice number, continuing whatever numeric
 * sequence the most recent invoice used (e.g. "AFP-2026-097" -> "AFP-2026-098").
 * Falls back to "<CLIENTCODE>-<year>-001" when there's no prior invoice to
 * anchor the sequence to.
 */
export function nextInvoiceNumber(
  clientName: string,
  existing: InvoiceReport[],
  year: number = new Date().getFullYear(),
): string {
  const clientCode = (clientName.match(/[A-Za-z0-9]/g) ?? ["C"]).join("").toUpperCase().slice(0, 6) || "INV";
  const parsed = existing
    .map((inv) => {
      const m = inv.invoiceNumber.match(/^(.*?)(\d+)$/);
      if (!m) return null;
      return { prefix: m[1], num: parseInt(m[2], 10), width: m[2].length };
    })
    .filter((x): x is { prefix: string; num: number; width: number } => x !== null)
    .sort((a, b) => b.num - a.num);

  if (parsed.length === 0) {
    return `${clientCode}-${year}-001`;
  }
  const top = parsed[0];
  const nextNum = top.num + 1;
  return `${top.prefix}${String(nextNum).padStart(top.width, "0")}`;
}

/**
 * Estimates hours-per-work-log for the invoice's "Work Performed" list.
 *
 * There's no hard link between WorkLog and HoursEntry in the seed/mock data
 * (relatedWorkLogId / relatedHoursIds are left empty), so the invoice total
 * (totalHours/totalAmount) is always computed directly from billable
 * HoursEntry rows - that number is authoritative. The per-line-item hours
 * shown in "Work Performed" are an estimate: billable hours logged on a
 * given calendar date are split evenly across the WorkLog rows dated that
 * same day. Dates with hours but no WorkLog aren't represented as a line
 * item (their hours still count toward the invoice total).
 */
export function buildLineItems(
  worklogs: WorkLog[],
  billableEntries: { date: string; totalHours: number }[],
): InvoiceLineItem[] {
  const hoursByDate = new Map<string, number>();
  for (const e of billableEntries) {
    hoursByDate.set(e.date, (hoursByDate.get(e.date) ?? 0) + e.totalHours);
  }
  const worklogsByDate = new Map<string, WorkLog[]>();
  for (const w of worklogs) {
    const list = worklogsByDate.get(w.date) ?? [];
    list.push(w);
    worklogsByDate.set(w.date, list);
  }

  return worklogs.map((w) => {
    const sameDayCount = worklogsByDate.get(w.date)?.length ?? 1;
    const dayHours = hoursByDate.get(w.date) ?? 0;
    const hours = Math.round((dayHours / sameDayCount) * 100) / 100;
    return {
      workLogId: w.id,
      title: w.title,
      description: w.invoiceDescription || w.summary,
      hours,
    };
  });
}

export function buildSummary(
  periodStart: string,
  periodEnd: string,
  lineItems: InvoiceLineItem[],
  totalHours: number,
  hourlyRate: number,
): string {
  const highlights = lineItems
    .slice(0, 5)
    .map((li) => li.title)
    .join("; ");
  return `Invoice for work performed ${periodStart} to ${periodEnd} - ${formatHours(totalHours)} @ ${formatCurrency(hourlyRate)}/hr.${
    highlights ? ` Highlights: ${highlights}.` : ""
  }`;
}
