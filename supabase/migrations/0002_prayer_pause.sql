-- Adds pause/resume support to prayer task completions.
--   first_started_at  : the very first Start tap (used for on-time scoring).
--   elapsed_seconds   : accumulated prayer seconds across pauses/resumes.
--   started_at remains but now means "current active segment start, or null if paused/not-running".
--
-- Scoring uses first_started_at for the ±full_marks_window check and
-- elapsed_seconds (plus any live segment) for the 90%-duration check.

alter table public.task_completions
  add column if not exists first_started_at timestamptz,
  add column if not exists elapsed_seconds int not null default 0;

-- Back-fill existing completions so historical data still scores correctly.
update public.task_completions
set first_started_at = coalesce(first_started_at, started_at)
where first_started_at is null and started_at is not null;

update public.task_completions
set elapsed_seconds = coalesce(
  elapsed_seconds,
  case when started_at is not null and completed_at is not null
    then greatest(0, extract(epoch from (completed_at - started_at))::int)
    else 0 end
)
where elapsed_seconds = 0 and completed_at is not null;
