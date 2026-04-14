import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { supabaseAdmin } from "@/lib/supabase/admin";

const Body = z.object({ user_ids: z.array(z.string().uuid()).min(1).max(500) });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const rows = parsed.data.user_ids.map((u) => ({ program_id: id, user_id: u }));
  const { error } = await supabaseAdmin()
    .from("program_participants")
    .upsert(rows, { onConflict: "program_id,user_id", ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin().from("audit_log").insert({
    actor_id: guard.user.id, action: "program.add_participants",
    target_type: "program", target_id: id, payload: { count: rows.length },
  });
  return NextResponse.json({ added: rows.length });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  const userId = req.nextUrl.searchParams.get("user_id");
  if (!userId) return NextResponse.json({ error: "user_id required" }, { status: 400 });
  const { error } = await supabaseAdmin()
    .from("program_participants")
    .delete().eq("program_id", id).eq("user_id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabaseAdmin().from("audit_log").insert({
    actor_id: guard.user.id, action: "program.remove_participant",
    target_type: "program", target_id: id, payload: { user_id: userId },
  });
  return NextResponse.json({ ok: true });
}
