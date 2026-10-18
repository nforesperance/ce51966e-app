"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, CalendarDays, Check, Clock, Image as ImageIcon, RotateCcw, Save } from "lucide-react";
import CardControls from "@/components/CardControls";
import CardPreview from "@/components/CardPreview";
import { BUILT_IN_SETTINGS, SettingsSchema, type AppSettings } from "@/lib/appDefaults";
import { timezoneOptions } from "@/lib/timezones";

const SAMPLE = {
  title: "Breaking the Spirit of Prayerlessness",
  bodyHtml: "<p>Father, stir up a fresh hunger for Your presence in us. Let every weight that slows our prayer life be broken today.</p>",
  scriptures: [{ reference: "Matthew 26:41", text: "Watch and pray, that ye enter not into temptation." }],
};

type Tasks = AppSettings["tasks"];

export default function SettingsClient({ initial }: { initial: AppSettings }) {
  const [s, setS] = useState<AppSettings>(initial);
  const [saved, setSaved] = useState(() => JSON.stringify(initial));
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = JSON.stringify(s) !== saved;

  const setPrayer = (p: Partial<Tasks["prayer"]>) => setS((x) => ({ ...x, tasks: { ...x.tasks, prayer: { ...x.tasks.prayer, ...p } } }));
  const setReading = (p: Partial<Tasks["reading"]>) => setS((x) => ({ ...x, tasks: { ...x.tasks, reading: { ...x.tasks.reading, ...p } } }));
  const setProgram = (p: Partial<AppSettings["program"]>) => setS((x) => ({ ...x, program: { ...x.program, ...p } }));
  const setCard = (p: Partial<AppSettings["card"]>) => setS((x) => ({ ...x, card: { ...x.card, ...p } }));

  async function save() {
    const check = SettingsSchema.safeParse(s);
    if (!check.success) {
      const issue = check.error.issues[0];
      setError(`${issue.path.join(" › ")}: ${issue.message}`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setError(j.error ?? "Failed to save"); return; }
      setSaved(JSON.stringify(s));
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2500);
    } finally { setSaving(false); }
  }

  // Ctrl/⌘+S saves; warn before leaving with unsaved changes.
  const saveRef = useRef(save);
  useEffect(() => { saveRef.current = save; });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); saveRef.current(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const p = s.tasks.prayer;
  const r = s.tasks.reading;
  const B = BUILT_IN_SETTINGS;

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-30 -mx-2 flex items-center justify-between gap-3 rounded-b-xl bg-[color:var(--bg)]/90 px-2 py-2 backdrop-blur">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <div className="flex items-center gap-3">
          {error ? (
            <span className="max-w-[16rem] truncate text-xs text-[color:var(--danger)]" title={error}>{error}</span>
          ) : dirty ? (
            <span className="text-xs text-gold">Unsaved changes</span>
          ) : justSaved ? (
            <span className="flex items-center gap-1 text-xs text-[color:var(--ok)]"><Check size={14} /> Saved</span>
          ) : null}
          <button type="button" title="Restore built-in defaults (not saved until you click Save)"
            onClick={() => { if (confirm("Restore every setting to the built-in defaults?")) setS(BUILT_IN_SETTINGS); }}
            className="btn-ghost flex items-center gap-1.5 px-3 py-1.5 text-sm">
            <RotateCcw size={14} /> Built-in
          </button>
          <button type="button" onClick={save} disabled={saving || !dirty} title="Save (Ctrl/⌘+S)"
            className="btn-gold flex items-center gap-2 text-sm">
            <Save size={15} /> {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {/* ---------- Prayer ---------- */}
      <Card icon={<Clock size={17} />} title="Prayer tasks">
        <Grid>
          <Text label="Default title" value={p.title} onChange={(v) => setPrayer({ title: v })} />
          <Num label="Duration" unit="min" value={p.durationMinutes} base={B.tasks.prayer.durationMinutes} min={1} max={1440}
            onChange={(v) => setPrayer({ durationMinutes: v })} />
          <Field label="Target start" changed={p.targetStartTime !== B.tasks.prayer.targetStartTime}>
            <input type="time" className="input py-2" value={p.targetStartTime}
              onChange={(e) => setPrayer({ targetStartTime: e.target.value })} />
          </Field>
          <Num label="Min completion" unit="%" value={p.minCompletionPercent} base={B.tasks.prayer.minCompletionPercent} min={0} max={100}
            hint="Share of the duration a participant must pray to earn any points"
            onChange={(v) => setPrayer({ minCompletionPercent: v })} />
        </Grid>
        <Sub title="Start-time scoring" hint="Full marks within the window; drops to zero at the late limit">
          <Grid>
            <Num label="Full marks within" unit="± min" value={p.fullMarksWindowMinutes} base={B.tasks.prayer.fullMarksWindowMinutes} min={0} max={1440}
              onChange={(v) => setPrayer({ fullMarksWindowMinutes: v })} />
            <Num label="Zero marks at" unit="min late" value={p.zeroMarksWindowMinutes} base={B.tasks.prayer.zeroMarksWindowMinutes} min={1} max={1440}
              onChange={(v) => setPrayer({ zeroMarksWindowMinutes: v })} />
          </Grid>
        </Sub>
        <Sub title="End-time scoring">
          <Grid>
            <Num label="Full marks within" unit="± min" value={p.fullMarksEndWindowMinutes} base={B.tasks.prayer.fullMarksEndWindowMinutes} min={0} max={1440}
              onChange={(v) => setPrayer({ fullMarksEndWindowMinutes: v })} />
            <Num label="Zero marks at" unit="min late" value={p.zeroMarksEndWindowMinutes} base={B.tasks.prayer.zeroMarksEndWindowMinutes} min={1} max={1440}
              onChange={(v) => setPrayer({ zeroMarksEndWindowMinutes: v })} />
          </Grid>
        </Sub>
      </Card>

      {/* ---------- Reading ---------- */}
      <Card icon={<BookOpen size={17} />} title="Reading tasks">
        <Grid>
          <Text label="Default title" value={r.title} onChange={(v) => setReading({ title: v })} />
          <Field label="Translation" changed={r.translation !== B.tasks.reading.translation}>
            <select className="input py-2" value={r.translation}
              onChange={(e) => setReading({ translation: e.target.value as Tasks["reading"]["translation"] })}>
              <option value="kjv">KJV — King James</option>
              <option value="web">WEB — World English Bible</option>
            </select>
          </Field>
          <Num label="Reading speed" unit="words/min" value={r.wordsPerMinute} base={B.tasks.reading.wordsPerMinute} min={20} max={1000}
            hint="Sets the minimum time a chapter must stay open"
            onChange={(v) => setReading({ wordsPerMinute: v })} />
          <Num label="Min per chapter" unit="sec" value={r.minDwellSeconds} base={B.tasks.reading.minDwellSeconds} min={0} max={3600}
            onChange={(v) => setReading({ minDwellSeconds: v })} />
          <Num label="Max per chapter" unit="sec" value={r.maxDwellSeconds} base={B.tasks.reading.maxDwellSeconds} min={1} max={7200}
            onChange={(v) => setReading({ maxDwellSeconds: v })} />
        </Grid>
      </Card>

      {/* ---------- All tasks ---------- */}
      <Card title="All tasks">
        <Grid>
          <Num label="Max points" unit="pts" value={s.tasks.maxPoints} base={B.tasks.maxPoints} min={1} max={10000}
            onChange={(v) => setS((x) => ({ ...x, tasks: { ...x.tasks, maxPoints: v } }))} />
        </Grid>
      </Card>

      {/* ---------- Card ---------- */}
      <Card icon={<ImageIcon size={17} />} title="Card design">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
          <CardControls config={s.card} base={B.card} onChange={setCard} groupName="Program name" />
          <div className="min-w-0 lg:sticky lg:top-16 lg:self-start">
            <div className="flex justify-center overflow-x-auto rounded-xl bg-black/20 p-4">
              <CardPreview config={s.card} groupName="Program name" dayNumber={1}
                title={SAMPLE.title} bodyHtml={SAMPLE.bodyHtml} scriptures={SAMPLE.scriptures} />
            </div>
          </div>
        </div>
      </Card>

      {/* ---------- Programs ---------- */}
      <Card icon={<CalendarDays size={17} />} title="New programs">
        <Grid>
          <Field label="Timezone" changed={s.program.timezone !== B.program.timezone}>
            <select className="input py-2" value={s.program.timezone} onChange={(e) => setProgram({ timezone: e.target.value })}>
              {timezoneOptions(s.program.timezone).map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Num label="Next-day preview" unit="hours" value={s.program.nextDayPreviewHours} base={B.program.nextDayPreviewHours} min={0} max={24}
            hint="How early the next day's content becomes visible"
            onChange={(v) => setProgram({ nextDayPreviewHours: v })} />
          <Num label="Day unlock offset" unit="min" value={s.program.dayUnlockOffsetMinutes} base={B.program.dayUnlockOffsetMinutes} min={0} max={60}
            onChange={(v) => setProgram({ dayUnlockOffsetMinutes: v })} />
        </Grid>
      </Card>
    </div>
  );
}

function Card({ icon, title, children }: { icon?: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="card space-y-4 p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        {icon && <span className="text-gold">{icon}</span>} {title}
      </h2>
      {children}
    </section>
  );
}

function Sub({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="label mb-2" title={hint}>{title}</p>
      {children}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>;
}

function Field({ label, hint, changed, children }: {
  label: string; hint?: string; changed?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <label className={`mb-1 block text-xs ${changed ? "text-gold" : "text-fg-muted"}`} title={hint}>{label}</label>
      {children}
    </div>
  );
}

function Text({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <input className="input py-2" maxLength={200} value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

/** Integer input that tolerates an empty/partial value while typing. */
function Num({ label, unit, value, base, min, max, hint, onChange }: {
  label: string; unit?: string; value: number; base: number; min: number; max: number; hint?: string;
  onChange: (v: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <Field label={label} hint={hint ?? `Built-in: ${base}${unit ? ` ${unit}` : ""}`} changed={value !== base}>
      <div className="flex items-center rounded-xl border border-[color:var(--border)] bg-white/[0.04] focus-within:border-[color:var(--gold)]">
        <input
          type="number" inputMode="numeric" min={min} max={max} step={1}
          value={draft ?? String(value)}
          onChange={(e) => {
            setDraft(e.target.value);
            const n = parseInt(e.target.value, 10);
            if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
          }}
          onBlur={() => setDraft(null)}
          className="w-full min-w-0 bg-transparent px-3 py-2 text-fg outline-none"
        />
        {unit && <span className="shrink-0 pr-3 text-xs text-fg-muted">{unit}</span>}
      </div>
    </Field>
  );
}
