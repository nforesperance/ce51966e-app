import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { supabaseAdmin } from "@/lib/supabase/admin";

const Patch = z.object({
  name: z.string().min(1).max(120).optional(),
  timezone: z.string().min(1).max(64).optional(),
  next_day_preview_hours: z.number().int().min(0).max(24).optional(),
  day_unlock_offset_minutes: z.number().int().min(0).max(60).optional(),
  card_defaults: z.record(z.string(), z.unknown()).optional(),
  // With card_defaults: also clear every day's per-day card overrides.
  reset_day_card_overrides: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { reset_day_card_overrides: resetDays, ...update } = parsed.data;
  const { data, error } = await supabaseAdmin()
    .from("programs").update(update).eq("id", id)
    .select("id, name, start_date, end_date, timezone, card_defaults").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (resetDays && update.card_defaults) {
    const { data: days, error: daysError } = await supabaseAdmin()
      .from("program_days").select("id").eq("program_id", id);
    if (daysError) return NextResponse.json({ error: daysError.message }, { status: 500 });
    const dayIds = (days ?? []).map((d) => d.id);
    if (dayIds.length > 0) {
      const { error: resetError } = await supabaseAdmin()
        .from("prayer_points").update({ card_config: {} }).in("program_day_id", dayIds);
      if (resetError) return NextResponse.json({ error: resetError.message }, { status: 500 });
    }
  }

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
