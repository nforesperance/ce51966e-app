"use client";

import { useEffect, useRef, useState } from "react";
import { Clock, BookOpen, ListChecks, Check, Play, Pause, Square, RotateCcw, Lock } from "lucide-react";

export type UITask = {
  id: string;
  type: "prayer" | "reading" | "other";
  title: string;
  duration_minutes: number | null;
  target_start_time: string | null;
  max_points: number | null;
  chapters: string[];
  completion: {
    first_started_at: string | null;
    started_at: string | null;       // null when paused or not running
    elapsed_seconds: number;
    completed_at: string | null;
    points_awarded: number;
  } | null;
};

export default function TasksSection({ tasks, locked = false }: { tasks: UITask[]; locked?: boolean }) {
  return (
    <section>
      <p className="label mb-3">{locked ? "Upcoming tasks" : "Today's tasks"}</p>
      <div className="space-y-3">
        {tasks.map((t) => <TaskRow key={t.id} task={t} locked={locked} />)}
      </div>
    </section>
  );
}

function TaskRow({ task: initial, locked }: { task: UITask; locked: boolean }) {
  const [task, setTask] = useState(initial);
  const Icon = task.type === "prayer" ? Clock : task.type === "reading" ? BookOpen : ListChecks;
  const completed = !!task.completion?.completed_at;
  return (
    <div className={`card p-4 ${locked ? "opacity-70" : ""}`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 ${locked ? "text-fg-muted" : completed ? "text-[color:var(--ok)]" : "text-gold"}`}>
          {locked ? <Lock size={18} /> : <Icon size={18} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="font-medium truncate">{task.title}</div>
            {completed && !locked && (
              <div className="text-xs text-[color:var(--ok)] flex items-center gap-1">
                <Check size={13} /> {task.completion!.points_awarded} pts
              </div>
            )}
          </div>
          <div className="text-[11px] text-fg-muted mt-0.5 uppercase tracking-widest flex flex-wrap gap-x-3">
            <span>{task.type}</span>
            {task.duration_minutes && <span>{task.duration_minutes} min</span>}
            {task.target_start_time && <span>@ {task.target_start_time.slice(0, 5)}</span>}
          </div>
          {!locked && (
            <div className="mt-3">
              {task.type === "prayer" && <PrayerControl task={task} onChange={setTask} />}
              {task.type === "reading" && <ReadingControl task={task} onChange={setTask} />}
              {task.type === "other" && <OtherControl task={task} onChange={setTask} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function fmt(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function PrayerControl({ task, onChange }: { task: UITask; onChange: (t: UITask) => void }) {
  const c = task.completion;
  const completed = !!c?.completed_at;
  const running = !!c?.started_at;
  const started = !!c?.first_started_at;

  const [busy, setBusy] = useState(false);
  const [liveSec, setLiveSec] = useState(0);
  const tickRef = useRef<number | null>(null);

  // Recompute live seconds from server state whenever task changes.
  useEffect(() => {
    const base = c?.elapsed_seconds ?? 0;
    if (running && c?.started_at) {
      const segStart = new Date(c.started_at).getTime();
      const update = () => setLiveSec(base + Math.floor((Date.now() - segStart) / 1000));
      update();
      tickRef.current = window.setInterval(update, 1000);
      return () => { if (tickRef.current) clearInterval(tickRef.current); };
    } else {
      setLiveSec(base);
    }
  }, [c?.started_at, c?.elapsed_seconds, running]);

  async function act(action: "start" | "pause" | "resume" | "restart" | "complete") {
    if (action === "restart" && !confirm("Restart from zero? Current timer will be lost.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/action`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const j = await res.json();
      if (!res.ok) { alert(j.error ?? "Failed"); return; }
      onChange({
        ...task,
        completion: {
          first_started_at: j.completion.first_started_at,
          started_at: j.completion.started_at,
          elapsed_seconds: j.completion.elapsed_seconds,
          completed_at: j.completion.completed_at,
          points_awarded: j.completion.points_awarded,
        },
      });
    } finally { setBusy(false); }
  }

  if (completed) {
    return (
      <p className="text-xs text-fg-muted">
        Completed in {fmt(c!.elapsed_seconds)}.
      </p>
    );
  }

  if (!started) {
    return (
      <button onClick={() => act("start")} disabled={busy} className="btn-gold text-sm flex items-center gap-2">
        <Play size={14} /> {busy ? "Starting…" : "Start prayer"}
      </button>
    );
  }

  const durSec = (task.duration_minutes ?? 0) * 60;
  const enough = durSec === 0 || liveSec >= durSec * 0.9;
  const minNeeded = durSec > 0 ? Math.ceil((task.duration_minutes ?? 0) * 0.9) : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-3">
        <div className="font-mono text-2xl text-gold-soft tabular-nums">{fmt(liveSec)}</div>
        {task.duration_minutes && (
          <div className="text-xs text-fg-muted">of {task.duration_minutes}:00</div>
        )}
        {!running && <span className="text-xs text-[color:var(--danger)] uppercase tracking-widest">paused</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        {running ? (
          <button onClick={() => act("pause")} disabled={busy} className="btn-ghost text-sm flex items-center gap-2">
            <Pause size={13} /> Pause
          </button>
        ) : (
          <button onClick={() => act("resume")} disabled={busy} className="btn-gold text-sm flex items-center gap-2">
            <Play size={13} /> Resume
          </button>
        )}
        <button onClick={() => act("complete")} disabled={busy}
          className="btn-gold text-sm flex items-center gap-2">
          <Square size={13} /> {enough ? "Finish" : "Finish early"}
        </button>
        <button onClick={() => act("restart")} disabled={busy}
          className="btn-ghost text-sm flex items-center gap-2">
          <RotateCcw size={13} /> Restart
        </button>
      </div>
      {!enough && minNeeded > 0 && (
        <p className="text-[11px] text-fg-muted">
          Minimum {minNeeded} min of prayer time required for points. Finishing early now = 0 points.
        </p>
      )}
    </div>
  );
}

