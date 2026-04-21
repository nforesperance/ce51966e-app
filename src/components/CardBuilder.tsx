"use client";

import { useRef, useState } from "react";
import { Download, Image as ImageIcon } from "lucide-react";
import CardPreview, { THEMES, type CardConfig } from "@/components/CardPreview";

type Scripture = { reference: string; text: string };

export default function CardBuilder({
  config, onChange,
  groupName, level, dayNumber, title, bodyHtml, scriptures,
  filenameBase,
}: {
  config: CardConfig;
  onChange: (c: CardConfig) => void;
  groupName: string;
  level: string | null;
  dayNumber: number | null;
  title: string | null;
  bodyHtml: string | null;
  scriptures: Scripture[];
  filenameBase: string;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [downloading, setDownloading] = useState(false);

  async function download() {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(cardRef.current, {
        scale: 3, backgroundColor: null, useCORS: true, logging: false,
      });
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filenameBase}.png`;
      a.click();
    } catch (e) {
      alert(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setDownloading(false); }
  }

  const patch = (p: Partial<CardConfig>) => onChange({ ...config, ...p });
  const mappedScriptures = scriptures
    .filter((s) => s.reference.trim())
    .map((s) => ({ reference: s.reference.trim(), text: s.text?.trim() || null }));

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <ImageIcon size={18} className="text-gold" /> Card preview
        </h3>
        <button onClick={download} disabled={downloading} className="btn-gold text-sm flex items-center gap-2">
          <Download size={15} /> {downloading ? "Rendering…" : "Download PNG"}
        </button>
      </div>

      {/* Controls */}
      <div className="grid sm:grid-cols-2 gap-4 mb-5">
        <Field label="Theme">
          <select
            className="input"
            value={config.theme ?? "theme-royal"}
            onChange={(e) => patch({ theme: e.target.value })}
          >
            {THEMES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>

        <Field label="Footer text (optional)">
          <input className="input" placeholder="21-Day Prayer Training"
            value={config.footer_text ?? ""}
            onChange={(e) => patch({ footer_text: e.target.value })} />
        </Field>

        <Field label="Group name (override)">
          <input className="input" placeholder={groupName}
            value={config.group_name ?? ""}
            onChange={(e) => patch({ group_name: e.target.value })} />
        </Field>

        <Field label="Level (override)">
          <input className="input" placeholder={level ?? ""}
            value={config.level ?? ""}
            onChange={(e) => patch({ level: e.target.value })} />
        </Field>

        <Slider label="Group size"  value={config.group_name_size ?? 26} min={14} max={44}
          onChange={(v) => patch({ group_name_size: v })} />
        <Slider label="Level size"  value={config.level_size ?? 11} min={8}  max={22}
          onChange={(v) => patch({ level_size: v })} />
        <Slider label="Day size"    value={config.day_size ?? 44} min={20} max={72}
          onChange={(v) => patch({ day_size: v })} />
        <Slider label="Body size"   value={config.prayer_font_size ?? 15} min={10} max={24}
          onChange={(v) => patch({ prayer_font_size: v })} />
        <Slider label="Verse size"  value={config.verse_font_size ?? 13} min={10} max={22}
          onChange={(v) => patch({ verse_font_size: v })} />

        <Field label="Show day number">
          <label className="flex items-center gap-2 text-sm pt-2">
            <input type="checkbox"
              checked={config.show_day !== false}
              onChange={(e) => patch({ show_day: e.target.checked })} />
            Include the big day number
          </label>
        </Field>
      </div>

      {/* Preview */}
      <div className="flex justify-center overflow-x-auto py-4 bg-black/20 rounded-xl">
        <CardPreview
          ref={cardRef}
          config={config}
          groupName={groupName}
          level={level}
          dayNumber={dayNumber}
          title={title}
          bodyHtml={bodyHtml}
          scriptures={mappedScriptures}
        />
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label block mb-1">{label}</label>
      {children}
    </div>
  );
}

function Slider({ label, value, min, max, onChange }: {
  label: string; value: number; min: number; max: number; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="label">{label}</label>
        <span className="text-xs text-fg-muted tabular-nums">{value}px</span>
      </div>
      <input
        type="range" min={min} max={max} step={1} value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="w-full accent-[color:var(--gold)]"
      />
    </div>
  );
}
