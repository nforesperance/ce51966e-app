import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  const sb = supabaseAdmin();
  const { error } = await sb.from("presets").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await sb.from("audit_log").insert({
    actor_id: guard.user.id, action: "preset.delete", target_type: "preset", target_id: id, payload: {},
  });
  return NextResponse.json({ ok: true });
}
