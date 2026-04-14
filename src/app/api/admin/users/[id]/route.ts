import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { supabaseAdmin } from "@/lib/supabase/admin";

const PatchBody = z.object({
  full_name: z.string().min(1).max(120).optional(),
  phone: z.string().max(40).nullable().optional(),
  whatsapp: z.string().max(40).nullable().optional(),
  level: z.string().max(40).nullable().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { data, error } = await supabaseAdmin()
    .from("users")
    .update(parsed.data)
    .eq("id", id)
    .select("id, full_name, phone, whatsapp, level, active, login_key_hint")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin().from("audit_log").insert({
    actor_id: guard.user.id, action: "user.update", target_type: "user", target_id: id,
    payload: parsed.data,
  });
  return NextResponse.json({ user: data });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  // Safety: never allow deleting an admin via this endpoint.
  const { data: target } = await supabaseAdmin().from("users").select("role").eq("id", id).maybeSingle();
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (target.role === "admin") return NextResponse.json({ error: "Cannot delete admin" }, { status: 400 });

  const { error } = await supabaseAdmin().from("users").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabaseAdmin().from("audit_log").insert({
    actor_id: guard.user.id, action: "user.delete", target_type: "user", target_id: id, payload: {},
  });
  return NextResponse.json({ ok: true });
}
