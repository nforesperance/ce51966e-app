"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown, ArrowUp, BookOpen, Check, Clock, Copy, ImageIcon, ListChecks, Plus, Save, Trash2, X,
} from "lucide-react";
import Editor from "@/components/editor/Editor";
import CardBuilder from "@/components/CardBuilder";
import PresetMenu from "@/components/PresetMenu";
import { TASK_DEFAULTS } from "@/lib/appDefaults";
import type { CardConfig } from "@/lib/cardConfig";

type Scripture = { reference: string; text: string };
type PrayerPoint = {
  title: string; body_html: string; image_url: string | null;
  scriptures: Scripture[]; card_config: CardConfig;
};

type TaskType = "prayer" | "reading" | "other";
type Translation = "kjv" | "web";

type Task = {
  id: string;
  program_day_id: string;
  type: TaskType;
  title: string;
  duration_minutes: number | null;
  target_start_time: string | null;
  full_marks_window_minutes: number | null;
  zero_marks_window_minutes: number | null;
  full_marks_end_window_minutes: number | null;
  zero_marks_end_window_minutes: number | null;
  max_points: number | null;
  metadata: Record<string, unknown>;
  position: number;
  translation?: Translation;
};

export default function DayEditorClient({
  dayId, programId, programName, dayNumber, cardDefaults, initialPrayerPoint, initialTasks,
}: {
  dayId: string;
  programId: string;
  programName: string;
  dayNumber: number;
  cardDefaults: CardConfig;
  initialPrayerPoint: PrayerPoint;
  initialTasks: Task[];
}) {
  const router = useRouter();
  const [pp, setPp] = useState<PrayerPoint>(initialPrayerPoint);
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(initialPrayerPoint));
  const [programDefaults, setProgramDefaults] = useState<CardConfig>(cardDefaults);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [taskOpen, setTaskOpen] = useState<null | { task: Task | null; template?: Partial<TaskForm> }>(null);

  const dirty = JSON.stringify(pp) !== savedSnapshot;

  const savePrayerPoint = useCallback(async () => {
    setSaving(true);
    try {
      const snapshot = JSON.stringify(pp);
      const res = await fetch(`/api/admin/days/${dayId}/prayer-point`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: pp.title || null,
          body_markdown: pp.body_html || null,
          image_url: pp.image_url || null,
          card_config: pp.card_config ?? {},
          scriptures: pp.scriptures.filter((s) => s.reference.trim()).map((s) => ({
            reference: s.reference.trim(), text: s.text.trim() || null,
          })),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { alert(j.error ?? "Failed"); return; }
      setSavedSnapshot(snapshot);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2500);
    } finally { setSaving(false); }
  }, [dayId, pp]);

  // Ctrl/⌘+S saves; warn before leaving with unsaved changes.
  const saveRef = useRef(savePrayerPoint);
  useEffect(() => { saveRef.current = savePrayerPoint; }, [savePrayerPoint]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveRef.current();
      }
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

  async function saveProgramDefaults(config: CardConfig, resetAllDays: boolean) {
    const res = await fetch(`/api/admin/programs/${programId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ card_defaults: config, reset_day_card_overrides: resetAllDays }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error ?? "Failed to save program defaults");
    setProgramDefaults(config);
    // The current design now *is* the default, so this day needs no overrides.
    setPp((p) => ({ ...p, card_config: {} }));
    if (resetAllDays) setSavedSnapshot((s) => JSON.stringify({ ...JSON.parse(s), card_config: {} }));
  }

  async function uploadImage(file: File) {
    if (file.size > 2 * 1024 * 1024) { alert("Image exceeds 2MB"); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/admin/days/${dayId}/image`, { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) { alert(j.error ?? "Upload failed"); return; }
      setPp((p) => ({ ...p, image_url: j.url }));
    } finally { setUploading(false); }
  }

  function addScripture() { setPp((p) => ({ ...p, scriptures: [...p.scriptures, { reference: "", text: "" }] })); }
  function updateScripture(i: number, patch: Partial<Scripture>) {
    setPp((p) => ({ ...p, scriptures: p.scriptures.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) }));
  }
  function removeScripture(i: number) {
    setPp((p) => ({ ...p, scriptures: p.scriptures.filter((_, idx) => idx !== i) }));
  }
  function moveScripture(i: number, delta: -1 | 1) {
    setPp((p) => {
      const next = [...p.scriptures];
      const j = i + delta;
      if (j < 0 || j >= next.length) return p;
      [next[i], next[j]] = [next[j], next[i]];
      return { ...p, scriptures: next };
    });
  }

  async function deleteTask(id: string) {
    if (!confirm("Delete this task?")) return;
    const res = await fetch(`/api/admin/tasks/${id}`, { method: "DELETE" });
    if (!res.ok) { const j = await res.json().catch(() => ({})); alert(j.error ?? "Failed"); return; }
    setTasks((ts) => ts.filter((t) => t.id !== id));
  }

  function handleTaskSaved(task: Task, isNew: boolean) {
    if (isNew) setTasks((ts) => [...ts, task].sort((a, b) => a.position - b.position));
    else setTasks((ts) => ts.map((t) => (t.id === task.id ? task : t)));
    setTaskOpen(null);
    router.refresh();
  }

  return (
    <div className="space-y-10">
      {/* ---------- Prayer point ---------- */}
      <section>
        <div className="sticky top-0 z-30 -mx-2 mb-3 flex items-center justify-between gap-3 rounded-b-xl bg-[color:var(--bg)]/90 px-2 py-2 backdrop-blur">
          <h2 className="text-lg font-semibold">Prayer point</h2>
          <div className="flex items-center gap-3">
            {dirty ? (
              <span className="text-xs text-gold">Unsaved changes</span>
            ) : justSaved ? (
              <span className="flex items-center gap-1 text-xs text-[color:var(--ok)]"><Check size={14} /> Saved</span>
            ) : null}
            <button onClick={savePrayerPoint} disabled={saving || !dirty} title="Save (Ctrl/⌘+S)"
              className="btn-gold flex items-center gap-2 text-sm">
              <Save size={15} /> {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        <div className="card space-y-5 p-4 sm:p-5">
          <div>
            <label className="label mb-1 block">Title (optional)</label>
            <input className="input" maxLength={200} placeholder="Breaking the Spirit of Prayerlessness"
              value={pp.title} onChange={(e) => setPp({ ...pp, title: e.target.value })} />
          </div>

          <div>
            <label className="label mb-1 block">Body</label>
            <Editor value={pp.body_html} onChange={(html) => setPp((p) => ({ ...p, body_html: html }))} />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="label">Scriptures</span>
              <button onClick={addScripture} className="btn-ghost flex items-center gap-1 px-3 py-1.5 text-xs">
                <Plus size={13} /> Add verse
              </button>
            </div>
            {pp.scriptures.length === 0 && (
              <p className="text-sm text-fg-muted">No scriptures yet.</p>
            )}
            <div className="space-y-2">
              {pp.scriptures.map((s, i) => (
                <div key={i} className="space-y-2 rounded-lg border border-[color:var(--border)] p-3">
                  <div className="flex items-center gap-1">
                    <input className="input" placeholder="Matthew 26:41"
                      value={s.reference} onChange={(e) => updateScripture(i, { reference: e.target.value })} />
                    <IconBtn title="Move up" disabled={i === 0} onClick={() => moveScripture(i, -1)}><ArrowUp size={15} /></IconBtn>
                    <IconBtn title="Move down" disabled={i === pp.scriptures.length - 1} onClick={() => moveScripture(i, 1)}><ArrowDown size={15} /></IconBtn>
                    <IconBtn title="Remove" danger onClick={() => removeScripture(i)}><Trash2 size={15} /></IconBtn>
                  </div>
                  <textarea rows={2} className="input" placeholder="Verse text (optional)"
                    value={s.text} onChange={(e) => updateScripture(i, { text: e.target.value })} />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="label mb-1 block" title="Shown to participants instead of the card. Max 2MB.">Image (optional)</label>
            {pp.image_url ? (
              <div className="relative inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pp.image_url} alt="" className="max-h-56 rounded-lg border border-[color:var(--border)]" />
                <button onClick={() => setPp({ ...pp, image_url: null })} title="Remove image"
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:text-[color:var(--danger)]">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <label className="btn-ghost inline-flex cursor-pointer items-center gap-2 text-sm">
                <ImageIcon size={15} /> {uploading ? "Uploading…" : "Upload image"}
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden"
                  disabled={uploading}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ""; }} />
              </label>
            )}
          </div>
        </div>
      </section>

      {/* ---------- Card preview / export ---------- */}
      <CardBuilder
        programDefaults={programDefaults}
        overrides={pp.card_config}
        onOverridesChange={(c) => setPp((p) => ({ ...p, card_config: c }))}
        onSaveProgramDefaults={saveProgramDefaults}
        groupName={programName}
        dayNumber={dayNumber}
        title={pp.title || null}
        bodyHtml={pp.body_html || null}
        scriptures={pp.scriptures}
        filenameBase={`${programName.replace(/\W+/g, "_")}_Day${dayNumber}`}
      />

      {/* ---------- Tasks ---------- */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Tasks</h2>
          <button onClick={() => setTaskOpen({ task: null })} className="btn-gold flex items-center gap-1 text-sm">
            <Plus size={15} /> Add task
          </button>
        </div>

        {tasks.length === 0 ? (
          <div className="card p-6 text-fg-muted">No tasks for this day.</div>
        ) : (
          <div className="grid gap-3">
            {tasks.map((t) => (
              <TaskCard key={t.id} task={t}
                onEdit={() => setTaskOpen({ task: t })}
                onDuplicate={() => setTaskOpen({ task: null, template: { ...taskToForm(t), title: `${t.title} (copy)` } })}
                onDelete={() => deleteTask(t.id)} />
            ))}
          </div>
        )}
      </section>

      {taskOpen && (
        <TaskDialog
          dayId={dayId}
          task={taskOpen.task}
          template={taskOpen.template}
          onClose={() => setTaskOpen(null)}
          onSaved={handleTaskSaved}
        />
      )}
    </div>
  );
}

function IconBtn({ title, onClick, disabled, danger, children }: {
  title: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode;
}) {
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick} disabled={disabled}
      className={`p-2 text-fg-muted disabled:opacity-30 ${danger ? "hover:text-[color:var(--danger)]" : "hover:text-gold"}`}>
      {children}
    </button>
  );
}

