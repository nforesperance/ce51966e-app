import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { supabaseAdmin } from "@/lib/supabase/admin";

const TaskBody = z.object({
  type: z.enum(["prayer", "reading", "other"]),
  title: z.string().min(1).max(200),
  duration_minutes: z.number().int().min(1).max(1440).nullable().optional(),
  target_start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  full_marks_window_minutes: z.number().int().min(0).max(1440).nullable().optional(),
  zero_marks_window_minutes: z.number().int().min(1).max(1440).nullable().optional(),
  full_marks_end_window_minutes: z.number().int().min(0).max(1440).nullable().optional(),
  zero_marks_end_window_minutes: z.number().int().min(1).max(1440).nullable().optional(),
  max_points: z.number().int().min(1).max(10000).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
  position: z.number().int().min(0).max(100).optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ dayId: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { dayId } = await ctx.params;
  const parsed = TaskBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const sb = supabaseAdmin();
  // Determine next position if not provided
  let position = parsed.data.position;
  if (position === undefined) {
    const { data: last } = await sb.from("tasks").select("position").eq("program_day_id", dayId)
      .order("position", { ascending: false }).limit(1).maybeSingle();
    position = (last?.position ?? -1) + 1;
  }

  const { data, error } = await sb.from("tasks").insert({
    program_day_id: dayId,
    type: parsed.data.type,
    title: parsed.data.title,
    duration_minutes: parsed.data.duration_minutes ?? null,
    target_start_time: parsed.data.target_start_time ?? null,
    full_marks_window_minutes: parsed.data.full_marks_window_minutes ?? 5,
    zero_marks_window_minutes: parsed.data.zero_marks_window_minutes ?? 120,
    full_marks_end_window_minutes: parsed.data.full_marks_end_window_minutes ?? 5,
    zero_marks_end_window_minutes: parsed.data.zero_marks_end_window_minutes ?? 120,
    max_points: parsed.data.max_points ?? 100,
    metadata: parsed.data.metadata ?? {},
    position,
  }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ task: data });
}
