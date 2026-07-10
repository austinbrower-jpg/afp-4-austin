"use client";

import { Play, Square, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useHoursTimerStore } from "../lib/timer-store";
import { formatElapsed, useElapsedSeconds } from "../hooks/use-elapsed-timer";
import type { TimerStopResult } from "../lib/timer-store";

export function HoursTimerCard({ onStopped }: { onStopped: (capture: TimerStopResult) => void }) {
  const isRunning = useHoursTimerStore((s) => s.isRunning);
  const startTime = useHoursTimerStore((s) => s.startTime);
  const start = useHoursTimerStore((s) => s.start);
  const stop = useHoursTimerStore((s) => s.stop);
  const reset = useHoursTimerStore((s) => s.reset);
  const elapsedSeconds = useElapsedSeconds();

  function handleStop() {
    const capture = stop();
    reset();
    if (capture) onStopped(capture);
  }

  return (
    <Card size="sm">
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Timer className="size-4" />
          </div>
          <div>
            <div className="text-sm font-medium">
              {isRunning ? "Timer running" : "Timer mode"}
            </div>
            <div className="text-xs text-muted-foreground">
              {isRunning
                ? `Started at ${startTime} · ${formatElapsed(elapsedSeconds)} elapsed`
                : "Track a live shift, then confirm the details when you stop."}
            </div>
          </div>
        </div>

        {isRunning ? (
          <Button variant="destructive" size="sm" onClick={handleStop}>
            <Square className="size-3.5" />
            Stop
          </Button>
        ) : (
          <Button size="sm" onClick={start}>
            <Play className="size-3.5" />
            Start Timer
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