function TaskCard({ task, onEdit, onDuplicate, onDelete }: {
  task: Task; onEdit: () => void; onDuplicate: () => void; onDelete: () => void;
}) {
  const Icon = task.type === "prayer" ? Clock : task.type === "reading" ? BookOpen : ListChecks;
  const chapters = (task.metadata?.chapters as string[] | undefined) ?? [];
  return (
    <div className="card flex items-start justify-between gap-3 p-4">
      <div className="flex flex-1 items-start gap-3">
        <div className="mt-1 text-gold"><Icon size={18} /></div>
        <div className="flex-1">
          <div className="font-medium">{task.title}</div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted">
            <span className="uppercase tracking-widest">{task.type}</span>
            {task.duration_minutes && <span>{task.duration_minutes} min</span>}
            {task.target_start_time && <span>Start @ {task.target_start_time.slice(0, 5)}</span>}
            {chapters.length > 0 && <span>{chapters.join(", ")}</span>}
            {task.type === "reading" && task.translation && <span className="uppercase">{task.translation}</span>}
            <span>{task.max_points} pts</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={onEdit} className="px-2 text-sm text-fg-muted hover:text-gold">Edit</button>
        <IconBtn title="Duplicate" onClick={onDuplicate}><Copy size={15} /></IconBtn>
        <IconBtn title="Delete" danger onClick={onDelete}><Trash2 size={15} /></IconBtn>
      </div>
    </div>
  );
}

