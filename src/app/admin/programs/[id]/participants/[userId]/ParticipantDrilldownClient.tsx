"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, BookOpen, ListChecks, Check, Minus, Plus, Trash2, MoreHorizontal, X, Gift } from "lucide-react";
import { TASK_DEFAULTS } from "@/lib/appDefaults";

type Task = {
  id: string;
  type: "prayer" | "reading" | "other";
  title: string;
  duration_minutes: number | null;
  target_start_time: string | null;
  max_points: number | null;
  chapters: string[];
  completion: {
    id: string;
    first_started_at: string | null;
    started_at: string | null;
    elapsed_seconds: number;
    completed_at: string | null;
    points_awarded: number;
    admin_override: boolean;
    override_reason: string | null;
    chapter_states?: Record<string, { read_at?: string; reflection?: string | null; dwell_seconds?: number; recall_verse?: number }>;
  } | null;
};
type Day = { id: string; day_number: number; date: string; tasks: Task[] };
type Bonus = { id: string; points: number; reason: string | null; created_at: string; awarded_by: string | null };

export default function ParticipantDrilldownClient({
  programId, programTimezone, userId, days, bonuses: initialBonuses,
}: {
  programId: string;
  programTimezone: string;
  userId: string;
  days: Day[];
  bonuses: Bonus[];
}) {
  const router = useRouter();
  const [bonuses, setBonuses] = useState(initialBonuses);
  const [bonusOpen, setBonusOpen] = useState(false);
  const [override, setOverride] = useState<Task | null>(null);

  async function awardBonus(points: number, reason: string) {
    const res = await fetch("/api/admin/bonuses", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ program_id: programId, user_id: userId, points, reason }),
    });
    const j = await res.json();
    if (!res.ok) { alert(j.error ?? "Failed"); return; }
    setBonuses((b) => [{ ...j.bonus, awarded_by: null }, ...b]);
    setBonusOpen(false);
    router.refresh();
  }

  async function deleteBonus(id: string) {
    if (!confirm("Remove this bonus?")) return;
    const res = await fetch(`/api/admin/bonuses?id=${id}`, { method: "DELETE" });
    if (!res.ok) { const j = await res.json().catch(() => ({})); alert(j.error ?? "Failed"); return; }
    setBonuses((b) => b.filter((x) => x.id !== id));
    router.refresh();
  }

  async function doOverride(task: Task, action: "full" | "custom" | "clear", points?: number, reason?: string) {
    const res = await fetch("/api/admin/completions/override", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_id: task.id, user_id: userId, action, points, reason }),
    });
    const j = await res.json();
    if (!res.ok) { alert(j.error ?? "Failed"); return; }
    setOverride(null);
    router.refresh();
  }

  return (
    <div className="space-y-8">
      {/* Bonuses */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2"><Gift size={18} className="text-gold" /> Bonus points</h2>
          <button onClick={() => setBonusOpen(true)} className="btn-gold text-sm flex items-center gap-1">
            <Plus size={14} /> Award bonus
          </button>
        </div>
        {bonuses.length === 0 ? (
          <p className="text-sm text-fg-muted">No bonuses yet.</p>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                {bonuses.map((b) => (
                  <tr key={b.id} className="border-b border-[color:var(--border)] last:border-0">
                    <td className="py-3 px-4 w-20 tabular-nums font-semibold text-gold-soft">
                      {b.points > 0 ? "+" : ""}{b.points}
                    </td>
                    <td className="py-3 px-4">
                      <div>{b.reason ?? <span className="text-fg-muted">No reason</span>}</div>
                      <div className="text-[11px] text-fg-muted mt-0.5">
                        {new Date(b.created_at).toLocaleString()}{b.awarded_by && ` · by ${b.awarded_by}`}
                      </div>
                    </td>
                    <td className="py-3 px-4 w-10 text-right">
                      <button onClick={() => deleteBonus(b.id)} className="text-fg-muted hover:text-[color:var(--danger)]" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Days */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Daily progress</h2>
        <p className="text-xs text-fg-muted mb-4">Timezone: {programTimezone}</p>
        <div className="space-y-3">
          {days.map((d) => <DayRow key={d.id} day={d} onOverride={setOverride} />)}
        </div>
      </section>

      {bonusOpen && <BonusDialog onClose={() => setBonusOpen(false)} onAward={awardBonus} />}
      {override && <OverrideDialog task={override} onClose={() => setOverride(null)} onApply={doOverride} />}
    </div>
  );
}

function DayRow({ day, onOverride }: { day: Day; onOverride: (t: Task) => void }) {
  const totalTasks = day.tasks.length;
  const doneTasks = day.tasks.filter((t) => t.completion?.completed_at).length;
  const pts = day.tasks.reduce((s, t) => s + (t.completion?.completed_at ? t.completion.points_awarded : 0), 0);

  if (totalTasks === 0) {
    return (
      <div className="card p-4 flex items-center justify-between">
        <div>
          <div className="flex items-baseline gap-3">
            <span className="text-xs text-fg-muted tracking-[0.2em] uppercase">Day</span>
            <span className="text-lg font-semibold text-gold-soft">{day.day_number}</span>
            <span className="text-xs text-fg-muted">{day.date}</span>
          </div>
        </div>
        <span className="text-xs text-fg-muted">No tasks</span>
      </div>
    );
  }
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-baseline gap-3">
          <span className="text-xs text-fg-muted tracking-[0.2em] uppercase">Day</span>
          <span className="text-lg font-semibold text-gold-soft">{day.day_number}</span>
          <span className="text-xs text-fg-muted">{day.date}</span>
        </div>
        <div className="text-xs text-fg-muted">
          {doneTasks}/{totalTasks} · <span className="text-gold-soft font-semibold">{pts}</span> pts
        </div>
      </div>
      <div className="space-y-2">
        {day.tasks.map((t) => <TaskLine key={t.id} task={t} onOverride={onOverride} />)}
      </div>
    </div>
  );
}

function TaskLine({ task, onOverride }: { task: Task; onOverride: (t: Task) => void }) {
  const Icon = task.type === "prayer" ? Clock : task.type === "reading" ? BookOpen : ListChecks;
  const c = task.completion;
  const done = !!c?.completed_at;
  const chapterEntries = Object.entries(c?.chapter_states ?? {}) as [string, { read_at?: string; reflection?: string | null; dwell_seconds?: number }][];

  return (
    <div className="border-t border-[color:var(--border)] first:border-0 pt-2 first:pt-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Icon size={15} className={done ? "text-[color:var(--ok)]" : "text-fg-muted"} />
          <div className="min-w-0">
            <div className="text-sm truncate">{task.title}</div>
            <div className="text-[11px] text-fg-muted flex flex-wrap gap-x-3">
              <span className="uppercase tracking-widest">{task.type}</span>
              {task.type === "prayer" && c?.elapsed_seconds
                ? <span>{Math.floor(c.elapsed_seconds / 60)}:{(c.elapsed_seconds % 60).toString().padStart(2, "0")} prayed</span>
                : null}
              {task.type === "reading" && chapterEntries.length > 0
                ? <span>{chapterEntries.length}/{task.chapters.length} chapters</span>
                : null}
              {c?.admin_override && <span className="text-gold">override</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm tabular-nums font-semibold text-gold-soft">
            {done ? c.points_awarded : <span className="text-fg-muted">—</span>}
          </div>
          <button onClick={() => onOverride(task)} className="text-fg-muted hover:text-gold" title="Override">
            <MoreHorizontal size={16} />
          </button>
        </div>
      </div>
      {task.type === "reading" && chapterEntries.length > 0 && (
        <div className="mt-2 ml-[22px] space-y-1">
          {chapterEntries.map(([ref, st]) => (
            <div key={ref} className="text-[12px] bg-white/5 rounded-md px-2 py-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-gold text-[11px] font-semibold">{ref}</span>
                <span className="text-fg-muted text-[10px] tabular-nums">
                  {st.dwell_seconds ? `${Math.floor((st.dwell_seconds ?? 0) / 60)}m ${(st.dwell_seconds ?? 0) % 60}s` : ""}
                </span>
              </div>
              {st.reflection ? (
                <div className="text-fg/85 mt-0.5">&ldquo;{st.reflection}&rdquo;</div>
              ) : (
                <div className="text-fg-muted text-[11px] italic">No reflection</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BonusDialog({ onClose, onAward }: { onClose: () => void; onAward: (p: number, r: string) => void }) {
  const [points, setPoints] = useState("50");
  const [reason, setReason] = useState("");
  return (
    <Modal title="Award bonus" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onAward(parseInt(points, 10) || 0, reason); }} className="space-y-3">
        <div>
          <label className="label block mb-1">Points</label>
          <input type="number" className="input w-32" value={points} onChange={(e) => setPoints(e.target.value)} />
          <p className="text-xs text-fg-muted mt-1">Use a negative number to deduct points.</p>
        </div>
        <div>
          <label className="label block mb-1">Reason</label>
          <input className="input" placeholder="Group participation" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost text-sm">Cancel</button>
          <button className="btn-gold text-sm">Award</button>
        </div>
      </form>
    </Modal>
  );
}

function OverrideDialog({ task, onClose, onApply }: {
  task: Task;
  onClose: () => void;
  onApply: (t: Task, action: "full" | "custom" | "clear", points?: number, reason?: string) => void;
}) {
  const [points, setPoints] = useState((task.max_points ?? TASK_DEFAULTS.maxPoints).toString());
  const [reason, setReason] = useState("");
  return (
    <Modal title={task.title} onClose={onClose}>
      <p className="text-sm text-fg-muted mb-3">
        Override the participant&apos;s completion for this task. Actions are audit-logged.
      </p>
      <div className="space-y-3">
        <div>
          <label className="label block mb-1">Reason (optional)</label>
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="Forgot to mark complete" />
        </div>
        <div>
          <label className="label block mb-1">Custom points</label>
          <div className="flex items-center gap-2">
            <input type="number" className="input w-32"
              value={points} onChange={(e) => setPoints(e.target.value)} />
            <button onClick={() => onApply(task, "custom", parseInt(points, 10) || 0, reason)}
              className="btn-ghost text-sm">
              Set to {points}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <button onClick={() => onApply(task, "full", undefined, reason)} className="btn-gold text-sm flex items-center gap-1">
            <Check size={14} /> Mark complete (full marks)
          </button>
          <button onClick={() => onApply(task, "clear", undefined, reason)} className="btn-ghost text-sm flex items-center gap-1 text-[color:var(--danger)] border-[color:var(--danger)]">
            <Minus size={14} /> Clear completion
          </button>
        </div>
        <div className="flex justify-end pt-2">
          <button type="button" onClick={onClose} className="btn-ghost text-sm">Close</button>
        </div>
      </div>
    </Modal>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="card w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-fg-muted hover:text-fg"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
