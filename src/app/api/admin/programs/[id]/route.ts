import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { supabaseAdmin } from "@/lib/supabase/admin";

const Patch = z.object({
  name: z.string().min(1).max(120).optional(),
  timezone: z.string().min(1).max(64).optional(),
  next_day_preview_hours: z.number().int().min(0).max(24).optional(),
  day_unlock_offset_minutes: z.number().int().min(0).max(60).optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { data, error } = await supabaseAdmin()
    .from("programs").update(parsed.data).eq("id", id)
    .select("id, name, start_date, end_date, timezone").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin().from("audit_log").insert({
    actor_id: guard.user.id, action: "program.update", target_type: "program", target_id: id, payload: parsed.data,
  });
  return NextResponse.json({ program: data });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  const { error } = await supabaseAdmin().from("programs").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabaseAdmin().from("audit_log").insert({
    actor_id: guard.user.id, action: "program.delete", target_type: "program", target_id: id, payload: {},
  });
  return NextResponse.json({ ok: true });
}
