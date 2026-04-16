import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import ProgramDetailClient from "./ProgramDetailClient";

export const dynamic = "force-dynamic";

export default async function ProgramDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = supabaseAdmin();

  const { data: program } = await sb
    .from("programs")
    .select("id, name, start_date, end_date, timezone, next_day_preview_hours")
    .eq("id", id).maybeSingle();
  if (!program) notFound();

  const { data: days } = await sb
    .from("program_days")
    .select("id, day_number, date")
    .eq("program_id", id)
    .order("day_number");

  const { data: participants } = await sb
    .from("program_participants")
    .select("user_id, users(id, full_name, level, whatsapp, active)")
    .eq("program_id", id);

  const { data: availableUsers } = await sb
    .from("users")
    .select("id, full_name, level")
    .eq("role", "participant")
    .eq("active", true)
    .order("full_name");

  const enrolledIds = new Set((participants ?? []).map((p) => p.user_id));
  const candidates = (availableUsers ?? []).filter((u) => !enrolledIds.has(u.id));

  const flatParticipants = (participants ?? []).map((p) => {
    const raw = p.users as unknown;
    const u = Array.isArray(raw) ? raw[0] : (raw as { id: string; full_name: string; level: string | null; whatsapp: string | null; active: boolean });
    return u;
  }).filter(Boolean);

  return (
    <ProgramDetailClient
      program={program}
      days={days ?? []}
      participants={flatParticipants}
      candidates={candidates}
    />
  );
}
