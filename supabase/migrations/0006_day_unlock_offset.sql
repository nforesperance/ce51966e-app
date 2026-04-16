-- How many minutes before local midnight (in the program's timezone) a new day
-- becomes active. Matches the prayer task's start-window tolerance so a
-- participant can legitimately tap "Start" just before 00:00 and score full
-- marks. Default 0 (day activates exactly at midnight).

alter table public.programs
  add column if not exists day_unlock_offset_minutes int not null default 0;

alter table public.programs
  drop constraint if exists programs_unlock_offset_range;
alter table public.programs
  add constraint programs_unlock_offset_range
    check (day_unlock_offset_minutes between 0 and 60);
