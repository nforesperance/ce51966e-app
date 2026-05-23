import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { TASK_DEFAULTS } from "@/lib/appDefaults";
import { supabaseAdmin } from "@/lib/supabase/admin";

const Body = z.object({
  task_id: z.string().uuid(),
  user_id: z.string().uuid(),
  action: z.enum(["full", "custom", "clear"]),
  points: z.number().int().min(0).max(100000).optional(),
  reason: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const { task_id, user_id, action, points, reason } = parsed.data;

  const sb = supabaseAdmin();
  const { data: task } = await sb.from("tasks").select("max_points").eq("id", task_id).maybeSingle();
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  if (action === "clear") {
    const { error } = await sb.from("task_completions").delete()
      .eq("task_id", task_id).eq("user_id", user_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await sb.from("audit_log").insert({
      actor_id: guard.user.id, action: "completion.clear",
      target_type: "task_completion", target_id: null,
      payload: { task_id, user_id, reason },
    });
    return NextResponse.json({ ok: true });
  }

  const awarded = action === "full" ? (task.max_points ?? TASK_DEFAULTS.maxPoints) : Math.max(0, points ?? 0);
  const now = new Date().toISOString();

  const { data: existing } = await sb.from("task_completions")
    .select("id").eq("task_id", task_id).eq("user_id", user_id).maybeSingle();

  const basePatch = {
    completed_at: now,
    marked_complete_at: now,
    points_awarded: awarded,
    admin_override: true,
    override_by: guard.user.id,
    override_reason: reason ?? null,
    started_at: null,
  };

  if (existing) {
    const { data, error } = await sb.from("task_completions").update(basePatch)
      .eq("id", existing.id).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await sb.from("audit_log").insert({
      actor_id: guard.user.id, action: "completion.override",
      target_type: "task_completion", target_id: existing.id,
      payload: { action, points: awarded, reason },
    });
    return NextResponse.json({ completion: data });
  }
  const { data, error } = await sb.from("task_completions").insert({
    task_id, user_id, ...basePatch, first_started_at: now, elapsed_seconds: 0,
  }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await sb.from("audit_log").insert({
    actor_id: guard.user.id, action: "completion.override",
    target_type: "task_completion", target_id: data.id,
    payload: { action, points: awarded, reason },
  });
  return NextResponse.json({ completion: data });
}
