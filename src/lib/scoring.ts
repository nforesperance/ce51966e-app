import { zonedToUtc, minutesBetween } from "@/lib/time";

export type PrayerTaskParams = {
  duration_minutes: number | null;
  target_start_time: string | null;
  full_marks_window_minutes: number | null;
  zero_marks_window_minutes: number | null;
  full_marks_end_window_minutes: number | null;
  zero_marks_end_window_minutes: number | null;
  max_points: number | null;
};

// Prayer scoring:
//   1. Actual prayer minutes (elapsed_seconds / 60) must be >= duration * 0.9, else 0.
//   2. start_ratio: based on first_started_at vs target_start.
//        - within ±full_marks_window → 1
//        - earlier than -full_marks_window → 1 (no penalty for early)
//        - later: linear decay, 0 at zero_marks_window minutes past target_start
//   3. end_ratio: based on completed_at vs target_end (= target_start + duration).
//        - earlier than or within +full_marks_end_window of target_end → 1
//        - later: linear decay, 0 at zero_marks_end_window minutes past target_end
//   4. points = round(min(start_ratio, end_ratio) * max_points)
export function scorePrayer({
  task, programDate, programTimezone, firstStartedAt, completedAt, elapsedSeconds,
}: {
  task: PrayerTaskParams;
  programDate: string;
  programTimezone: string;
  firstStartedAt: Date;
  completedAt: Date;
  elapsedSeconds: number;
}): number {
  const max = task.max_points ?? 100;
  const durMin = task.duration_minutes ?? 0;

  if (durMin > 0 && elapsedSeconds < durMin * 60 * 0.9) return 0;
  if (!task.target_start_time || !durMin) return max;

  const fullStart = task.full_marks_window_minutes ?? 5;
  const zeroStart = task.zero_marks_window_minutes ?? 120;
  const fullEnd = task.full_marks_end_window_minutes ?? 5;
  const zeroEnd = task.zero_marks_end_window_minutes ?? 120;

  const targetStart = zonedToUtc(programDate, task.target_start_time, programTimezone);
  const targetEnd = new Date(targetStart.getTime() + durMin * 60_000);

  const startDelta = minutesBetween(targetStart, firstStartedAt);
  let startRatio: number;
  if (startDelta <= fullStart) startRatio = 1;
  else if (startDelta >= zeroStart) startRatio = 0;
  else startRatio = 1 - (startDelta - fullStart) / (zeroStart - fullStart);

  const endDelta = minutesBetween(targetEnd, completedAt);
  let endRatio: number;
  if (endDelta <= fullEnd) endRatio = 1;
  else if (endDelta >= zeroEnd) endRatio = 0;
  else endRatio = 1 - (endDelta - fullEnd) / (zeroEnd - fullEnd);

  return Math.round(Math.min(startRatio, endRatio) * max);
}
