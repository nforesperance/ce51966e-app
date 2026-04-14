import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import ParticipantDrilldownClient from "./ParticipantDrilldownClient";

export const dynamic = "force-dynamic";

export default async function ParticipantDrilldown({
  params,
}: { params: Promise<{ id: string; userId: string }> }) {
  const { id, userId } = await params;
  const sb = supabaseAdmin();

  const [{ data: program }, { data: user }, { data: membership }] = await Promise.all([
    sb.from("programs").select("id, name, start_date, end_date, timezone").eq("id", id).maybeSingle(),
    sb.from("users").select("id, full_name, level, whatsapp").eq("id", userId).maybeSingle(),
    sb.from("program_participants").select("user_id").eq("program_id", id).eq("user_id", userId).maybeSingle(),
  ]);
  if (!program || !user || !membership) notFound();

  const { data: days } = await sb.from("program_days")
    .select("id, day_number, date").eq("program_id", id).order("day_number");

  const dayIds = (days ?? []).map((d) => d.id);
  const { data: tasks } = await sb.from("tasks")
    .select("id, program_day_id, type, title, duration_minutes, target_start_time, max_points, metadata, position")
    .in("program_day_id", dayIds.length ? dayIds : ["00000000-0000-0000-0000-000000000000"])
    .order("position");

  const taskIds = (tasks ?? []).map((t) => t.id);
  const { data: completions } = await sb.from("task_completions")
    .select("*")
    .eq("user_id", userId)
    .in("task_id", taskIds.length ? taskIds : ["00000000-0000-0000-0000-000000000000"]);

  const { data: bonuses } = await sb.from("bonus_awards")
    .select("id, points, reason, created_at, awarded_by, users:awarded_by(full_name)")
    .eq("program_id", id).eq("user_id", userId)
    .order("created_at", { ascending: false });

  const compByTask = new Map((completions ?? []).map((c) => [c.task_id, c]));
  const taskTotals = (completions ?? []).reduce((s, c) => s + (c.completed_at ? c.points_awarded : 0), 0);
  const bonusTotals = (bonuses ?? []).reduce((s, b) => s + b.points, 0);

  const daysEnriched = (days ?? []).map((d) => ({
    ...d,
    tasks: (tasks ?? []).filter((t) => t.program_day_id === d.id).map((t) => ({
      ...t,
      chapters: (t.metadata?.chapters as string[] | undefined) ?? [],
      completion: compByTask.get(t.id) ?? null,
    })),
  }));

  const bonusesFlat = (bonuses ?? []).map((b) => {
    const raw = (b as { users: unknown }).users;
    const u = Array.isArray(raw) ? raw[0] : raw as { full_name?: string } | null;
    return { id: b.id, points: b.points, reason: b.reason, created_at: b.created_at, awarded_by: u?.full_name ?? null };
  });

  return (
    <div>
      <div className="mb-1">
        <Link href={`/admin/programs/${id}`} className="text-sm text-fg-muted hover:text-gold">
          ← {program.name}
        </Link>
      </div>
      <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold">{user.full_name}</h1>
          <p className="text-fg-muted text-sm mt-1">
            {user.level && `Level ${user.level} · `}{user.whatsapp ?? "no whatsapp"}
          </p>
        </div>
        <div className="card px-5 py-3 text-right">
          <p className="label">Total</p>
          <p className="text-3xl font-semibold text-gold-soft mt-1 tabular-nums">{taskTotals + bonusTotals}</p>
          <p className="text-[11px] text-fg-muted">
            {taskTotals} tasks · {bonusTotals >= 0 ? "+" : ""}{bonusTotals} bonus
          </p>
        </div>
      </div>

      <ParticipantDrilldownClient
        programId={id}
        programTimezone={program.timezone}
        userId={userId}
        days={daysEnriched}
        bonuses={bonusesFlat}
      />
    </div>
  );
}
