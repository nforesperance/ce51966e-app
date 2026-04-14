import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateLoginKey } from "@/lib/auth/loginKey";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;

  const key = generateLoginKey(4);
  const hash = await bcrypt.hash(key, 10);
  const { error } = await supabaseAdmin()
    .from("users")
    .update({ login_key_hash: hash, login_key_hint: key[0] + "***" })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Invalidate all existing sessions for this user.
  await supabaseAdmin().from("sessions").delete().eq("user_id", id);

  await supabaseAdmin().from("audit_log").insert({
    actor_id: guard.user.id, action: "user.reset_key", target_type: "user", target_id: id, payload: {},
  });
  return NextResponse.json({ login_key: key });
}
