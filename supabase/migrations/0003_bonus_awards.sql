-- Discretionary bonus points an admin can award to a participant within a program.
-- Independent of tasks (e.g. group participation, special contribution).
create table if not exists public.bonus_awards (
  id           uuid primary key default gen_random_uuid(),
  program_id   uuid not null references public.programs(id) on delete cascade,
  user_id      uuid not null references public.users(id) on delete cascade,
  points       int not null,
  reason       text,
  awarded_by   uuid references public.users(id),
  created_at   timestamptz not null default now()
);
create index if not exists bonus_awards_program_user_idx
  on public.bonus_awards(program_id, user_id);
alter table public.bonus_awards enable row level security;
