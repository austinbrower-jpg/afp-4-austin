/**
 * Stable Session ID generation for Hours Worked.
 * Format: AFP-YYYY-MM-DD-###
 *
 * Immutable once assigned. Deterministic for historical backfill.
 * Collision-safe for new records on the same date.
 */

const SESSION_ID_PATTERN = /^AFP-(\d{4}-\d{2}-\d{2})-(\d{3})$/;

export interface SessionIdInput {
  date: string;
  /** Existing Session IDs on the same date — used for collision prevention. */
  existingOnDate?: readonly string[];
  /** When backfilling, assign a fixed sequence number. */
  sequence?: number;
}

export function parseSessionId(sessionId: string): { date: string; sequence: number } | null {
  const match = SESSION_ID_PATTERN.exec(sessionId.trim());
  if (!match) return null;
  return { date: match[1], sequence: Number.parseInt(match[2], 10) };
}

export function formatSessionId(date: string, sequence: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid date for Session ID: ${date}`);
  }
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 999) {
    throw new Error(`Session ID sequence must be 1–999, got ${sequence}`);
  }
  return `AFP-${date}-${String(sequence).padStart(3, "0")}`;
}

function usedSequencesOnDate(date: string, existing: readonly string[]): Set<number> {
  const used = new Set<number>();
  for (const id of existing) {
    const parsed = parseSessionId(id);
    if (parsed?.date === date) used.add(parsed.sequence);
  }
  return used;
}

/** Next available sequence for a date, skipping collisions. */
export function nextSessionSequence(date: string, existingOnDate: readonly string[] = []): number {
  const used = usedSequencesOnDate(date, existingOnDate);
  for (let seq = 1; seq <= 999; seq++) {
    if (!used.has(seq)) return seq;
  }
  throw new Error(`No available Session ID sequence for ${date}`);
}

export function generateSessionId(input: SessionIdInput): string {
  const existing = input.existingOnDate ?? [];
  const sequence = input.sequence ?? nextSessionSequence(input.date, existing);
  const candidate = formatSessionId(input.date, sequence);
  if (existing.includes(candidate)) {
    throw new Error(`Session ID collision: ${candidate}`);
  }
  return candidate;
}

/**
 * Deterministic backfill ordering: sort by start time, then migration key, then id.
 * Returns a map from record id to proposed Session ID.
 */
export function assignSessionIdsForBackfill<T extends { id: string; date: string; startTime: string; migrationKey?: string | null }>(
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
      const timeCmp = a.startTime.localeCompare(b.startTime);
      if (timeCmp !== 0) return timeCmp;
      const keyA = a.migrationKey ?? "";
      const keyB = b.migrationKey ?? "";
      const keyCmp = keyA.localeCompare(keyB);
      if (keyCmp !== 0) return keyCmp;
      return a.id.localeCompare(b.id);
    });
    const assigned: string[] = [];
    sorted.forEach((record, index) => {
      const sessionId = generateSessionId({ date, sequence: index + 1, existingOnDate: assigned });
      result.set(record.id, sessionId);
      assigned.push(sessionId);
    });
  }
  return result;
}
