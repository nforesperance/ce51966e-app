"use client";

import { Check, RotateCcw } from "lucide-react";
import { THEMES, THEME_MAP, type ResolvedCardConfig } from "@/lib/cardConfig";
import { normalizeHexColor } from "@/lib/colors";

/** Theme / text / size controls for a card design. Sliders show a reset when they differ from `base`. */
export default function CardControls({ config, base, onChange, groupName }: {
  config: ResolvedCardConfig;
  base: ResolvedCardConfig;
  onChange: (patch: Partial<ResolvedCardConfig>) => void;
  groupName: string;
}) {
  const patch = onChange;
  const themeAccent = THEME_MAP[config.theme]?.accent ?? "#d4af37";
  return (
    <div className="min-w-0 space-y-5">
      <Section title="Theme">
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {THEMES.map((t) => {
            const selected = config.theme === t.value;
            return (
              <button key={t.value} type="button" title={t.label}
                onClick={() => patch({ theme: t.value, accent_color: "" })}
                className={`group relative h-12 rounded-lg border-2 transition-transform hover:scale-105 ${
                  selected ? "border-[color:var(--gold)]" : "border-transparent"
                }`}
                style={{ background: t.bg }}>
                <span className="absolute left-1/2 top-1.5 h-1 w-6 -translate-x-1/2 rounded-full" style={{ background: t.accent }} />
                <span className="absolute inset-x-0 bottom-1 truncate px-1 text-[9px] font-medium text-white/80">{t.label}</span>
                {selected && <Check size={12} className="absolute right-1 top-1 text-gold" />}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <label className="text-xs text-fg-muted">Accent color</label>
          <input type="color"
            value={normalizeHexColor(config.accent_color) ?? themeAccent}
            onChange={(e) => patch({ accent_color: e.target.value })}
            className="h-7 w-10 cursor-pointer rounded border border-[color:var(--border)] bg-transparent" />
          {config.accent_color && (
            <button type="button" onClick={() => patch({ accent_color: "" })}
              className="flex items-center gap-1 text-xs text-fg-muted hover:text-gold">
              <RotateCcw size={11} /> Use theme accent
            </button>
          )}
        </div>
      </Section>

      <Section title="Text">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Group name">
            <input className="input py-2 text-sm" placeholder={groupName}
              value={config.group_name} onChange={(e) => patch({ group_name: e.target.value })} />
          </Field>
          <Field label="Footer">
            <input className="input py-2 text-sm" placeholder="21-Day Prayer Training"
              value={config.footer_text} onChange={(e) => patch({ footer_text: e.target.value })} />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Toggle checked={config.show_day} onChange={(v) => patch({ show_day: v })} label="Show day number" />
          <Toggle checked={config.rounded_corners} onChange={(v) => patch({ rounded_corners: v })} label="Rounded corners" />
        </div>
      </Section>

      <Section title="Sizes">
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Slider label="Group name" value={config.group_name_size} base={base.group_name_size} min={14} max={44} onChange={(v) => patch({ group_name_size: v })} />
          <Slider label="Day number" value={config.day_size} base={base.day_size} min={20} max={72} onChange={(v) => patch({ day_size: v })} />
          <Slider label="Title" value={config.title_size} base={base.title_size} min={12} max={30} onChange={(v) => patch({ title_size: v })} />
          <Slider label="Body" value={config.prayer_font_size} base={base.prayer_font_size} min={10} max={24} onChange={(v) => patch({ prayer_font_size: v })} />
          <Slider label="Verses" value={config.verse_font_size} base={base.verse_font_size} min={10} max={22} onChange={(v) => patch({ verse_font_size: v })} />
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="label mb-2">{title}</p>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-fg-muted">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[color:var(--gold)]" />
      {label}
    </label>
  );
}

function Slider({ label, value, base, min, max, onChange }: {
  label: string; value: number; base: number; min: number; max: number; onChange: (v: number) => void;
}) {
  const changed = value !== base;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <label className="text-xs text-fg-muted">{label}</label>
        <span className="flex items-center gap-2 text-xs tabular-nums">
          {changed && (
            <button type="button" title={`Reset to ${base}px`} onClick={() => onChange(base)}
              className="text-fg-muted hover:text-gold"><RotateCcw size={11} /></button>
          )}
          <span className={changed ? "text-gold" : "text-fg-muted"}>{value}px</span>
        </span>
      </div>
      <input type="range" min={min} max={max} step={1} value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="w-full accent-[color:var(--gold)]" />
    </div>
  );
}
