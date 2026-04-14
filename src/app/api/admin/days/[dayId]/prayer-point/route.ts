import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { supabaseAdmin } from "@/lib/supabase/admin";

const Scripture = z.object({
  reference: z.string().min(1).max(120),
  text: z.string().max(4000).nullable().optional(),
});
const Body = z.object({
  title: z.string().max(200).nullable().optional(),
  body_markdown: z.string().max(30000).nullable().optional(),  // HTML from Tiptap
  image_url: z.string().url().nullable().optional(),
  scriptures: z.array(Scripture).max(20).default([]),
});

export async function PUT(req: NextRequest, ctx: { params: Promise<{ dayId: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { dayId } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const sb = supabaseAdmin();

  // Upsert (one prayer point per day). We look up an existing row, then insert or update.
  const { data: existing } = await sb
    .from("prayer_points").select("id").eq("program_day_id", dayId).maybeSingle();

  const payload = {
    program_day_id: dayId,
    title: parsed.data.title ?? null,
    body_markdown: parsed.data.body_markdown ?? null,
    image_url: parsed.data.image_url ?? null,
  };
  let id: string;
  if (existing) {
    const { data, error } = await sb.from("prayer_points").update(payload).eq("id", existing.id).select("id").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    id = data.id;
  } else {
    const { data, error } = await sb.from("prayer_points").insert(payload).select("id").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    id = data.id;
  }

  // Replace scriptures
  await sb.from("scriptures").delete().eq("prayer_point_id", id);
  if (parsed.data.scriptures.length > 0) {
    const rows = parsed.data.scriptures.map((s, i) => ({
      prayer_point_id: id,
      reference: s.reference,
      text: s.text ?? null,
      position: i,
    }));
    const { error } = await sb.from("scriptures").insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await sb.from("audit_log").insert({
    actor_id: guard.user.id, action: "prayer_point.save",
    target_type: "prayer_point", target_id: id, payload: { day_id: dayId },
  });
  return NextResponse.json({ id });
}