function ReadingControl({ task, onChange }: { task: UITask; onChange: (t: UITask) => void }) {
  const completed = !!task.completion?.completed_at;
  const [checked, setChecked] = useState<Set<string>>(
    () => completed ? new Set(task.chapters) : new Set()
  );
  const [busy, setBusy] = useState(false);
  const allDone = task.chapters.length > 0 && task.chapters.every((c) => checked.has(c));

  function toggle(c: string) {
    if (completed) return;
    setChecked((s) => { const n = new Set(s); n.has(c) ? n.delete(c) : n.add(c); return n; });
  }
  async function complete() {
    setBusy(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/complete`, { method: "POST" });
      const j = await res.json();
      if (!res.ok) { alert(j.error ?? "Failed"); return; }
      onChange({ ...task, completion: {
        first_started_at: null, started_at: null, elapsed_seconds: 0,
        completed_at: j.completion.completed_at, points_awarded: j.completion.points_awarded,
      } });
    } finally { setBusy(false); }
  }

  return (
    <div>
      {task.chapters.length > 0 ? (
        <ul className="space-y-1.5 mb-3">
          {task.chapters.map((c) => (
            <li key={c}>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" disabled={completed}
                  checked={checked.has(c)} onChange={() => toggle(c)} />
                <span className={checked.has(c) ? "line-through text-fg-muted" : ""}>{c}</span>
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-fg-muted mb-3">No chapters listed.</p>
      )}
      {!completed && (
        <button onClick={complete} disabled={busy || !allDone} className="btn-gold text-sm flex items-center gap-2">
          <Check size={14} /> {busy ? "Saving…" : "Mark complete"}
        </button>
      )}
    </div>
  );
}

function OtherControl({ task, onChange }: { task: UITask; onChange: (t: UITask) => void }) {
  const completed = !!task.completion?.completed_at;
  const [busy, setBusy] = useState(false);
  async function complete() {
    setBusy(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/complete`, { method: "POST" });
      const j = await res.json();
      if (!res.ok) { alert(j.error ?? "Failed"); return; }
      onChange({ ...task, completion: {
        first_started_at: null, started_at: null, elapsed_seconds: 0,
        completed_at: j.completion.completed_at, points_awarded: j.completion.points_awarded,
      } });
    } finally { setBusy(false); }
  }
  if (completed) return null;
  return (
    <button onClick={complete} disabled={busy} className="btn-gold text-sm flex items-center gap-2">
      <Check size={14} /> {busy ? "Saving…" : "Mark done"}
    </button>
  );
}
