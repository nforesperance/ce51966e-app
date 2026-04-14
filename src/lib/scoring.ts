import { zonedToUtc, minutesBetween } from "@/lib/time";

export type PrayerTaskParams = {
  duration_minutes: number | null;
  target_start_time: string | null;
  full_marks_window_minutes: number | null;
  zero_marks_window_minutes: number | null;
  max_points: number | null;
};

// Prayer scoring:
//   1. Actual prayer minutes (elapsed_seconds / 60) must be >= duration * 0.9, else 0.
//   2. On-time bonus is based on first_started_at vs. target:
//      - within ±full_marks_window → 100%
//      - earlier than -full_marks_window → still 100% (no penalty for being early)
//      - later, linear decay to 0 at zero_marks_window
//      - past zero_marks_window → 0
export function scorePrayer({
  task, programDate, programTimezone, firstStartedAt, elapsedSeconds,
}: {
  task: PrayerTaskParams;
  programDate: string;
  programTimezone: string;
  firstStartedAt: Date;
  elapsedSeconds: number;
}): number {
  const max = task.max_points ?? 100;
  const durMin = task.duration_minutes ?? 0;
  const fullWin = task.full_marks_window_minutes ?? 5;
  const zeroWin = task.zero_marks_window_minutes ?? 120;

  if (durMin > 0 && elapsedSeconds < durMin * 60 * 0.9) return 0;
  if (!task.target_start_time || !durMin) return max;

  const target = zonedToUtc(programDate, task.target_start_time, programTimezone);
  const delta = minutesBetween(target, firstStartedAt);
  let ratio: number;
  if (delta <= fullWin) ratio = 1;
  else if (delta >= zeroWin) ratio = 0;
  else ratio = 1 - (delta - fullWin) / (zeroWin - fullWin);
  return Math.round(ratio * max);
}