// ---------- Task form ----------

type TaskForm = {
  type: TaskType;
  title: string;
  duration: string;
  start: string;
  fullWin: string;
  zeroWin: string;
  fullEndWin: string;
  zeroEndWin: string;
  maxPts: string;
  chapters: string;
  translation: Translation;
};

/** What a task preset stores (chapters are day-specific, so they're left out). */
type TaskPreset = {
  type: TaskType;
  title: string;
  duration_minutes?: number | null;
  target_start_time?: string | null;
  full_marks_window_minutes?: number | null;
  zero_marks_window_minutes?: number | null;
  full_marks_end_window_minutes?: number | null;
  zero_marks_end_window_minutes?: number | null;
  max_points?: number | null;
  translation?: Translation;
};

function defaultForm(type: TaskType): TaskForm {
  const p = TASK_DEFAULTS.prayer;
  return {
    type,
    title: type === "prayer" ? p.title : type === "reading" ? TASK_DEFAULTS.reading.title : "",
    duration: String(p.durationMinutes),
    start: p.targetStartTime,
    fullWin: String(p.fullMarksWindowMinutes),
    zeroWin: String(p.zeroMarksWindowMinutes),
    fullEndWin: String(p.fullMarksEndWindowMinutes),
    zeroEndWin: String(p.zeroMarksEndWindowMinutes),
    maxPts: String(TASK_DEFAULTS.maxPoints),
    chapters: "",
    translation: "kjv",
  };
}

