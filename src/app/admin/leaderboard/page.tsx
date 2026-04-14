import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import LeaderboardFilters from "./LeaderboardFilters";

export const dynamic = "force-dynamic";

type SearchParams = { program?: string; level?: string; q?: string };

export default async function AdminLeaderboardPage({
  searchParams,
}: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const programFilter = sp.program || "all";
  const levelFilter = sp.level || "all";
  const q = (sp.q || "").trim().toLowerCase();

  const sb = supabaseAdmin();

  const [{ data: programs }, { data: users }] = await Promise.all([
    sb.from("programs").select("id, name").order("start_date", { ascending: false }),
    sb.from("users").select("id, full_name, level, active").eq("role", "participant"),
  ]);

  // For program filter: include a "tasks & bonuses belong to one program" scope if filtered.
  // Load memberships (for program-scoping) and tasks/completions/bonuses in parallel.
  const membershipsQ = sb.from("program_participants").select("program_id, user_id");
  const bonusesQ = sb.from("bonus_awards").select("program_id, user_id, points");

  // For scoring, we need task.program_day.program_id. We load program_days + tasks + completions
  // and join in-app (small scale).
  const daysQ = sb.from("program_days").select("id, program_id");
  const tasksQ = sb.from("tasks").select("id, program_day_id");
  const compsQ = sb.from("task_completions").select("task_id, user_id, points_awarded, completed_at");

  const [
    { data: memberships }, { data: bonuses },
    { data: days }, { data: tasks }, { data: comps },
  ] = await Promise.all([membershipsQ, bonusesQ, daysQ, tasksQ, compsQ]);

  const programByDay = new Map((days ?? []).map((d) => [d.id, d.program_id]));
  const programByTask = new Map((tasks ?? []).map((t) => [t.id, programByDay.get(t.program_day_id) ?? null]));

  type Row = {
    user_id: string; full_name: string; level: string | null;
    programs: Set<string>;                    // programs this user is in
    task_points: number; task_points_filtered: number;
    bonus_points: number; bonus_points_filtered: number;
    completions: number; completions_filtered: number;
  };
  const rows = new Map<string, Row>();
  for (const u of users ?? []) {
    rows.set(u.id, {
      user_id: u.id, full_name: u.full_name, level: u.level,
      programs: new Set(),
      task_points: 0, task_points_filtered: 0,
      bonus_points: 0, bonus_points_filtered: 0,
      completions: 0, completions_filtered: 0,
    });
  }
  for (const m of memberships ?? []) {
    rows.get(m.user_id)?.programs.add(m.program_id);
  }
  for (const c of comps ?? []) {
    if (!c.completed_at) continue;
    const r = rows.get(c.user_id); if (!r) continue;
    const p = programByTask.get(c.task_id) ?? null;
    r.task_points += c.points_awarded ?? 0;
    r.completions += 1;
    if (programFilter === "all" || p === programFilter) {
      r.task_points_filtered += c.points_awarded ?? 0;
      r.completions_filtered += 1;
    }
  }
  for (const b of bonuses ?? []) {
    const r = rows.get(b.user_id); if (!r) continue;
    r.bonus_points += b.points;
    if (programFilter === "all" || b.program_id === programFilter) {
      r.bonus_points_filtered += b.points;
    }
  }

  let list = Array.from(rows.values());
  // Apply filters
  if (programFilter !== "all") {
    list = list.filter((r) => r.programs.has(programFilter));
  }
  if (levelFilter !== "all") {
    list = list.filter((r) => (r.level ?? "") === levelFilter);
  }
  if (q) {
    list = list.filter((r) =>
      r.full_name.toLowerCase().includes(q) || (r.level ?? "").toLowerCase().includes(q)
    );
  }
  list.sort((a, b) =>
    (b.task_points_filtered + b.bonus_points_filtered) - (a.task_points_filtered + a.bonus_points_filtered) ||
    b.completions_filtered - a.completions_filtered
  );

  const levels = Array.from(new Set((users ?? []).map((u) => u.level).filter((x): x is string => !!x))).sort();

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-5">Leaderboard</h1>
      <LeaderboardFilters
        programs={programs ?? []}
        levels={levels}
        current={{ program: programFilter, level: levelFilter, q }}
      />
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-fg-muted border-b border-[color:var(--border)]">
              <tr>
                <th className="py-3 px-4 w-10">#</th>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Level</th>
                <th className="py-3 px-4 text-right">Tasks</th>
                <th className="py-3 px-4 text-right">Bonus</th>
                <th className="py-3 px-4 text-right">Total</th>
                <th className="py-3 px-4 text-right">Done</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 && (
                <tr><td colSpan={7} className="py-10 text-center text-fg-muted">No results.</td></tr>
              )}
              {list.map((r, i) => {
                const total = r.task_points_filtered + r.bonus_points_filtered;
                return (
                  <tr key={r.user_id} className="border-b border-[color:var(--border)] last:border-0">
                    <td className="py-3 px-4 text-fg-muted">{i + 1}</td>
                    <td className="py-3 px-4">
                      {programFilter !== "all" ? (
                        <Link href={`/admin/programs/${programFilter}/participants/${r.user_id}`}
                          className="hover:text-gold">{r.full_name}</Link>
                      ) : r.full_name}
                    </td>
                    <td className="py-3 px-4 text-fg-muted">{r.level ?? "—"}</td>
                    <td className="py-3 px-4 text-right tabular-nums">{r.task_points_filtered}</td>
                    <td className="py-3 px-4 text-right tabular-nums text-fg-muted">
                      {r.bonus_points_filtered > 0 ? "+" : ""}{r.bonus_points_filtered || "—"}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums font-semibold text-gold-soft">{total}</td>
                    <td className="py-3 px-4 text-right tabular-nums text-fg-muted">{r.completions_filtered}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
