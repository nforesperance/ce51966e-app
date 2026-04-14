-- Adds an end-time tolerance for prayer scoring.
--
-- Prayer score = min(start_ratio, end_ratio) * max_points, where:
--   start_ratio: 100% if first_started_at is within +/- full_marks_window_minutes of target_start,
--                linear decay to 0 at zero_marks_window_minutes late.
--   end_ratio:   100% if completed_at is within +/- full_marks_end_window_minutes of target_end
--                (target_end = target_start + duration), linear decay to 0 at
--                zero_marks_end_window_minutes late. No penalty for finishing early.
--
-- Rationale: prevents "start on time, fall asleep, wake up hours later and finish" from
-- scoring well just because the timer kept running.

alter table public.tasks
  add column if not exists full_marks_end_window_minutes int default 5,
  add column if not exists zero_marks_end_window_minutes int default 120;
