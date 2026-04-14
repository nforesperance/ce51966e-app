import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { eachDate, daysBetween } from "@/lib/dates";

const Body = z.object({
  name: z.string().min(1).max(120),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timezone: z.string().min(1).max(64).default("UTC"),
});

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  if (parsed.data.end_date < parsed.data.start_date) {
    return NextResponse.json({ error: "end_date must be on or after start_date" }, { status: 400 });
  }
  const total = daysBetween(parsed.data.start_date, parsed.data.end_date);
  if (total > 365) return NextResponse.json({ error: "Program too long (max 365 days)" }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: program, error } = await sb
    .from("programs")
    .insert({
      name: parsed.data.name,
      start_date: parsed.data.start_date,
      end_date: parsed.data.end_date,
      timezone: parsed.data.timezone,
      created_by: guard.user.id,
    })
    .select("id, name, start_date, end_date, timezone, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Generate program_days
  const rows: { program_id: string; day_number: number; date: string }[] = [];
  let n = 1;
  for (const d of eachDate(parsed.data.start_date, parsed.data.end_date)) {
    rows.push({ program_id: program.id, day_number: n++, date: d });
  }
  const { error: dayErr } = await sb.from("program_days").insert(rows);
  if (dayErr) {
    await sb.from("programs").delete().eq("id", program.id);
    return NextResponse.json({ error: dayErr.message }, { status: 500 });
  }

  await sb.from("audit_log").insert({
    actor_id: guard.user.id, action: "program.create", target_type: "program",
    target_id: program.id, payload: { days: rows.length },
  });
  return NextResponse.json({ program });
}
