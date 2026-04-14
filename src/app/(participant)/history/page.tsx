import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import BottomNav from "@/components/BottomNav";
import { getSessionUser } from "@/lib/auth/session";
import { todayInTz } from "@/lib/time";

export const dynamic = "force-dynamic";

type Program = { id: string; name: string; timezone: string; start_date: string; end_date: string };

export default async function HistoryPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const sb = supabaseAdmin();

  const { data: memberships } = await sb.from("program_participants")
    .select("programs(id, name, timezone, start_date, end_date)")
    .eq("user_id", user.id);
  const programs: Program[] = (memberships ?? []).flatMap((m) => {
    const r = (m as { programs: unknown }).programs;
    const p = Array.isArray(r) ? r[0] : r as Program;
    return p ? [p] : [];
  });

  const now = new Date();
  const sections = await Promise.all(programs.map(async (p) => {
    const today = todayInTz(p.timezone, now);
    const { data: days } = await sb.from("program_days")
      .select("id, day_number, date")
      .eq("program_id", p.id)
      .lt("date", today)
      .order("day_number", { ascending: false });
    return { program: p, days: days ?? [] };
  }));

  return (
    <div className="pt-6 pb-28">
      <h1 className="text-2xl font-semibold mb-1">History</h1>
      <p className="text-fg-muted text-sm mb-6">Past days — read-only.</p>

      {sections.length === 0 && <p className="text-fg-muted">No programs.</p>}

      {sections.map(({ program, days }) => (
        <section key={program.id} className="mb-8">
          <h2 className="text-sm label mb-3">{program.name}</h2>
          {days.length === 0 ? (
            <p className="text-sm text-fg-muted">No past days yet.</p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {days.map((d) => (
                <Link key={d.id} href={`/history/${d.id}`}
                  className="card py-3 text-center hover:border-[color:var(--gold)]">
                  <div className="text-[10px] tracking-[0.2em] uppercase text-fg-muted">Day</div>
                  <div className="text-lg font-semibold text-gold-soft">{d.day_number}</div>
                  <div className="text-[10px] text-fg-muted">{d.date.slice(5)}</div>
                </Link>
              ))}
            </div>
          )}
        </section>
      ))}

      <BottomNav active="today" />

    </div>
  );
}
