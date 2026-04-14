import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { todayInTz } from "@/lib/time";
import TasksSection, { type UITask } from "./TasksSection";

export const dynamic = "force-dynamic";

type TodayData = {
  program: { id: string; name: string; timezone: string };
  day: { id: string; day_number: number; date: string };
  prayerPoint: {
    title: string | null; body_markdown: string | null; image_url: string | null;
    scriptures: { reference: string; text: string | null }[];
  } | null;
  tasks: UITask[];
} | null;

async function loadToday(userId: string): Promise<TodayData> {
  const sb = supabaseAdmin();
  const { data: memberships } = await sb
    .from("program_participants")
    .select("program_id, programs(id, name, timezone, start_date, end_date)")
    .eq("user_id", userId);
  if (!memberships?.length) return null;

  for (const m of memberships) {
    const raw = (m as { programs: unknown }).programs;
    const p = Array.isArray(raw) ? raw[0] : raw as { id: string; name: string; timezone: string; start_date: string; end_date: string };
    if (!p) continue;
    const today = todayInTz(p.timezone);
    if (today < p.start_date || today > p.end_date) continue;
    const { data: day } = await sb.from("program_days")
      .select("id, day_number, date").eq("program_id", p.id).eq("date", today).maybeSingle();
    if (!day) continue;

    const { data: pp } = await sb
      .from("prayer_points")
      .select("title, body_markdown, image_url, scriptures(reference, text, position)")
      .eq("program_day_id", day.id).maybeSingle();

    const scriptures = ((pp?.scriptures ?? []) as { reference: string; text: string | null; position: number }[])
      .sort((a, b) => a.position - b.position);

    const { data: tasks } = await sb.from("tasks")
      .select("id, type, title, duration_minutes, target_start_time, max_points, metadata, position")
      .eq("program_day_id", day.id).order("position");

    const { data: completions } = await sb.from("task_completions")
      .select("task_id, first_started_at, started_at, elapsed_seconds, completed_at, points_awarded")
      .eq("user_id", userId)
      .in("task_id", (tasks ?? []).map((t) => t.id).concat("00000000-0000-0000-0000-000000000000"));

    const compByTask = new Map(completions?.map((c) => [c.task_id, c]));

    const uiTasks: UITask[] = (tasks ?? []).map((t) => ({
      id: t.id,
      type: t.type,
      title: t.title,
      duration_minutes: t.duration_minutes,
      target_start_time: t.target_start_time,
      max_points: t.max_points,
      chapters: (t.metadata?.chapters as string[] | undefined) ?? [],
      completion: compByTask.get(t.id) ?? null,
    }));

    return {
      program: { id: p.id, name: p.name, timezone: p.timezone },
      day,
      prayerPoint: pp ? {
        title: pp.title, body_markdown: pp.body_markdown, image_url: pp.image_url,
        scriptures: scriptures.map((s) => ({ reference: s.reference, text: s.text })),
      } : null,
      tasks: uiTasks,
    };
  }
  return null;
}

export default async function TodayPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const data = await loadToday(user.id);

  if (!data) {
    return (
      <div className="pt-10 text-center">
        <p className="label mb-3">No active program</p>
        <p className="text-fg-muted">You are not enrolled in an active program today.</p>
      </div>
    );
  }

  const { program, day, prayerPoint, tasks } = data;

  return (
    <div className="pt-6 pb-28">
      <div className="text-center mb-6">
        <div className="label">{program.name}</div>
        <div className="mt-4 text-xs tracking-[0.3em] text-fg-muted">DAY</div>
        <div className="text-6xl font-semibold text-gold-soft leading-none">{day.day_number}</div>
      </div>
      <div className="rule mb-6" />

      {prayerPoint?.image_url && (
        <div className="mb-6 rounded-2xl overflow-hidden border border-[color:var(--border)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={prayerPoint.image_url} alt="" className="w-full h-auto" />
        </div>
      )}

      {prayerPoint && (prayerPoint.body_markdown || prayerPoint.title) && (
        <section className="mb-6">
          <p className="label mb-2">Prayer Point</p>
          {prayerPoint.title && (
            <h2 className="text-xl text-gold-soft font-semibold mb-3">{prayerPoint.title}</h2>
          )}
          {prayerPoint.body_markdown && (
            <div className="prose-prayer text-[15px] leading-relaxed text-fg"
              dangerouslySetInnerHTML={{ __html: prayerPoint.body_markdown }} />
          )}
        </section>
      )}

      {prayerPoint && prayerPoint.scriptures.length > 0 && (
        <section className="mb-6">
          <p className="label mb-2">Scripture</p>
          {prayerPoint.scriptures.map((s, i) => (
            <div key={i} className="mb-3">
              {s.text && <p className="italic text-fg/90">&ldquo;{s.text}&rdquo;</p>}
              <p className="text-gold mt-1 text-sm font-semibold">{s.reference}</p>
            </div>
          ))}
        </section>
      )}

      {tasks.length > 0 && (
        <>
          <div className="rule my-8" />
          <TasksSection tasks={tasks} />
        </>
      )}

      <div className="rule my-8" />
      <p className="text-center text-[11px] tracking-[0.3em] text-fg-muted">
        {program.name.toUpperCase()}
      </p>

      <div className="fixed bottom-0 left-0 right-0 bg-[color:var(--bg-2)]/90 backdrop-blur border-t border-[color:var(--border)]">
        <div className="max-w-md mx-auto flex items-center justify-around py-3 text-xs uppercase tracking-[0.2em]">
          <Link href="/today" className="text-gold">Today</Link>
          <Link href="/history" className="text-fg-muted hover:text-gold">History</Link>
          <Link href={`/leaderboard/${program.id}`} className="text-fg-muted hover:text-gold">Board</Link>
        </div>
      </div>
    </div>
  );
}
