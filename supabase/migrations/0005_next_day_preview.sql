-- Allows participants to peek at the next day's prayer point either:
--   (a) when they've completed all of today's tasks, OR
--   (b) when we're within `next_day_preview_hours` of the next day's start.
-- Tasks themselves remain locked to their own calendar day so timing-based
-- scoring isn't bypassed.

alter table public.programs
  add column if not exists next_day_preview_hours int not null default 0;

alter table public.programs
  drop constraint if exists programs_preview_hours_range;
alter table public.programs
  add constraint programs_preview_hours_range
    check (next_day_preview_hours between 0 and 24);
