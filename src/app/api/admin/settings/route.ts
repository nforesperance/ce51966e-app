import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { SettingsSchema } from "@/lib/appDefaults";
import { getAppSettings } from "@/lib/settings";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  return NextResponse.json({ settings: await getAppSettings() });
}

export async function PUT(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const parsed = SettingsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      { error: issue ? `${issue.path.join(".")}: ${issue.message}` : "Invalid settings" },
      { status: 400 },
    );
  }

  const sb = supabaseAdmin();
  const { error } = await sb.from("app_settings").upsert({
    id: "global",
    value: parsed.data,
    updated_by: guard.user.id,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    const missing = /app_settings/.test(error.message) && /(does not exist|schema cache)/i.test(error.message);
    return NextResponse.json(
      { error: missing ? "Run migration 0010_app_settings.sql to enable settings" : error.message },
      { status: 500 },
    );
  }

  await sb.from("audit_log").insert({
    actor_id: guard.user.id, action: "settings.update", target_type: "app_settings", target_id: "global",
    payload: parsed.data,
  });
  return NextResponse.json({ settings: parsed.data });
}