function taskToForm(t: Task): TaskForm {
  const d = defaultForm(t.type);
  const str = (v: number | null | undefined, fallback: string) => (v == null ? fallback : String(v));
  return {
    type: t.type,
    title: t.title,
    duration: str(t.duration_minutes, d.duration),
    start: t.target_start_time?.slice(0, 5) ?? d.start,
    fullWin: str(t.full_marks_window_minutes, d.fullWin),
    zeroWin: str(t.zero_marks_window_minutes, d.zeroWin),
    fullEndWin: str(t.full_marks_end_window_minutes, d.fullEndWin),
    zeroEndWin: str(t.zero_marks_end_window_minutes, d.zeroEndWin),
    maxPts: str(t.max_points, d.maxPts),
    chapters: ((t.metadata?.chapters as string[] | undefined) ?? []).join(", "),
    translation: t.translation ?? "kjv",
  };
}

function formToPreset(f: TaskForm): TaskPreset {
  const int = (v: string) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; };
  const preset: TaskPreset = { type: f.type, title: f.title, max_points: int(f.maxPts) };
  if (f.type === "prayer") {
    Object.assign(preset, {
      duration_minutes: int(f.duration),
      target_start_time: f.start,
      full_marks_window_minutes: int(f.fullWin),
      zero_marks_window_minutes: int(f.zeroWin),
      full_marks_end_window_minutes: int(f.fullEndWin),
      zero_marks_end_window_minutes: int(f.zeroEndWin),
    });
  }
  if (f.type === "reading") preset.translation = f.translation;
  return preset;
}

function presetToForm(p: TaskPreset, current: TaskForm): TaskForm {
  const d = defaultForm(p.type);
  const str = (v: number | null | undefined, fallback: string) => (v == null ? fallback : String(v));
  return {
    ...current,
    type: p.type,
    title: p.title || d.title,
    duration: str(p.duration_minutes, d.duration),
    start: p.target_start_time?.slice(0, 5) ?? d.start,
    fullWin: str(p.full_marks_window_minutes, d.fullWin),
    zeroWin: str(p.zero_marks_window_minutes, d.zeroWin),
    fullEndWin: str(p.full_marks_end_window_minutes, d.fullEndWin),
    zeroEndWin: str(p.zero_marks_end_window_minutes, d.zeroEndWin),
    maxPts: str(p.max_points, d.maxPts),
    translation: p.translation ?? current.translation,
  };
}

function describeTaskPreset(p: TaskPreset): string {
  const parts: string[] = [p.type];
  if (p.type === "prayer") {
    if (p.duration_minutes) parts.push(`${p.duration_minutes} min`);
    if (p.target_start_time) parts.push(`@ ${p.target_start_time.slice(0, 5)}`);
  }
  if (p.type === "reading" && p.translation) parts.push(p.translation.toUpperCase());
  if (p.max_points) parts.push(`${p.max_points} pts`);
  return parts.join(" · ");
}

