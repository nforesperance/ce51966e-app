// Reading / other tasks only. Prayer uses /action.
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { loadActionableTaskForUser } from "@/lib/tasks";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ taskId: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { taskId } = await ctx.params;

  const data = await loadActionableTaskForUser(taskId, user.id);
  if (!data) return NextResponse.json({ error: "Task not available" }, { status: 403 });
  const { task } = data;
  if (task.type === "prayer") return NextResponse.json({ error: "Use /action for prayer" }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: existing } = await sb.from("task_completions")
    .select("*").eq("task_id", taskId).eq("user_id", user.id).maybeSingle();
  if (existing?.completed_at) return NextResponse.json({ completion: existing });

  const now = new Date();
  const payload = {
    task_id: taskId, user_id: user.id,
    completed_at: now.toISOString(),
    marked_complete_at: now.toISOString(),
    points_awarded: task.max_points ?? 100,
  };
  if (existing) {
    const { data: up, error } = await sb.from("task_completions")
      .update(payload).eq("id", existing.id).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ completion: up });
  }
  const { data: ins, error } = await sb.from("task_completions")
    .insert(payload).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ completion: ins });
}
