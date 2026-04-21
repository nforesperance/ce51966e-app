-- Card preview / generator config.
-- Stored as JSONB so we can evolve the shape without further migrations.
--
-- Shape (all keys optional; renderer applies sensible defaults):
-- {
--   "theme": "theme-royal",
--   "group_name": "ELMOAN",
--   "level": "Level 1",
--   "group_name_size": 16,
--   "level_size": 10,
--   "day_size": 36,
--   "prayer_font_size": 14,
--   "verse_font_size": 14,
--   "footer_text": ""
-- }

alter table public.prayer_points
  add column if not exists card_config jsonb not null default '{}'::jsonb;

-- Program-level defaults. When a prayer_point's card_config is empty, the
-- program's defaults are merged in.
alter table public.programs
  add column if not exists card_defaults jsonb not null default '{"theme":"theme-royal"}'::jsonb;
