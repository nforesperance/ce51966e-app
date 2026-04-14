import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage({ params }: { params: Promise<{ programId: string }> }) {
  const { programId } = await params;
  const user = await getSessionUser();
  if (!user) notFound();
  const sb = supabaseAdmin();

  const { data: program } = await sb.from("programs")
    .select("id, name").eq("id", programId).maybeSingle();
  if (!program) notFound();

  // Verify current user is enrolled (or admin)
  const { data: membership } = await sb.from("program_participants")
    .select("user_id").eq("program_id", programId).eq("user_id", user.id).maybeSingle();
  if (!membership && user.role !== "admin") notFound();

  // Aggregate points: sum task_completions.points_awarded joined to tasks joined to program_days in this program.
  const { data: rows } = await sb.rpc("leaderboard_for_program", { p_program_id: programId }) as {
    data: { user_id: string; full_name: string; total_points: number; completions: number }[] | null;
  };

  // Fallback: compute in-app if the RPC isn't installed.
  let board = rows;
  if (!board) {
    const { data: days } = await sb.from("program_days").select("id").eq("program_id", programId);
    const dayIds = (days ?? []).map((d) => d.id);
    const { data: tasks } = await sb.from("tasks").select("id").in("program_day_id", dayIds.length ? dayIds : ["00000000-0000-0000-0000-000000000000"]);
    const taskIds = (tasks ?? []).map((t) => t.id);
    const { data: comps } = await sb.from("task_completions")
      .select("user_id, points_awarded, completed_at")
      .in("task_id", taskIds.length ? taskIds : ["00000000-0000-0000-0000-000000000000"]);
    const { data: members } = await sb.from("program_participants")
      .select("user_id, users(id, full_name)").eq("program_id", programId);
    const { data: bonusRows } = await sb.from("bonus_awards")
      .select("user_id, points").eq("program_id", programId);
    const byUser = new Map<string, { full_name: string; total_points: number; completions: number }>();
    for (const m of members ?? []) {
      const raw = (m as { users: unknown }).users;
      const u = Array.isArray(raw) ? raw[0] : raw as { id: string; full_name: string };
      byUser.set(m.user_id, { full_name: u?.full_name ?? "—", total_points: 0, completions: 0 });
    }
    for (const c of comps ?? []) {
      if (!c.completed_at) continue;
      const e = byUser.get(c.user_id);
      if (!e) continue;
      e.total_points += c.points_awarded ?? 0;
      e.completions += 1;
    }
    for (const b of bonusRows ?? []) {
      const e = byUser.get(b.user_id);
      if (!e) continue;
      e.total_points += b.points;
    }
    board = Array.from(byUser.entries())
      .map(([user_id, v]) => ({ user_id, ...v }))
      .sort((a, b) => b.total_points - a.total_points || b.completions - a.completions);
  }

  return (
    <div className="pt-6 pb-28">
      <div className="text-center mb-6">
        <div className="label">{program.name}</div>
        <h1 className="text-2xl font-semibold mt-2">Leaderboard</h1>
      </div>
      <div className="rule mb-6" />

      {board && board.length > 0 ? (
        <ol className="space-y-2">
          {board.map((r, i) => {
            const isMe = r.user_id === user.id;
            return (
              <li key={r.user_id}
                className={`card p-3 flex items-center gap-3 ${isMe ? "border-[color:var(--gold)]" : ""}`}>
                <div className={`w-8 text-center font-semibold ${i < 3 ? "text-gold-soft" : "text-fg-muted"}`}>
                  {i + 1}
                </div>
                <div className="flex-1">
                  <div className={`text-sm ${isMe ? "text-gold" : ""}`}>
                    {r.full_name}{isMe && " (you)"}
                  </div>
                  <div className="text-[11px] text-fg-muted">{r.completions} tasks</div>
                </div>
                <div className="text-lg font-semibold text-gold-soft tabular-nums">{r.total_points}</div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="text-center text-fg-muted">No scores yet.</p>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-[color:var(--bg-2)]/90 backdrop-blur border-t border-[color:var(--border)]">
        <div className="max-w-md mx-auto flex items-center justify-around py-3 text-xs uppercase tracking-[0.2em]">
          <Link href="/today" className="text-fg-muted hover:text-gold">Today</Link>
          <Link href="/history" className="text-fg-muted hover:text-gold">History</Link>
          <span className="text-gold">Board</span>
        </div>
      </div>
    </div>
  );
}
