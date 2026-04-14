import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateLoginKey } from "@/lib/auth/loginKey";

const Row = z.object({
  full_name: z.string().min(1).max(120),
  phone: z.string().max(40).optional().default(""),
  whatsapp: z.string().max(40).optional().default(""),
  level: z.string().max(40).optional().default(""),
});
const Body = z.object({ rows: z.array(Row).min(1).max(500) });

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const created: { id: string; full_name: string; login_key: string; whatsapp: string | null }[] = [];
  const failed: { full_name: string; error: string }[] = [];

  for (const r of parsed.data.rows) {
    const key = generateLoginKey(4);
    const hash = await bcrypt.hash(key, 10);
    const { data, error } = await supabaseAdmin()
      .from("users")
      .insert({
        full_name: r.full_name,
        phone: r.phone || null,
        whatsapp: r.whatsapp || null,
        level: r.level || null,
        role: "participant",
        login_key_hash: hash,
        login_key_hint: key[0] + "***",
      })
      .select("id, full_name, whatsapp")
      .single();
    if (error) {
      failed.push({ full_name: r.full_name, error: error.message });
    } else {
      created.push({ id: data.id, full_name: data.full_name, whatsapp: data.whatsapp, login_key: key });
    }
  }

  await supabaseAdmin().from("audit_log").insert({
    actor_id: guard.user.id, action: "user.bulk_create", target_type: "user", target_id: null,
    payload: { created: created.length, failed: failed.length },
  });

  return NextResponse.json({ created, failed });
}
