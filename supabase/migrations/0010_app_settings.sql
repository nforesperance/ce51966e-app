-- App-wide settings edited at /admin/settings (task defaults, scoring thresholds,
-- reading speed, card defaults, new-program defaults). One row, id = 'global'.
-- Missing keys fall back to the built-in values in src/lib/appDefaults.ts.

create table if not exists public.app_settings (
  id          text primary key check (id = 'global'),
  value       jsonb not null default '{}'::jsonb,
  updated_by  uuid references public.users(id) on delete set null,
  updated_at  timestamptz not null default now()
);

insert into public.app_settings (id) values ('global') on conflict (id) do nothing;

-- Accessed only through the server (service role); no public policies.
alter table public.app_settings enable row level security;
