import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { TASK_DEFAULTS } from "@/lib/appDefaults";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { loadActionableTaskForUser } from "@/lib/tasks";
import { fetchChapter, getNthWord, minDwellSeconds, normalizeWord, WORD_KIND_LABEL } from "@/lib/bibleApi";

const Body = z.object({
  chapter: z.string().min(1).max(200),
  reflection: z.string().max(2000).optional().default(""),
  dwell_seconds: z.number().int().min(0).max(36000),
  recall_verse: z.number().int().min(1),
  recall_word_kind: z.enum(["first", "second", "third", "last"]).default("first"),
  recall_answer: z.string().min(1).max(80),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ taskId: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { taskId } = await ctx.params;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const data = await loadActionableTaskForUser(taskId, user.id);
  if (!data) return NextResponse.json({ error: "Task not available" }, { status: 403 });
  const { task } = data;
  if (task.type !== "reading") return NextResponse.json({ error: "Not a reading task" }, { status: 400 });

  const chapters = (task.metadata?.chapters as string[] | undefined) ?? [];
  if (!chapters.includes(parsed.data.chapter)) {
    return NextResponse.json({ error: "Chapter not part of this task" }, { status: 400 });
  }

  const translation = (task as unknown as { translation?: string }).translation ?? "kjv";
  let ch;
  try {
    ch = await fetchChapter(parsed.data.chapter, translation);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Bible fetch failed" },
      { status: 502 }
    );
  }

  // Validate dwell time: roughly matches our server's estimated minimum.
  const minSec = minDwellSeconds(ch.word_count);
  if (parsed.data.dwell_seconds + 2 < minSec) {
    return NextResponse.json(
      { error: `Please spend at least ${minSec}s reading this chapter.` },
      { status: 400 }
    );
  }

  // Validate recall against the chosen word position in the chosen verse.
  const target = ch.verses.find((v) => v.verse === parsed.data.recall_verse);
  if (!target) {
    return NextResponse.json({ error: "Verse number not found" }, { status: 400 });
  }
  const expected = getNthWord(target.text, parsed.data.recall_word_kind);
  const provided = normalizeWord(parsed.data.recall_answer);
  if (!expected || expected !== provided) {
    return NextResponse.json(
      {
        error: `Not quite — check the ${WORD_KIND_LABEL[parsed.data.recall_word_kind]} word of verse ${parsed.data.recall_verse}.`,
      },
      { status: 400 }
    );
  }

  // Upsert chapter_states in the user's completion row for this task.
  const sb = supabaseAdmin();
  const { data: existing } = await sb.from("task_completions")
    .select("id, chapter_states").eq("task_id", taskId).eq("user_id", user.id).maybeSingle();

  const now = new Date().toISOString();
  const entry = {
    read_at: now,
    dwell_seconds: parsed.data.dwell_seconds,
    recall_verse: parsed.data.recall_verse,
    reflection: parsed.data.reflection.trim() || null,
    word_count: ch.word_count,
  };
  const nextStates = { ...(existing?.chapter_states ?? {}), [parsed.data.chapter]: entry };

  // Auto-complete the task once every chapter has been verified.
  const doneChapters = Object.keys(nextStates);
  const allDone = chapters.every((c) => doneChapters.includes(c));
  const completionPatch: Record<string, unknown> = { chapter_states: nextStates };
  if (allDone) {
    completionPatch.completed_at = now;
    completionPatch.marked_complete_at = now;
    completionPatch.points_awarded = task.max_points ?? TASK_DEFAULTS.maxPoints;
  }

  if (existing) {
    const { error } = await sb.from("task_completions")
      .update(completionPatch).eq("id", existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await sb.from("task_completions")
      .insert({ task_id: taskId, user_id: user.id, ...completionPatch });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, chapter_states: nextStates, all_chapters_done: allDone });
}
