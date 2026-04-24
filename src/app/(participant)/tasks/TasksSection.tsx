"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Clock, BookOpen, ListChecks, Check, Play, Pause, Square, RotateCcw, Lock, ChevronRight } from "lucide-react";

export type UITask = {
  id: string;
  type: "prayer" | "reading" | "other";
  title: string;
  duration_minutes: number | null;
  target_start_time: string | null;
  max_points: number | null;
  chapters: string[];
  translation?: "kjv" | "web";
  chapter_states?: Record<string, { read_at?: string; reflection?: string | null }>;
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

function ReadingControl({ task }: { task: UITask; onChange: (t: UITask) => void }) {
  const completed = !!task.completion?.completed_at;
  const states = task.chapter_states ?? {};
  const doneChapters = task.chapters.filter((c) => !!states[c]?.read_at);

  if (completed) {
    return (
      <div className="text-xs text-fg-muted">
        Completed. {doneChapters.length} chapter(s) read.
      </div>
    );
  }

  if (task.chapters.length === 0) {
    return <p className="text-xs text-fg-muted">No chapters listed.</p>;
  }

  return (
    <div className="space-y-1.5">
      {task.chapters.map((c) => {
        const done = !!states[c]?.read_at;
        return done ? (
          <div key={c} className="flex items-center justify-between px-3 py-2 rounded-lg border border-[color:var(--border)] text-sm">
            <span className="flex items-center gap-2 text-fg-muted">
              <span className="h-5 w-5 rounded-full border border-[color:var(--ok)] text-[color:var(--ok)] grid place-items-center">
                <Check size={12} />
              </span>
              <span className="line-through">{c}</span>
            </span>
          </div>
        ) : (
          <Link key={c} href={`/read/${task.id}?ch=${encodeURIComponent(c)}`}
            className="flex items-center justify-between px-3 py-2 rounded-lg border border-[color:var(--border)] text-sm hover:border-[color:var(--gold)] active:scale-[0.99] transition-[transform]">
            <span className="flex items-center gap-2">
              <span className="h-5 w-5 rounded-full border border-[color:var(--border)] grid place-items-center text-fg-muted text-[10px]"></span>
              <span>{c}</span>
            </span>
            <ChevronRight size={14} className="text-fg-muted" />
          </Link>
        );
      })}
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
