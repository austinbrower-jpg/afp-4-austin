import { create } from "zustand";
import { persist } from "zustand/middleware";
import { todayISO, nowTimeHHMM } from "@/lib/calculations";

export interface TimerStopResult {
  date: string;
  startTime: string;
  endTime: string;
  startedAtIso: string;
  endedAtIso: string;
}

interface TimerState {
  isRunning: boolean;
  /** ISO instant the timer was started - used to compute live elapsed time. */
  startedAtIso: string | null;
  startDate: string | null;
  startTime: string | null;
  stoppedDraft: TimerStopResult | null;
  start: () => void;
  /** Captures endTime = now and returns the shift to persist; does not reset. */
  stop: () => TimerStopResult | null;
  /** Clears timer state after the confirm/edit form is saved or dismissed. */
  reset: () => void;
}

/**
 * Timer mode state. Kept in a small zustand store (persisted to
 * localStorage) so a running timer survives navigating between pages or
 * an accidental refresh, not just component remounts.
 */
export const useHoursTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      isRunning: false,
      startedAtIso: null,
      startDate: null,
      startTime: null,
      stoppedDraft: null,
      start: () => {
        set({
          isRunning: true,
          startedAtIso: new Date().toISOString(),
          startDate: todayISO(),
          startTime: nowTimeHHMM(),
        });
      },
      stop: () => {
        const { isRunning, startDate, startTime, startedAtIso } = get();
        if (!isRunning || !startDate || !startTime || !startedAtIso) return null;
        const capture = { date: startDate, startTime, endTime: nowTimeHHMM(), startedAtIso, endedAtIso: new Date().toISOString() };
        set({ isRunning: false, stoppedDraft: capture });
        return capture;
      },
      reset: () => set({ isRunning: false, startedAtIso: null, startDate: null, startTime: null, stoppedDraft: null }),
    }),
    { name: "afp-hours-timer" },
  ),
);
