import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import NewProgramButton from "./NewProgramButton";

export const dynamic = "force-dynamic";

export default async function ProgramsPage() {
  const sb = supabaseAdmin();
  const { data: programs } = await sb
    .from("programs")
    .select("id, name, start_date, end_date, timezone, created_at")
    .order("start_date", { ascending: false });

  const enriched = await Promise.all(
    (programs ?? []).map(async (p) => {
      const { count } = await sb
        .from("program_participants")
        .select("*", { count: "exact", head: true })
        .eq("program_id", p.id);
      return { ...p, participant_count: count ?? 0 };
    })
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-semibold">Programs</h1>
        <NewProgramButton />
      </div>
      {enriched.length === 0 ? (
        <div className="card p-6 text-fg-muted">No programs yet. Create one to start.</div>
      ) : (
        <div className="grid gap-3">
          {enriched.map((p) => (
            <Link
              key={p.id} href={`/admin/programs/${p.id}`}
              className="card p-5 hover:border-[color:var(--gold)] transition-colors block"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h2 className="text-lg font-semibold">{p.name}</h2>
                  <p className="text-sm text-fg-muted mt-1">
                    {p.start_date} → {p.end_date} · {p.timezone}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl text-gold-soft font-semibold">{p.participant_count}</p>
                  <p className="text-[11px] tracking-[0.2em] uppercase text-fg-muted">participants</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
