import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { supabaseAdmin } from "@/lib/supabase/admin";

const Kind = z.enum(["card", "task"]);
const Body = z.object({
  kind: Kind,
  name: z.string().trim().min(1).max(80),
  config: z.record(z.string(), z.unknown()),
});

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const kind = Kind.safeParse(req.nextUrl.searchParams.get("kind"));
  if (!kind.success) return NextResponse.json({ error: "Invalid kind" }, { status: 400 });

  const { data, error } = await supabaseAdmin()
    .from("presets").select("id, kind, name, config, updated_at")
    .eq("kind", kind.data).order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ presets: data ?? [] });
}

// Create or overwrite (same kind + name).
export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const sb = supabaseAdmin();
  const { data, error } = await sb.from("presets").upsert({
    kind: parsed.data.kind,
    name: parsed.data.name,
    config: parsed.data.config,
    created_by: guard.user.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: "kind,name" }).select("id, kind, name, config, updated_at").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sb.from("audit_log").insert({
    actor_id: guard.user.id, action: "preset.save", target_type: "preset", target_id: data.id,
    payload: { kind: data.kind, name: data.name },
  });
  return NextResponse.json({ preset: data });
}
