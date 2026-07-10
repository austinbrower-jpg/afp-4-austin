"use client";

import { useEffect, useState } from "react";
import { useHoursTimerStore } from "../lib/timer-store";

/** Formats a duration in whole seconds as H:MM:SS. */
export function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Live-updating elapsed-seconds count while the timer is running (ticks every second). */
export function useElapsedSeconds(): number {
  const isRunning = useHoursTimerStore((s) => s.isRunning);
  const startedAtIso = useHoursTimerStore((s) => s.startedAtIso);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  if (!isRunning || !startedAtIso) return 0;
  return Math.max(0, Math.floor((now - new Date(startedAtIso).getTime()) / 1000));
}
