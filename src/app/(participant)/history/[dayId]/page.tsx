import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { todayInTz } from "@/lib/time";
import { Clock, BookOpen, ListChecks, Check } from "lucide-react";
import BottomNav from "@/components/BottomNav";

export const dynamic = "force-dynamic";

export default async function HistoryDay({ params }: { params: Promise<{ dayId: string }> }) {
  const { dayId } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const sb = supabaseAdmin();

  const { data: day } = await sb.from("program_days")
    .select("id, day_number, date, program_id, programs(id, name, timezone)")
    .eq("id", dayId).maybeSingle();
  if (!day) notFound();

  const rawP = (day as { programs: unknown }).programs;
  const program = Array.isArray(rawP) ? rawP[0] : rawP as { id: string; name: string; timezone: string };
  if (!program) notFound();

  const { data: membership } = await sb.from("program_participants")
    .select("user_id").eq("program_id", program.id).eq("user_id", user.id).maybeSingle();
  if (!membership) notFound();

  // Only past days (strictly before today in program tz) are viewable here.
  const today = todayInTz(program.timezone);
  if (day.date >= today) notFound();

  const { data: pp } = await sb.from("prayer_points")
    .select("title, body_markdown, image_url, scriptures(reference, text, position)")
    .eq("program_day_id", dayId).maybeSingle();
  const scriptures = ((pp?.scriptures ?? []) as { reference: string; text: string | null; position: number }[])
    .sort((a, b) => a.position - b.position);

  const { data: tasks } = await sb.from("tasks")
    .select("id, type, title, duration_minutes, target_start_time, max_points, metadata, position")
    .eq("program_day_id", dayId).order("position");

  const { data: completions } = await sb.from("task_completions")
    .select("task_id, completed_at, points_awarded, elapsed_seconds")
    .eq("user_id", user.id)
    .in("task_id", (tasks ?? []).map((t) => t.id).concat("00000000-0000-0000-0000-000000000000"));
  const compByTask = new Map((completions ?? []).map((c) => [c.task_id, c]));

  return (
    <div className="pt-6 pb-20">
      <div className="mb-3">
        <Link href="/history" className="text-sm text-fg-muted hover:text-gold">← History</Link>
      </div>
      <div className="text-center mb-6">
        <div className="label">{program.name}</div>
        <div className="mt-4 text-xs tracking-[0.3em] text-fg-muted">DAY</div>
        <div className="text-6xl font-semibold text-gold-soft leading-none">{day.day_number}</div>
        <p className="text-fg-muted text-xs mt-2">{day.date}</p>
      </div>
      <div className="rule mb-6" />

      {pp?.image_url && (
        <div className="mb-6 rounded-2xl overflow-hidden border border-[color:var(--border)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pp.image_url} alt="" className="w-full h-auto" />
        </div>
      )}
      {pp && (pp.title || pp.body_markdown) && (
        <section className="mb-6">
          <p className="label mb-2">Prayer Point</p>
          {pp.title && <h2 className="text-xl text-gold-soft font-semibold mb-3">{pp.title}</h2>}
          {pp.body_markdown && (
            <div className="prose-prayer text-[15px] leading-relaxed"
              dangerouslySetInnerHTML={{ __html: pp.body_markdown }} />
          )}
        </section>
      )}
      {scriptures.length > 0 && (
        <section className="mb-6">
          <p className="label mb-2">Scripture</p>
          {scriptures.map((s, i) => (
            <div key={i} className="mb-3">
              {s.text && <p className="italic text-fg/90">&ldquo;{s.text}&rdquo;</p>}
              <p className="text-gold mt-1 text-sm font-semibold">{s.reference}</p>
            </div>
          ))}
        </section>
      )}

      {(tasks ?? []).length > 0 && (
        <>
          <div className="rule my-8" />
          <section>
            <p className="label mb-3">Tasks</p>
            <div className="space-y-3">
              {(tasks ?? []).map((t) => {
                const Icon = t.type === "prayer" ? Clock : t.type === "reading" ? BookOpen : ListChecks;
                const c = compByTask.get(t.id);
                const done = !!c?.completed_at;
                return (
                  <div key={t.id} className="card p-4 flex items-start gap-3">
                    <Icon size={18} className={done ? "text-[color:var(--ok)]" : "text-fg-muted"} />
                    <div className="flex-1">
                      <div className="font-medium">{t.title}</div>
                      <div className="text-[11px] text-fg-muted mt-0.5 uppercase tracking-widest">
                        {t.type}{t.duration_minutes && ` · ${t.duration_minutes} min`}
                      </div>
                    </div>
                    {done ? (
                      <span className="text-xs text-[color:var(--ok)] flex items-center gap-1">
                        <Check size={13} /> {c!.points_awarded} pts
                      </span>
                    ) : (
                      <span className="text-xs text-fg-muted">Missed</span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      <BottomNav active="today" />

    </div>
  );
}
