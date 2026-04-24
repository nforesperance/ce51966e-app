"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import LongPressButton from "@/components/LongPressButton";

type Verse = { verse: number; text: string };
type WordKind = "first" | "second" | "third" | "last";

const WORD_KIND_LABEL: Record<WordKind, string> = {
  first: "first", second: "second", third: "third", last: "last",
};

export default function ReaderClient({
  taskId, chapter, translation, nextChapter,
}: {
  taskId: string;
  chapter: string;
  translation: "kjv" | "web";
  nextChapter: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [verses, setVerses] = useState<Verse[]>([]);
  const [minSec, setMinSec] = useState<number>(60);
  const [recallVerse, setRecallVerse] = useState<number | null>(null);
  const [recallWordKind, setRecallWordKind] = useState<WordKind>("first");
  const [elapsed, setElapsed] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [recall, setRecall] = useState("");
  const [reflection, setReflection] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [serverErr, setServerErr] = useState<string | null>(null);
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
        setRecallWordKind((j.recall_word_kind as WordKind) ?? "first");
        startRef.current = Date.now();
      } catch (e) {
        if (!abort) setErr(e instanceof Error ? e.message : String(e));
      } finally { if (!abort) setLoading(false); }
    }
    load();
    return () => { abort = true; };
  }, [chapter, translation]);

  // Tick elapsed (pauses when tab is hidden).
  useEffect(() => {
    if (loading || err) return;
    let lastTick = performance.now();
    let paused = false;
    const onVis = () => {
      paused = document.hidden;
      if (!paused) lastTick = performance.now();   // don't count time while hidden
    };
    document.addEventListener("visibilitychange", onVis);
    const iv = setInterval(() => {
      if (paused) return;
      const now = performance.now();
      setElapsed((s) => s + (now - lastTick) / 1000);
      lastTick = now;
    }, 500);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", onVis); };
  }, [loading, err]);

  // Scroll-to-bottom detection on the whole window (the reading page itself is the scroll container).
  useEffect(() => {
    function check() {
      const scroll = window.scrollY + window.innerHeight;
      const full = document.documentElement.scrollHeight;
      if (full - scroll < 32) setScrolled(true);
    }
    check();
    window.addEventListener("scroll", check, { passive: true });
    return () => window.removeEventListener("scroll", check);
  }, [verses]);

  async function submit() {
    if (recallVerse == null) return;
    setSubmitting(true); setServerErr(null);
    try {
      const res = await fetch(`/api/reading/${taskId}/chapter`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chapter,
          reflection: reflection.trim(),
          dwell_seconds: Math.floor(elapsed),
          recall_verse: recallVerse,
          recall_word_kind: recallWordKind,
          recall_answer: recall.trim(),
        }),
      });
      const j = await res.json();
      if (!res.ok) { setServerErr(j.error ?? "Failed"); return; }
      if (nextChapter) router.push(`/read/${taskId}?ch=${encodeURIComponent(nextChapter)}`);
      else router.push("/tasks");
      router.refresh();
    } finally { setSubmitting(false); }
  }

  if (loading) return <div className="card p-6 text-sm text-fg-muted">Loading chapter…</div>;
  if (err) return <div className="card p-6 text-sm text-[color:var(--danger)]">Error: {err}</div>;

  const dwellOk = elapsed >= minSec;
  const dwellLeft = Math.max(0, minSec - elapsed);
  const canConfirm = dwellOk && scrolled && recall.trim().length > 0 && reflection.trim().length > 0;

  return (
    <div>
      <article className="prose-prayer text-[15px] leading-relaxed mb-6">
        {verses.map((v) => (
          <p key={v.verse} className="mb-2">
            <sup className="text-gold text-[10px] mr-1">{v.verse}</sup>
            {v.text}
          </p>
        ))}
      </article>

      <div className="rule mb-5" />

      <div className="card p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-3 text-xs text-fg-muted">
          <span>
            {dwellOk
              ? <span className="text-[color:var(--ok)]">✓ Read time met</span>
              : <>Keep reading… {Math.floor(dwellLeft / 60)}:{String(Math.floor(dwellLeft) % 60).padStart(2, "0")} left</>}
          </span>
          <span>
            {scrolled
              ? <span className="text-[color:var(--ok)]">✓ Reached end</span>
              : "Scroll to the end of the chapter"}
          </span>
        </div>

        <div>
          <label className="label block mb-1">
            Type the {WORD_KIND_LABEL[recallWordKind]} word of verse {recallVerse ?? "—"}
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
          <label className="label block mb-1">In one sentence — what did you learn?</label>
          <textarea
            rows={3}
            className="input text-sm"
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            placeholder="What did you learn, an idea, something to pray about…"
          />
        </div>

        {serverErr && <p className="text-[color:var(--danger)] text-xs">{serverErr}</p>}

        <LongPressButton
          disabled={!canConfirm || submitting}
          label={submitting ? "Saving…" : "Hold to confirm you read it"}
          holdingLabel="Keep holding…"
          onConfirm={submit}
        />
        <p className="text-[11px] text-fg-muted text-center">Press and hold for 1.5 seconds to confirm.</p>
      </div>
    </div>
  );
}
