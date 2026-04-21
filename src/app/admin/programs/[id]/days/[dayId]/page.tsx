import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import DayEditorClient from "./DayEditorClient";

export const dynamic = "force-dynamic";

export default async function DayEditorPage({ params }: { params: Promise<{ id: string; dayId: string }> }) {
  const { id, dayId } = await params;
  const sb = supabaseAdmin();
  const { data: day } = await sb
    .from("program_days")
    .select("id, day_number, date, program_id, programs(name, card_defaults)")
    .eq("id", dayId).maybeSingle();
  if (!day || day.program_id !== id) notFound();

  const raw = (day as { programs: unknown }).programs;
  const program = Array.isArray(raw) ? raw[0] : (raw as { name: string; card_defaults: Record<string, unknown> });

  const { data: prayerPoint } = await sb
    .from("prayer_points")
    .select("id, title, body_markdown, image_url, card_config, scriptures(reference, text, position)")
    .eq("program_day_id", dayId).maybeSingle();

  const { data: tasks } = await sb
    .from("tasks")
    .select("*")
    .eq("program_day_id", dayId)
    .order("position");

  const scriptures = ((prayerPoint?.scriptures ?? []) as { reference: string; text: string | null; position: number }[])
    .sort((a, b) => a.position - b.position)
    .map((s) => ({ reference: s.reference, text: s.text ?? "" }));

  return (
    <div>
      <div className="mb-1">
        <Link href={`/admin/programs/${id}`} className="text-sm text-fg-muted hover:text-gold">
          ← {program?.name}
        </Link>
      </div>
      <div className="flex items-baseline gap-3 mb-6">
        <h1 className="text-2xl font-semibold">Day {day.day_number}</h1>
        <p className="text-fg-muted text-sm">{day.date}</p>
      </div>
      <DayEditorClient
        dayId={day.id}
        programName={program?.name ?? ""}
        dayNumber={day.day_number}
        cardDefaults={(program?.card_defaults ?? {}) as Record<string, unknown>}
        initialPrayerPoint={{
          title: prayerPoint?.title ?? "",
          body_html: prayerPoint?.body_markdown ?? "",
          image_url: prayerPoint?.image_url ?? null,
          scriptures,
          card_config: (prayerPoint?.card_config ?? {}) as Record<string, unknown>,
        }}
        initialTasks={tasks ?? []}
      />
    </div>
  );
}
