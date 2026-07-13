/**
 * Stable Work Log ID generation for Work Done records.
 * Format: AFP-WORK-YYYY-MM-DD-###
 */

const WORK_LOG_ID_PATTERN = /^AFP-WORK-(\d{4}-\d{2}-\d{2})-(\d{3})$/;

export interface WorkLogIdInput {
  date: string;
  existingOnDate?: readonly string[];
  sequence?: number;
}

export function parseWorkLogId(workLogId: string): { date: string; sequence: number } | null {
  const match = WORK_LOG_ID_PATTERN.exec(workLogId.trim());
  if (!match) return null;
  return { date: match[1], sequence: Number.parseInt(match[2], 10) };
}

export function formatWorkLogId(date: string, sequence: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid date for Work Log ID: ${date}`);
  }
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 999) {
    throw new Error(`Work Log ID sequence must be 1–999, got ${sequence}`);
  }
  return `AFP-WORK-${date}-${String(sequence).padStart(3, "0")}`;
}

function usedSequencesOnDate(date: string, existing: readonly string[]): Set<number> {
  const used = new Set<number>();
  for (const id of existing) {
    const parsed = parseWorkLogId(id);
    if (parsed?.date === date) used.add(parsed.sequence);
  }
  return used;
}

export function nextWorkLogSequence(date: string, existingOnDate: readonly string[] = []): number {
  const used = usedSequencesOnDate(date, existingOnDate);
  for (let seq = 1; seq <= 999; seq++) {
    if (!used.has(seq)) return seq;
  }
  throw new Error(`No available Work Log ID sequence for ${date}`);
}

export function generateWorkLogId(input: WorkLogIdInput): string {
  const existing = input.existingOnDate ?? [];
  const sequence = input.sequence ?? nextWorkLogSequence(input.date, existing);
  const candidate = formatWorkLogId(input.date, sequence);
  if (existing.includes(candidate)) {
    throw new Error(`Work Log ID collision: ${candidate}`);
  }
  return candidate;
}

export function assignWorkLogIdsForBackfill<T extends { id: string; date: string; title?: string }>(
  records: readonly T[],
): Map<string, string> {
  const byDate = new Map<string, T[]>();
  for (const record of records) {
    const list = byDate.get(record.date) ?? [];
    list.push(record);
    byDate.set(record.date, list);
  }
  const result = new Map<string, string>();
  for (const [date, dayRecords] of byDate) {
    const sorted = [...dayRecords].sort((a, b) => {
      const titleCmp = (a.title ?? "").localeCompare(b.title ?? "");
      if (titleCmp !== 0) return titleCmp;
      return a.id.localeCompare(b.id);
    });
    const assigned: string[] = [];
    sorted.forEach((record, index) => {
      const workLogId = generateWorkLogId({ date, sequence: index + 1, existingOnDate: assigned });
      result.set(record.id, workLogId);
      assigned.push(workLogId);
    });
  }
  return result;
}
