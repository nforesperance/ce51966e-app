import { z } from "zod";
import { CARD_BASE, THEMES, type ResolvedCardConfig } from "@/lib/cardConfig";

// App-wide settings, editable at /admin/settings and stored in app_settings.
// BUILT_IN_SETTINGS is only the fallback for anything not saved yet.

const time = z.string().regex(/^\d{2}:\d{2}$/);
const minutes = (min: number) => z.number().int().min(min).max(1440);

export const SettingsSchema = z.object({
  tasks: z.object({
    maxPoints: z.number().int().min(1).max(10000),
    prayer: z.object({
      title: z.string().min(1).max(200),
      durationMinutes: minutes(1),
      targetStartTime: time,
      fullMarksWindowMinutes: minutes(0),
      zeroMarksWindowMinutes: minutes(1),
      fullMarksEndWindowMinutes: minutes(0),
      zeroMarksEndWindowMinutes: minutes(1),
      minCompletionPercent: z.number().int().min(0).max(100),
    }),
    reading: z.object({
      title: z.string().min(1).max(200),
      translation: z.enum(["kjv", "web"]),
      wordsPerMinute: z.number().int().min(20).max(1000),
      minDwellSeconds: z.number().int().min(0).max(3600),
      maxDwellSeconds: z.number().int().min(1).max(7200),
    }),
  }),
  card: z.object({
    theme: z.enum(THEMES.map((t) => t.value) as [string, ...string[]]),
    accent_color: z.string().max(20),
    group_name: z.string().max(120),
    group_name_size: z.number().int().min(8).max(96),
    day_size: z.number().int().min(8).max(160),
    title_size: z.number().int().min(8).max(96),
    prayer_font_size: z.number().int().min(8).max(64),
    verse_font_size: z.number().int().min(8).max(64),
    footer_text: z.string().max(200),
    show_day: z.boolean(),
    rounded_corners: z.boolean(),
  }),
  program: z.object({
    timezone: z.string().min(1).max(64),
    nextDayPreviewHours: z.number().int().min(0).max(24),
    dayUnlockOffsetMinutes: z.number().int().min(0).max(60),
  }),
});

export type AppSettings = Omit<z.infer<typeof SettingsSchema>, "card"> & { card: ResolvedCardConfig };

export const BUILT_IN_SETTINGS: AppSettings = {
  tasks: {
    maxPoints: 100,
    prayer: {
      title: "Midnight prayer",
      durationMinutes: 45,
      targetStartTime: "00:00",
      fullMarksWindowMinutes: 5,
      zeroMarksWindowMinutes: 120,
      fullMarksEndWindowMinutes: 5,
      zeroMarksEndWindowMinutes: 120,
      minCompletionPercent: 90,
    },
    reading: {
      title: "Bible reading",
      translation: "kjv",
      wordsPerMinute: 150,
      minDwellSeconds: 30,
      maxDwellSeconds: 600,
    },
  },
  card: CARD_BASE,
  program: {
    timezone: "UTC",
    nextDayPreviewHours: 0,
    dayUnlockOffsetMinutes: 0,
  },
};

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Deep-merge `patch` over `base`, keeping only keys `base` knows about. */
function mergeKnown<T>(base: T, patch: unknown): T {
  if (!isObject(base) || !isObject(patch)) return base;
  const out: Record<string, unknown> = { ...base };
  for (const key of Object.keys(base)) {
    if (!(key in patch)) continue;
    const b = (base as Record<string, unknown>)[key];
    const p = patch[key];
    if (isObject(b)) out[key] = mergeKnown(b, p);
    else if (p !== undefined && p !== null && typeof p === typeof b) out[key] = p;
  }
  return out as T;
}

/**
 * Stored settings over the built-ins. Fields are validated one section at a time
 * so a single bad value can't wipe out the rest.
 */
export function resolveSettings(stored: unknown): AppSettings {
  const merged = mergeKnown(BUILT_IN_SETTINGS, stored);
  const out = { ...merged };
  for (const section of ["tasks", "card", "program"] as const) {
    const ok = SettingsSchema.shape[section].safeParse(merged[section]).success;
    if (!ok) (out as Record<string, unknown>)[section] = BUILT_IN_SETTINGS[section];
  }
  return out;
}

/** Minimum time on a chapter for a slow, attentive read. */
export function minDwellSeconds(wordCount: number, reading: AppSettings["tasks"]["reading"]): number {
  const est = Math.ceil((wordCount / reading.wordsPerMinute) * 60);
  return Math.max(reading.minDwellSeconds, Math.min(est, reading.maxDwellSeconds));
}
