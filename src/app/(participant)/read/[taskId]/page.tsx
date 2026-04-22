import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { loadActionableTaskForUser } from "@/lib/tasks";
import { supabaseAdmin } from "@/lib/supabase/admin";
import ReaderClient from "./ReaderClient";

export const dynamic = "force-dynamic";

export default async function ReadPage({
  params, searchParams,
}: {
  params: Promise<{ taskId: string }>;
  searchParams: Promise<{ ch?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { taskId } = await params;
  const { ch } = await searchParams;

  const data = await loadActionableTaskForUser(taskId, user.id);
  if (!data) notFound();
  const { task } = data;
  if (task.type !== "reading") notFound();

  const chapters = (task.metadata?.chapters as string[] | undefined) ?? [];
  if (!ch || !chapters.includes(ch)) notFound();

  // Fetch current chapter_states so we can hide the flow if it's already done.
  const { data: completion } = await supabaseAdmin()
    .from("task_completions")
    .select("chapter_states")
    .eq("task_id", taskId).eq("user_id", user.id).maybeSingle();
  const states = (completion?.chapter_states ?? {}) as Record<string, { read_at?: string }>;

  const idx = chapters.indexOf(ch);
  const nextCh = chapters.slice(idx + 1).find((c) => !states[c]);
  const alreadyDone = !!states[ch]?.read_at;

  return (
    <div className="pt-3 pb-10">
      <div className="mb-2">
        <Link href="/tasks" className="inline-flex items-center text-xs text-fg-muted hover:text-gold">
          <ChevronLeft size={14} /> Back to tasks
        </Link>
      </div>
      <div className="flex items-center justify-between mb-3">
        <span className="label">{task.title}</span>
        <span className="pill">{ch}</span>
      </div>

      {alreadyDone ? (
        <div className="card p-6 text-center">
          <p className="text-[color:var(--ok)] mb-3">✓ You already read this chapter.</p>
          <div className="flex justify-center gap-2">
            <Link href="/tasks" className="btn-ghost text-sm">Back to tasks</Link>
            {nextCh && (
              <Link href={`/read/${taskId}?ch=${encodeURIComponent(nextCh)}`} className="btn-gold text-sm">
                Next: {nextCh}
              </Link>
            )}
          </div>
        </div>
      ) : (
        <ReaderClient
          taskId={taskId}
          chapter={ch}
          translation={((task as unknown as { translation?: string }).translation ?? "kjv") as "kjv" | "web"}
          nextChapter={nextCh ?? null}
        />
      )}
    </div>
  );
}
