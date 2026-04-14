"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ImageIcon, X, Save, Check, Clock, BookOpen, ListChecks } from "lucide-react";
import Editor from "@/components/Editor";

type Scripture = { reference: string; text: string };
type PrayerPoint = { title: string; body_html: string; image_url: string | null; scriptures: Scripture[] };

type Task = {
  id: string;
  program_day_id: string;
  type: "prayer" | "reading" | "other";
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
};

export default function DayEditorClient({
  dayId, initialPrayerPoint, initialTasks,
}: {
  dayId: string;
  initialPrayerPoint: PrayerPoint;
  initialTasks: Task[];
}) {
  const router = useRouter();
  const [pp, setPp] = useState<PrayerPoint>(initialPrayerPoint);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [taskOpen, setTaskOpen] = useState<null | Task | "new">(null);

  async function savePrayerPoint() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/days/${dayId}/prayer-point`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: pp.title || null,
          body_markdown: pp.body_html || null,
          image_url: pp.image_url || null,
          scriptures: pp.scriptures.filter((s) => s.reference.trim()).map((s) => ({
            reference: s.reference.trim(), text: s.text.trim() || null,
          })),
        }),
      });
      const j = await res.json();
      if (!res.ok) { alert(j.error ?? "Failed"); return; }
      setSavedAt(Date.now());
    } finally { setSaving(false); }
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

  async function deleteTask(id: string) {
    if (!confirm("Delete this task?")) return;
    const res = await fetch(`/api/admin/tasks/${id}`, { method: "DELETE" });
    if (!res.ok) { const j = await res.json().catch(() => ({})); alert(j.error ?? "Failed"); return; }
    setTasks((ts) => ts.filter((t) => t.id !== id));
  }

  async function handleTaskSaved(task: Task, isNew: boolean) {
    if (isNew) setTasks((ts) => [...ts, task].sort((a, b) => a.position - b.position));
    else setTasks((ts) => ts.map((t) => (t.id === task.id ? task : t)));
    setTaskOpen(null);
    router.refresh();
  }

  return (
    <div className="space-y-10">
      {/* ---------- Prayer point ---------- */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Prayer point</h2>
          <div className="flex items-center gap-3">
            {savedAt && <span className="text-xs text-[color:var(--ok)] flex items-center gap-1"><Check size={14} /> Saved</span>}
            <button onClick={savePrayerPoint} disabled={saving} className="btn-gold text-sm flex items-center gap-2">
              <Save size={15} /> {saving ? "Saving…" : "Save prayer point"}
            </button>
          </div>
        </div>

        <div className="card p-5 space-y-4">
          <div>
            <label className="label block mb-1">Title (optional)</label>
            <input className="input" maxLength={200} placeholder="Breaking the Spirit of Prayerlessness"
              value={pp.title} onChange={(e) => setPp({ ...pp, title: e.target.value })} />
          </div>

          <div>
            <label className="label block mb-1">Image (optional, max 2MB)</label>
            {pp.image_url ? (
              <div className="relative inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pp.image_url} alt="" className="max-h-56 rounded-lg border border-[color:var(--border)]" />
                <button onClick={() => setPp({ ...pp, image_url: null })}
                  className="absolute top-1 right-1 bg-black/60 rounded-full p-1 text-white hover:text-[color:var(--danger)]">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <label className="inline-flex items-center gap-2 btn-ghost text-sm cursor-pointer">
                <ImageIcon size={15} /> {uploading ? "Uploading…" : "Upload image"}
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden"
                  disabled={uploading}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ""; }} />
              </label>
            )}
          </div>

          <div>
            <label className="label block mb-1">Body</label>
            <Editor value={pp.body_html} onChange={(html) => setPp((p) => ({ ...p, body_html: html }))} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="label">Scriptures</span>
              <button onClick={addScripture} className="btn-ghost text-xs flex items-center gap-1">
                <Plus size={13} /> Add verse
              </button>
            </div>
            {pp.scriptures.length === 0 && (
              <p className="text-fg-muted text-sm">No scriptures yet.</p>
            )}
            <div className="space-y-2">
              {pp.scriptures.map((s, i) => (
                <div key={i} className="border border-[color:var(--border)] rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input className="input" placeholder="Matthew 26:41"
                      value={s.reference} onChange={(e) => updateScripture(i, { reference: e.target.value })} />
                    <button onClick={() => removeScripture(i)} className="text-fg-muted hover:text-[color:var(--danger)] p-2">
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <textarea rows={2} className="input" placeholder="Verse text (optional)"
                    value={s.text} onChange={(e) => updateScripture(i, { text: e.target.value })} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Tasks ---------- */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Tasks</h2>
          <button onClick={() => setTaskOpen("new")} className="btn-gold text-sm flex items-center gap-1">
            <Plus size={15} /> Add task
          </button>
        </div>

        {tasks.length === 0 ? (
          <div className="card p-6 text-fg-muted">No tasks for this day.</div>
        ) : (
          <div className="grid gap-3">
            {tasks.map((t) => <TaskCard key={t.id} task={t} onEdit={() => setTaskOpen(t)} onDelete={() => deleteTask(t.id)} />)}
          </div>
        )}
      </section>

      {taskOpen && (
        <TaskDialog
          dayId={dayId}
          task={taskOpen === "new" ? null : taskOpen}
          onClose={() => setTaskOpen(null)}
          onSaved={handleTaskSaved}
        />
      )}
    </div>
  );
}

function TaskCard({ task, onEdit, onDelete }: { task: Task; onEdit: () => void; onDelete: () => void }) {
  const Icon = task.type === "prayer" ? Clock : task.type === "reading" ? BookOpen : ListChecks;
  const chapters = (task.metadata?.chapters as string[] | undefined) ?? [];
  return (
    <div className="card p-4 flex items-start justify-between gap-3">
      <div className="flex items-start gap-3 flex-1">
        <div className="mt-1 text-gold"><Icon size={18} /></div>
        <div className="flex-1">
          <div className="font-medium">{task.title}</div>
          <div className="text-xs text-fg-muted mt-1 flex flex-wrap gap-x-4 gap-y-1">
            <span className="uppercase tracking-widest">{task.type}</span>
            {task.duration_minutes && <span>{task.duration_minutes} min</span>}
            {task.target_start_time && <span>Start @ {task.target_start_time.slice(0, 5)}</span>}
            {chapters.length > 0 && <span>{chapters.join(", ")}</span>}
            <span>{task.max_points} pts</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={onEdit} className="text-sm text-fg-muted hover:text-gold">Edit</button>
        <button onClick={onDelete} className="text-fg-muted hover:text-[color:var(--danger)]" title="Delete"><Trash2 size={15} /></button>
      </div>
    </div>
  );
}

function TaskDialog({ dayId, task, onClose, onSaved }: {
  dayId: string;
  task: Task | null;
  onClose: () => void;
  onSaved: (task: Task, isNew: boolean) => void;
}) {
  const isNew = !task;
  const [type, setType] = useState<Task["type"]>(task?.type ?? "prayer");
  const [title, setTitle] = useState(task?.title ?? "");
  const [duration, setDuration] = useState<string>(task?.duration_minutes?.toString() ?? "30");
  const [start, setStart] = useState<string>(task?.target_start_time?.slice(0, 5) ?? "00:00");
  const [fullWin, setFullWin] = useState<string>((task?.full_marks_window_minutes ?? 5).toString());
  const [zeroWin, setZeroWin] = useState<string>((task?.zero_marks_window_minutes ?? 120).toString());
  const [fullEndWin, setFullEndWin] = useState<string>((task?.full_marks_end_window_minutes ?? 5).toString());
  const [zeroEndWin, setZeroEndWin] = useState<string>((task?.zero_marks_end_window_minutes ?? 120).toString());
  const [maxPts, setMaxPts] = useState<string>((task?.max_points ?? 100).toString());
  const initChapters = (task?.metadata?.chapters as string[] | undefined) ?? [];
  const [chapters, setChapters] = useState<string>(initChapters.join(", "));
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        title,
        max_points: parseInt(maxPts, 10) || 100,
      };
      if (type === "prayer") {
        body.duration_minutes = parseInt(duration, 10) || null;
        body.target_start_time = start;
        body.full_marks_window_minutes = parseInt(fullWin, 10);
        body.zero_marks_window_minutes = parseInt(zeroWin, 10);
        body.full_marks_end_window_minutes = parseInt(fullEndWin, 10);
        body.zero_marks_end_window_minutes = parseInt(zeroEndWin, 10);
      }
      if (type === "reading") {
        body.metadata = {
          chapters: chapters.split(",").map((s) => s.trim()).filter(Boolean),
        };
      }

      if (isNew) body.type = type;

      const url = isNew
        ? `/api/admin/days/${dayId}/tasks`
        : `/api/admin/tasks/${task!.id}`;
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

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="card w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">{isNew ? "Add task" : "Edit task"}</h2>
          <button onClick={onClose} className="text-fg-muted hover:text-fg"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          {isNew && (
            <div>
              <label className="label block mb-1">Type</label>
              <div className="grid grid-cols-3 gap-2">
                {(["prayer", "reading", "other"] as const).map((t) => (
                  <button key={t} type="button" onClick={() => setType(t)}
                    className={`btn-ghost text-sm capitalize ${type === t ? "border-[color:var(--gold)] text-gold" : ""}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="label block mb-1">Title</label>
            <input required className="input" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder={type === "prayer" ? "Midnight prayer (30 min)" : type === "reading" ? "Psalms reading" : "Journal entry"} />
          </div>

          {type === "prayer" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label block mb-1">Duration (minutes)</label>
                  <input type="number" min={1} max={1440} className="input" value={duration} onChange={(e) => setDuration(e.target.value)} />
                </div>
                <div>
                  <label className="label block mb-1">Target start time</label>
                  <input type="time" className="input" value={start} onChange={(e) => setStart(e.target.value)} />
                </div>
              </div>
              <p className="label">Start-time scoring</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label block mb-1 normal-case tracking-normal text-fg-muted">Full marks window (± min)</label>
                  <input type="number" min={0} max={1440} className="input" value={fullWin} onChange={(e) => setFullWin(e.target.value)} />
                </div>
                <div>
                  <label className="label block mb-1 normal-case tracking-normal text-fg-muted">Zero marks at (min late)</label>
                  <input type="number" min={1} max={1440} className="input" value={zeroWin} onChange={(e) => setZeroWin(e.target.value)} />
                </div>
              </div>
              <p className="label mt-2">End-time scoring</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label block mb-1 normal-case tracking-normal text-fg-muted">Full marks window (± min)</label>
                  <input type="number" min={0} max={1440} className="input" value={fullEndWin} onChange={(e) => setFullEndWin(e.target.value)} />
                </div>
                <div>
                  <label className="label block mb-1 normal-case tracking-normal text-fg-muted">Zero marks at (min late)</label>
                  <input type="number" min={1} max={1440} className="input" value={zeroEndWin} onChange={(e) => setZeroEndWin(e.target.value)} />
                </div>
              </div>
              <p className="text-xs text-fg-muted">
                Start on time AND finish on time. Final score = min(start ratio, end ratio) × max points. Must complete ≥ 90% of duration.
              </p>
            </>
          )}

          {type === "reading" && (
            <div>
              <label className="label block mb-1">Chapters (comma-separated)</label>
              <input className="input" placeholder="Psalm 1, Psalm 2"
                value={chapters} onChange={(e) => setChapters(e.target.value)} />
              <p className="text-xs text-fg-muted mt-1">Participants will see one checkbox per chapter.</p>
            </div>
          )}

          <div>
            <label className="label block mb-1">Max points</label>
            <input type="number" min={1} max={10000} className="input w-40" value={maxPts} onChange={(e) => setMaxPts(e.target.value)} />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button type="button" onClick={onClose} className="btn-ghost text-sm">Cancel</button>
            <button disabled={busy} className="btn-gold text-sm">{busy ? "Saving…" : "Save task"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
