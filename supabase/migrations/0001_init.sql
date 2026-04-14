-- Elmoan — Prayer & Bible Study schema
-- Runs on Supabase Postgres. Requires pgcrypto for gen_random_uuid().

create extension if not exists pgcrypto;

-- ---------- USERS ----------
-- We don't use Supabase Auth (email/password) — login is via short login key.
-- login_key_hash stores a bcrypt hash of the 4-char key.
create table if not exists public.users (
  id              uuid primary key default gen_random_uuid(),
  full_name       text not null,
  phone           text,
  whatsapp        text,
  role            text not null check (role in ('admin','participant')) default 'participant',
  level           text,
  login_key_hash  text not null,
  login_key_hint  text,                   -- first char + '***' for admin display
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  last_login_at   timestamptz
);
create index if not exists users_role_idx on public.users(role);

-- ---------- SESSIONS ----------
-- Opaque session tokens stored server-side. Cookie holds the token id.
create table if not exists public.sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  token_hash   text not null,
  expires_at   timestamptz not null,
  created_at   timestamptz not null default now(),
  user_agent   text
);
create index if not exists sessions_user_idx on public.sessions(user_id);

-- ---------- PROGRAMS ----------
create table if not exists public.programs (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  start_date   date not null,
  end_date     date not null,
  timezone     text not null default 'UTC',
  created_by   uuid references public.users(id),
  created_at   timestamptz not null default now(),
  check (end_date >= start_date)
);

create table if not exists public.program_participants (
  program_id   uuid not null references public.programs(id) on delete cascade,
  user_id      uuid not null references public.users(id) on delete cascade,
  joined_at    timestamptz not null default now(),
  primary key (program_id, user_id)
);

-- Each calendar day of a program; generated when program is created.
create table if not exists public.program_days (
  id           uuid primary key default gen_random_uuid(),
  program_id   uuid not null references public.programs(id) on delete cascade,
  day_number   int not null,
  date         date not null,
  unique(program_id, day_number),
  unique(program_id, date)
);

-- ---------- PRAYER POINTS ----------
create table if not exists public.prayer_points (
  id              uuid primary key default gen_random_uuid(),
  program_day_id  uuid not null references public.program_days(id) on delete cascade,
  title           text,
  body_markdown   text,
  image_url       text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.scriptures (
  id                uuid primary key default gen_random_uuid(),
  prayer_point_id   uuid not null references public.prayer_points(id) on delete cascade,
  reference         text not null,
  text              text,
  position          int not null default 0
);

-- ---------- TASKS ----------
create table if not exists public.tasks (
  id                 uuid primary key default gen_random_uuid(),
  program_day_id     uuid not null references public.program_days(id) on delete cascade,
  type               text not null check (type in ('prayer','reading','other')),
  title              text not null,
  duration_minutes   int,                  -- for 'prayer'
  target_start_time  time,                 -- for 'prayer' e.g. 00:00
  metadata           jsonb not null default '{}'::jsonb,
  -- scoring params (configurable per task)
  full_marks_window_minutes  int default 5,
  zero_marks_window_minutes  int default 120,
  max_points                 int default 100,
  position           int not null default 0,
  created_at         timestamptz not null default now()
);

create table if not exists public.task_completions (
  id                 uuid primary key default gen_random_uuid(),
  task_id            uuid not null references public.tasks(id) on delete cascade,
  user_id            uuid not null references public.users(id) on delete cascade,
  started_at         timestamptz,
  completed_at       timestamptz,
  marked_complete_at timestamptz,
  points_awarded     int not null default 0,
  admin_override     boolean not null default false,
  override_by        uuid references public.users(id),
  override_reason    text,
  unique(task_id, user_id)
);
create index if not exists task_completions_user_idx on public.task_completions(user_id);

-- ---------- AUDIT LOG ----------
create table if not exists public.audit_log (
  id           bigserial primary key,
  actor_id     uuid references public.users(id),
  action       text not null,
  target_type  text,
  target_id    text,
  payload      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

-- ---------- RLS ----------
-- NOTE: this app does NOT use Supabase Auth JWTs. All DB access goes through
-- the Next.js server using the SERVICE ROLE key, which bypasses RLS.
-- We still enable RLS on every table and grant no public policies so that the
-- anon key (safe to expose in browser) cannot read/write anything directly.
alter table public.users              enable row level security;
alter table public.sessions           enable row level security;
alter table public.programs           enable row level security;
alter table public.program_participants enable row level security;
alter table public.program_days       enable row level security;
alter table public.prayer_points      enable row level security;
alter table public.scriptures         enable row level security;
alter table public.tasks              enable row level security;
alter table public.task_completions   enable row level security;
alter table public.audit_log          enable row level security;

-- updated_at trigger for prayer_points
create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end $$ language plpgsql;

drop trigger if exists prayer_points_set_updated on public.prayer_points;
create trigger prayer_points_set_updated
  before update on public.prayer_points
  for each row execute function public.set_updated_at();
