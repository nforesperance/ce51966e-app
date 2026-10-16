-- Reusable, named presets shared by all admins.
--   kind = 'card' → config is a CardConfig (theme, sizes, footer, …)
--   kind = 'task' → config is a task template (type, title, duration, scoring windows, …)
-- Saving a preset with an existing (kind, name) overwrites it.

create table if not exists public.presets (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('card','task')),
  name        text not null check (char_length(name) between 1 and 80),
  config      jsonb not null default '{}'::jsonb,
  created_by  uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (kind, name)
);

create index if not exists presets_kind_idx on public.presets(kind, name);

-- Accessed only through the server (service role); no public policies.
alter table public.presets enable row level security;
