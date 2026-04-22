"use client";

import { useEffect, useRef, useState } from "react";
import { Clock, BookOpen, ListChecks, Check, Play, Pause, Square, RotateCcw, Lock, ChevronDown, ChevronUp } from "lucide-react";

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

function ReadingControl({ task, onChange }: { task: UITask; onChange: (t: UITask) => void }) {
  const completed = !!task.completion?.completed_at;
  const [states, setStates] = useState<Record<string, { read_at?: string; reflection?: string | null }>>(
    () => task.chapter_states ?? {}
  );
  const [openChapter, setOpenChapter] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const allDone = task.chapters.length > 0 && task.chapters.every((c) => !!states[c]?.read_at);

  function onChapterDone(ch: string, entry: { read_at: string; reflection: string | null }) {
    setStates((s) => ({ ...s, [ch]: entry }));
    setOpenChapter(null);
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

  if (completed) {
    return (
      <div className="text-xs text-fg-muted">
        Completed. {Object.keys(states).length} chapter(s) read.
      </div>
    );
  }

  return (
    <div>
      {task.chapters.length === 0 ? (
        <p className="text-xs text-fg-muted mb-3">No chapters listed.</p>
      ) : (
        <div className="space-y-2 mb-3">
          {task.chapters.map((c) => {
            const done = !!states[c]?.read_at;
            const isOpen = openChapter === c;
            return (
              <div key={c} className="border border-[color:var(--border)] rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenChapter(isOpen ? null : c)}
                  className="w-full flex items-center justify-between px-3 py-2 text-left active:scale-[0.99]"
                >
                  <div className="flex items-center gap-2">
                    <div className={`h-5 w-5 rounded-full border grid place-items-center text-[10px] ${done ? "border-[color:var(--ok)] text-[color:var(--ok)]" : "border-[color:var(--border)] text-fg-muted"}`}>
                      {done ? <Check size={12} /> : ""}
                    </div>
                    <span className={done ? "text-fg-muted" : "text-fg"}>{c}</span>
                  </div>
                  {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </button>
                {isOpen && !done && (
                  <ChapterReader
                    taskId={task.id}
                    chapter={c}
                    translation={task.translation ?? "kjv"}
                    onDone={(entry) => onChapterDone(c, entry)}
                  />
                )}
                {isOpen && done && states[c]?.reflection && (
                  <div className="px-3 py-2 text-xs text-fg-muted border-t border-[color:var(--border)] bg-white/5">
                    <span className="label mr-2">Your reflection</span>
                    {states[c]!.reflection}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!completed && (
        <button onClick={complete} disabled={busy || !allDone} className="btn-gold text-sm flex items-center gap-2">
          <Check size={14} /> {busy ? "Saving…" : allDone ? "Mark task complete" : `Read ${task.chapters.length - Object.values(states).filter(s => s.read_at).length} more`}
        </button>
      )}
    </div>
  );
}

function ChapterReader({
  taskId, chapter, translation, onDone,
}: {
  taskId: string;
  chapter: string;
  translation: "kjv" | "web";
  onDone: (entry: { read_at: string; reflection: string | null }) => void;
}) {
  type Verse = { verse: number; text: string };
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [verses, setVerses] = useState<Verse[]>([]);
  const [minSec, setMinSec] = useState<number>(60);
  const [recallVerse, setRecallVerse] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [recall, setRecall] = useState("");
  const [reflection, setReflection] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const startRef = useRef<number>(Date.now());

  useEffect(() => {
    let abort = false;
    async function load() {
      setLoading(true); setErr(null);
      try {
        const url = `/api/reading/chapter?ref=${encodeURIComponent(chapter)}&translation=${translation}`;
        const res = await fetch(url);
        const j = await res.json();
        if (!res.ok) throw new Error(j.error ?? "Failed to load");
        if (abort) return;
        setVerses(j.verses ?? []);
        setMinSec(j.min_dwell_seconds ?? 60);
        setRecallVerse(j.recall_verse ?? null);
        startRef.current = Date.now();
      } catch (e) {
        if (!abort) setErr(e instanceof Error ? e.message : String(e));
      } finally { if (!abort) setLoading(false); }
    }
    load();
    return () => { abort = true; };
  }, [chapter, translation]);

  // Tick the elapsed clock.
  useEffect(() => {
    if (loading || err) return;
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [loading, err]);

  // Track scroll-to-bottom on the verses container.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function check() {
      const el = scrollRef.current!;
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 24) setScrolled(true);
    }
    check();
    el.addEventListener("scroll", check);
    return () => el.removeEventListener("scroll", check);
  }, [verses]);

  async function submit() {
    if (recallVerse == null) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/reading/${taskId}/chapter`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chapter,
          reflection: reflection.trim(),
          dwell_seconds: Math.floor((Date.now() - startRef.current) / 1000),
          recall_verse: recallVerse,
          recall_answer: recall.trim(),
        }),
      });
      const j = await res.json();
      if (!res.ok) { alert(j.error ?? "Failed"); return; }
      onDone({ read_at: new Date().toISOString(), reflection: reflection.trim() || null });
    } finally { setSubmitting(false); }
  }

  if (loading) return <div className="px-3 py-3 text-xs text-fg-muted">Loading chapter…</div>;
  if (err) return <div className="px-3 py-3 text-xs text-[color:var(--danger)]">Error: {err}</div>;

  const dwellOk = elapsed >= minSec;
  const dwellLeft = Math.max(0, minSec - elapsed);
  const canSubmit = dwellOk && scrolled && recall.trim().length > 0 && reflection.trim().length > 0;

  return (
    <div className="border-t border-[color:var(--border)] bg-black/20">
      <div
        ref={scrollRef}
        className="max-h-[50vh] overflow-y-auto px-3 py-3 text-[14px] leading-relaxed"
      >
        {verses.map((v) => (
          <p key={v.verse} className="mb-2">
            <sup className="text-gold text-[10px] mr-1">{v.verse}</sup>
            {v.text}
          </p>
        ))}
      </div>

      <div className="px-3 py-3 border-t border-[color:var(--border)] space-y-3">
        <div className="flex flex-wrap items-center gap-3 text-xs text-fg-muted">
          <span>
            {dwellOk
              ? <span className="text-[color:var(--ok)]">✓ Read time met</span>
              : <>Keep reading… {Math.floor(dwellLeft / 60)}:{String(dwellLeft % 60).padStart(2, "0")} left</>}
          </span>
          <span>
            {scrolled
              ? <span className="text-[color:var(--ok)]">✓ Scrolled to end</span>
              : "Scroll to the bottom of the chapter"}
          </span>
        </div>

        <div>
          <label className="label block mb-1">
            Type the first word of verse {recallVerse ?? "—"}
          </label>
          <input
            className="input text-sm"
            value={recall}
            onChange={(e) => setRecall(e.target.value)}
            autoCapitalize="off"
            autoComplete="off"
            placeholder="One word"
          />
        </div>

        <div>
          <label className="label block mb-1">
            In one sentence — what stood out?
          </label>
          <textarea
            rows={2}
            className="input text-sm"
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            placeholder="A verse, an idea, something to pray about…"
          />
        </div>

        <button onClick={submit} disabled={submitting || !canSubmit}
          className="btn-gold text-sm flex items-center gap-2">
          <Check size={14} /> {submitting ? "Saving…" : "Mark chapter read"}
        </button>
      </div>
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
