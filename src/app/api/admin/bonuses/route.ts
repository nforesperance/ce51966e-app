import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { supabaseAdmin } from "@/lib/supabase/admin";

const Body = z.object({
  program_id: z.string().uuid(),
  user_id: z.string().uuid(),
  points: z.number().int().min(-10000).max(10000),
  reason: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const sb = supabaseAdmin();
  const { data, error } = await sb.from("bonus_awards").insert({
    program_id: parsed.data.program_id,
    user_id: parsed.data.user_id,
    points: parsed.data.points,
    reason: parsed.data.reason ?? null,
    awarded_by: guard.user.id,
  }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sb.from("audit_log").insert({
    actor_id: guard.user.id, action: "bonus.award",
    target_type: "bonus_award", target_id: data.id,
    payload: { program_id: data.program_id, user_id: data.user_id, points: data.points },
  });
  return NextResponse.json({ bonus: data });
}

export async function DELETE(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await supabaseAdmin().from("bonus_awards").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabaseAdmin().from("audit_log").insert({
    actor_id: guard.user.id, action: "bonus.delete",
    target_type: "bonus_award", target_id: id, payload: {},
  });
  return NextResponse.json({ ok: true });
}
