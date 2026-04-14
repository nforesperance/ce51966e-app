import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { loadActionableTaskForUser } from "@/lib/tasks";
import { scorePrayer } from "@/lib/scoring";

const Body = z.object({ action: z.enum(["start", "pause", "resume", "restart", "complete"]) });

type Completion = {
  id: string;
  task_id: string;
  user_id: string;
  first_started_at: string | null;
  started_at: string | null;
  elapsed_seconds: number;
  completed_at: string | null;
  points_awarded: number;
};

export async function POST(req: NextRequest, ctx: { params: Promise<{ taskId: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { taskId } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const data = await loadActionableTaskForUser(taskId, user.id);
  if (!data) return NextResponse.json({ error: "Task not available" }, { status: 403 });
  if (data.task.type !== "prayer") return NextResponse.json({ error: "Prayer action only" }, { status: 400 });
  const { task, day, program } = data;

  const sb = supabaseAdmin();
  const { data: existing } = await sb.from("task_completions")
    .select("*").eq("task_id", taskId).eq("user_id", user.id).maybeSingle() as { data: Completion | null };

  const now = new Date();
  const action = parsed.data.action;

  if (existing?.completed_at && action !== "restart") {
    return NextResponse.json({ error: "Already completed" }, { status: 400 });
  }

  let next: Partial<Completion>;
  const running = !!existing?.started_at;
  const accumWithLive = (existing?.elapsed_seconds ?? 0)
    + (running ? Math.floor((now.getTime() - new Date(existing!.started_at!).getTime()) / 1000) : 0);

  switch (action) {
    case "start":
      if (existing?.first_started_at) return NextResponse.json({ error: "Already started — use resume" }, { status: 400 });
      next = { first_started_at: now.toISOString(), started_at: now.toISOString(), elapsed_seconds: 0 };
      break;
    case "pause":
      if (!running) return NextResponse.json({ error: "Not running" }, { status: 400 });
      next = { started_at: null, elapsed_seconds: accumWithLive };
      break;
    case "resume":
      if (running) return NextResponse.json({ completion: existing });
      if (!existing?.first_started_at) return NextResponse.json({ error: "Not started" }, { status: 400 });
      next = { started_at: now.toISOString() };
      break;
    case "restart":
      next = {
        first_started_at: now.toISOString(),
        started_at: now.toISOString(),
        elapsed_seconds: 0,
        completed_at: null,
        points_awarded: 0,
      };
      break;
    case "complete": {
      const firstStart = existing?.first_started_at ?? existing?.started_at;
      if (!firstStart) return NextResponse.json({ error: "Must start first" }, { status: 400 });
      const finalElapsed = accumWithLive;
      const points = scorePrayer({
        task, programDate: day.date, programTimezone: program.timezone,
        firstStartedAt: new Date(firstStart),
        completedAt: now,
        elapsedSeconds: finalElapsed,
      });
      next = {
        started_at: null,
        elapsed_seconds: finalElapsed,
        completed_at: now.toISOString(),
        points_awarded: points,
      };
      break;
    }
  }

  const basePayload = { task_id: taskId, user_id: user.id };
  let result: Completion;
  if (existing) {
    const { data: up, error } = await sb.from("task_completions")
      .update(next).eq("id", existing.id).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    result = up as Completion;
  } else {
    const { data: ins, error } = await sb.from("task_completions")
      .insert({ ...basePayload, ...next }).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    result = ins as Completion;
  }
  return NextResponse.json({ completion: result });
}
