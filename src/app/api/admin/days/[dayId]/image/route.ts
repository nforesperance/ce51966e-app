import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { supabaseAdmin } from "@/lib/supabase/admin";

const MAX_BYTES = 2 * 1024 * 1024;
const BUCKET = "prayer-images";
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(req: NextRequest, ctx: { params: Promise<{ dayId: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const { dayId } = await ctx.params;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (!ALLOWED.has(file.type)) return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Image exceeds 2MB" }, { status: 400 });

  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const path = `days/${dayId}/${Date.now()}.${ext}`;
  const sb = supabaseAdmin();
  const buf = Buffer.from(await file.arrayBuffer());
  const { error } = await sb.storage.from(BUCKET).upload(path, buf, {
    contentType: file.type, upsert: true,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl, path });
}
