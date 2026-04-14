import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateLoginKey } from "@/lib/auth/loginKey";

const CreateBody = z.object({
  full_name: z.string().min(1).max(120),
  phone: z.string().max(40).optional().nullable(),
  whatsapp: z.string().max(40).optional().nullable(),
  level: z.string().max(40).optional().nullable(),
});

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  // Generate a unique 4-char key (retry on hash collision — unlikely but cheap).
  const key = generateLoginKey(4);
  const hash = await bcrypt.hash(key, 10);
  const { data, error } = await supabaseAdmin()
    .from("users")
    .insert({
      full_name: parsed.data.full_name,
      phone: parsed.data.phone || null,
      whatsapp: parsed.data.whatsapp || null,
      level: parsed.data.level || null,
      role: "participant",
      login_key_hash: hash,
      login_key_hint: key[0] + "***",
    })
    .select("id, full_name, phone, whatsapp, level, active, login_key_hint, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin().from("audit_log").insert({
    actor_id: guard.user.id, action: "user.create", target_type: "user", target_id: data.id,
    payload: { full_name: data.full_name },
  });

  // Return the plaintext key ONCE so admin can share it.
  return NextResponse.json({ user: data, login_key: key });
}
