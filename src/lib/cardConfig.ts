// Card preview configuration. Stored as JSONB on programs.card_defaults
// (program-wide) and prayer_points.card_config (per-day overrides).
// Effective config = CARD_BASE ← program defaults ← day overrides.

export type CardConfig = {
  theme?: string;
  accent_color?: string;       // overrides the theme accent
  group_name?: string;
  group_name_size?: number;
  day_size?: number;
  title_size?: number;
  prayer_font_size?: number;
  verse_font_size?: number;
  footer_text?: string;
  show_day?: boolean;
  rounded_corners?: boolean;
  // Legacy keys kept so older rows still type-check.
  level?: string;
  level_size?: number;
  show_level?: boolean;
};

export const THEMES: { value: string; label: string; accent: string; bg: string }[] = [
  { value: "theme-royal",    label: "Royal Gold",    accent: "#d4af37", bg: "linear-gradient(160deg,#0f3460 0%,#1a1a2e 50%,#16213e 100%)" },
  { value: "theme-fire",     label: "Fire",          accent: "#f39c12", bg: "linear-gradient(160deg,#4a1a0a 0%,#1a0a04 50%,#2d1206 100%)" },
  { value: "theme-grace",    label: "Grace Purple",  accent: "#c39be8", bg: "linear-gradient(160deg,#1a0a2e 0%,#0d0620 50%,#1a0e30 100%)" },
  { value: "theme-earth",    label: "Earth Green",   accent: "#6ecf8e", bg: "linear-gradient(160deg,#1a2e0f 0%,#0d1a08 50%,#1e3012 100%)" },
  { value: "theme-ocean",    label: "Ocean Blue",    accent: "#4dd0e1", bg: "linear-gradient(160deg,#0a2e4e 0%,#061a2e 50%,#0d3355 100%)" },
  { value: "theme-crimson",  label: "Crimson",       accent: "#ff6b81", bg: "linear-gradient(160deg,#3b0a0a 0%,#1a0505 50%,#2a0808 100%)" },
  { value: "theme-midnight", label: "Midnight",      accent: "#e0e0e0", bg: "linear-gradient(160deg,#141428 0%,#0a0a1a 50%,#1a1a30 100%)" },
  { value: "theme-sunrise",  label: "Sunrise",       accent: "#ffd166", bg: "linear-gradient(160deg,#4a2010 0%,#2a1008 50%,#3d1a0e 100%)" },
  { value: "theme-silver",   label: "Silver",        accent: "#c8c8d8", bg: "linear-gradient(160deg,#2c2c3a 0%,#1a1a24 50%,#262632 100%)" },
  { value: "theme-burgundy", label: "Burgundy Wine", accent: "#f48fb1", bg: "linear-gradient(160deg,#3b0f2a 0%,#1a0812 50%,#2e0c20 100%)" },
  { value: "theme-emerald",  label: "Emerald",       accent: "#58d68d", bg: "linear-gradient(160deg,#0a3020 0%,#051a10 50%,#0e3828 100%)" },
  { value: "theme-sapphire", label: "Sapphire",      accent: "#9fa8da", bg: "linear-gradient(160deg,#0d1b4a 0%,#060e28 50%,#10204e 100%)" },
];

export const THEME_MAP = Object.fromEntries(THEMES.map((t) => [t.value, t]));

/** Built-in fallbacks for every key the renderer reads. */
export const CARD_BASE: Required<Pick<CardConfig,
  "theme" | "accent_color" | "group_name" | "group_name_size" | "day_size" | "title_size"
  | "prayer_font_size" | "verse_font_size" | "footer_text" | "show_day" | "rounded_corners"
>> = {
  theme: "theme-royal",
  accent_color: "",
  group_name: "",
  group_name_size: 26,
  day_size: 44,
  title_size: 17,
  prayer_font_size: 15,
  verse_font_size: 13,
  footer_text: "",
  show_day: true,
  rounded_corners: true,
};

export type ResolvedCardConfig = typeof CARD_BASE;
const CARD_KEYS = Object.keys(CARD_BASE) as (keyof ResolvedCardConfig)[];

/** Merge layers left→right over the built-in base, ignoring undefined/null. */
export function resolveCardConfig(...layers: (CardConfig | Record<string, unknown> | null | undefined)[]): ResolvedCardConfig {
  const out: Record<string, unknown> = { ...CARD_BASE };
  for (const layer of layers) {
    if (!layer) continue;
    for (const key of CARD_KEYS) {
      const v = (layer as Record<string, unknown>)[key];
      if (v !== undefined && v !== null) out[key] = v;
    }
  }
  return out as ResolvedCardConfig;
}

/** Keys of `config` that differ from `base` — what gets stored as day overrides. */
export function diffCardConfig(config: ResolvedCardConfig, base: ResolvedCardConfig): CardConfig {
  const out: Record<string, unknown> = {};
  for (const key of CARD_KEYS) if (config[key] !== base[key]) out[key] = config[key];
  return out as CardConfig;
}

/** Only the known, renderable keys (used when saving presets / program defaults). */
export function pickCardConfig(config: ResolvedCardConfig): CardConfig {
  return diffCardConfig(config, {} as ResolvedCardConfig);
}

export function describeCardConfig(c: CardConfig): string {
  const r = resolveCardConfig(c);
  const theme = THEME_MAP[r.theme]?.label ?? r.theme;
  return [theme, `body ${r.prayer_font_size}px`, `verse ${r.verse_font_size}px`, r.footer_text && `“${r.footer_text}”`]
    .filter(Boolean).join(" · ");
}