function TaskDialog({ dayId, task, template, onClose, onSaved }: {
  dayId: string;
  task: Task | null;
  template?: Partial<TaskForm>;
  onClose: () => void;
  onSaved: (task: Task, isNew: boolean) => void;
}) {
  const isNew = !task;
  const [form, setForm] = useState<TaskForm>(() =>
    task ? taskToForm(task) : { ...defaultForm(template?.type ?? "prayer"), ...template });
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<TaskForm>) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function selectType(t: TaskType) {
    if (!isNew) return;
    setForm((f) => ({ ...defaultForm(t), chapters: f.chapters, translation: f.translation }));
  }

  function applyPreset(p: TaskPreset) {
    if (!isNew && p.type !== form.type) {
      alert(`This preset is for a ${p.type} task; this task is ${form.type}.`);
      return;
    }
    setForm((f) => presetToForm(p, f));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        title: form.title,
        max_points: parseInt(form.maxPts, 10) || TASK_DEFAULTS.maxPoints,
      };
      if (form.type === "prayer") {
        body.duration_minutes = parseInt(form.duration, 10) || null;
        body.target_start_time = form.start;
        body.full_marks_window_minutes = parseInt(form.fullWin, 10);
        body.zero_marks_window_minutes = parseInt(form.zeroWin, 10);
        body.full_marks_end_window_minutes = parseInt(form.fullEndWin, 10);
        body.zero_marks_end_window_minutes = parseInt(form.zeroEndWin, 10);
      }
      if (form.type === "reading") {
        body.metadata = {
          ...(task?.metadata ?? {}),
          chapters: form.chapters.split(",").map((s) => s.trim()).filter(Boolean),
        };
        body.translation = form.translation;
      }
      if (isNew) body.type = form.type;

      const url = isNew ? `/api/admin/days/${dayId}/tasks` : `/api/admin/tasks/${task!.id}`;
      const res = await fetch(url, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) { alert(j.error ?? "Failed"); return; }
      onSaved(j.task, isNew);
    } finally { setBusy(false); }
  }

  const subLabel = "label block mb-1 normal-case tracking-normal text-fg-muted";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="card max-h-[90vh] w-full max-w-lg overflow-y-auto p-6">
        <div className="mb-5 flex items-center justify-between gap-2">
          <h2 className="mr-auto text-lg font-semibold">{isNew ? "Add task" : "Edit task"}</h2>
          <PresetMenu<TaskPreset>
            kind="task"
            align="right"
            current={formToPreset(form)}
            describe={describeTaskPreset}
            onApply={applyPreset}
          />
          <button onClick={onClose} className="text-fg-muted hover:text-fg" aria-label="Close"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          {isNew && (
            <div>
              <label className="label mb-1 block">Type</label>
              <div className="grid grid-cols-3 gap-2">
                {(["prayer", "reading", "other"] as const).map((t) => (
                  <button key={t} type="button" onClick={() => selectType(t)}
                    className={`btn-ghost text-sm capitalize ${form.type === t ? "border-[color:var(--gold)] text-gold" : ""}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="label mb-1 block">Title</label>
            <input required className="input" value={form.title} onChange={(e) => set({ title: e.target.value })}
              placeholder={form.type === "prayer" ? TASK_DEFAULTS.prayer.title : form.type === "reading" ? TASK_DEFAULTS.reading.title : "Journal entry"} />
          </div>

          {form.type === "prayer" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label mb-1 block">Duration (minutes)</label>
                  <input type="number" min={1} max={1440} className="input" value={form.duration} onChange={(e) => set({ duration: e.target.value })} />
                </div>
                <div>
                  <label className="label mb-1 block">Target start time</label>
                  <input type="time" className="input" value={form.start} onChange={(e) => set({ start: e.target.value })} />
                </div>
              </div>
              <p className="label" title="Score = min(start ratio, end ratio) × max points. Must complete ≥ 90% of duration.">Start-time scoring</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={subLabel}>Full marks window (± min)</label>
                  <input type="number" min={0} max={1440} className="input" value={form.fullWin} onChange={(e) => set({ fullWin: e.target.value })} />
                </div>
                <div>
                  <label className={subLabel}>Zero marks at (min late)</label>
                  <input type="number" min={1} max={1440} className="input" value={form.zeroWin} onChange={(e) => set({ zeroWin: e.target.value })} />
                </div>
              </div>
              <p className="label mt-2">End-time scoring</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={subLabel}>Full marks window (± min)</label>
                  <input type="number" min={0} max={1440} className="input" value={form.fullEndWin} onChange={(e) => set({ fullEndWin: e.target.value })} />
                </div>
                <div>
                  <label className={subLabel}>Zero marks at (min late)</label>
                  <input type="number" min={1} max={1440} className="input" value={form.zeroEndWin} onChange={(e) => set({ zeroEndWin: e.target.value })} />
                </div>
              </div>
            </>
          )}

          {form.type === "reading" && (
            <>
              <div>
                <label className="label mb-1 block">Chapters (comma-separated)</label>
                <input className="input" placeholder="Psalm 1, Psalm 2"
                  value={form.chapters} onChange={(e) => set({ chapters: e.target.value })} />
              </div>
              <div>
                <label className="label mb-1 block">Bible translation</label>
                <select className="input w-56" value={form.translation}
                  onChange={(e) => set({ translation: e.target.value as Translation })}>
                  <option value="kjv">KJV — King James</option>
                  <option value="web">WEB — World English Bible</option>
                </select>
              </div>
            </>
          )}

          <div>
            <label className="label mb-1 block">Max points</label>
            <input type="number" min={1} max={10000} className="input w-40" value={form.maxPts} onChange={(e) => set({ maxPts: e.target.value })} />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3">
            <button type="button" onClick={onClose} className="btn-ghost text-sm">Cancel</button>
            <button disabled={busy} className="btn-gold text-sm">{busy ? "Saving…" : "Save task"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
