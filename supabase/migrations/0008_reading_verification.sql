-- Bible reading: translation per task + per-chapter verification state.
--
-- chapter_states shape (keys are chapter references as stored in task.metadata.chapters):
-- {
--   "Psalm 1": {
--     "read_at": "2026-04-18T05:12:13Z",
--     "dwell_seconds": 180,
--     "recall_verse": 4,
--     "reflection": "…",
--     "word_count": 215
--   },
--   ...
-- }

alter table public.tasks
  add column if not exists translation text not null default 'kjv';

alter table public.tasks
  drop constraint if exists tasks_translation_enum;
alter table public.tasks
  add constraint tasks_translation_enum
    check (translation in ('kjv','web'));

alter table public.task_completions
  add column if not exists chapter_states jsonb not null default '{}'::jsonb;
