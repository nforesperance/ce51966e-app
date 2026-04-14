import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { supabaseAdmin } from "@/lib/supabase/admin";

const Patch = z.object({
  title: z.string().min(1).max(200).optional(),
  duration_minutes: z.number().int().min(1).max(1440).nullable().optional(),
  target_start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  full_marks_window_minutes: z.number().int().min(0).max(1440).nullable().optional(),
  zero_marks_window_minutes: z.number().int().min(1).max(1440).nullable().optional(),
  full_marks_end_window_minutes: z.number().int().min(0).max(1440).nullable().optional(),
  zero_marks_end_window_minutes: z.number().int().min(1).max(1440).nullable().optional(),
  max_points: z.number().int().min(1).max(10000).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  position: z.number().int().min(0).max(100).optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ taskId: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { taskId } = await ctx.params;
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const { data, error } = await supabaseAdmin()
    .from("tasks").update(parsed.data).eq("id", taskId).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ task: data });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ taskId: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { taskId } = await ctx.params;
  const { error } = await supabaseAdmin().from("tasks").delete().eq("id", taskId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
