import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { loadToday } from "@/lib/loadToday";
import BottomNav from "@/components/BottomNav";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const data = await loadToday(user.id);

  if (!data) {
    return (
      <div className="pt-10 text-center">
        <p className="label mb-3">No active program</p>
        <p className="text-fg-muted">You are not enrolled in an active program today.</p>
      </div>
    );
  }

  const { program, day, prayerPoint } = data;

  return (
    <div className="pt-3 pb-16">
      <div className="flex items-center justify-between mb-3">
        <span className="label">{program.name}</span>
        <span className="pill">Day {day.day_number}</span>
      </div>

      {prayerPoint?.image_url && (
        <div className="mb-6 rounded-2xl overflow-hidden border border-[color:var(--border)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={prayerPoint.image_url} alt="" className="w-full h-auto" />
        </div>
      )}

      {prayerPoint && (prayerPoint.body_markdown || prayerPoint.title) && (
        <section className="mb-6">
          <p className="label mb-2">Prayer Point</p>
          {prayerPoint.title && (
            <h2 className="text-xl text-gold-soft font-semibold mb-3">{prayerPoint.title}</h2>
          )}
          {prayerPoint.body_markdown && (
            <div className="prose-prayer text-[15px] leading-relaxed text-fg"
              dangerouslySetInnerHTML={{ __html: prayerPoint.body_markdown }} />
          )}
        </section>
      )}

      {prayerPoint && prayerPoint.scriptures.length > 0 && (
        <section className="mb-6">
          <p className="label mb-2">Scripture</p>
          {prayerPoint.scriptures.map((s, i) => (
            <div key={i} className="mb-3">
              {s.text && <p className="italic text-fg/90">&ldquo;{s.text}&rdquo;</p>}
              <p className="text-gold mt-1 text-sm font-semibold">{s.reference}</p>
            </div>
          ))}
        </section>
      )}

      <div className="text-center mt-6">
        <Link href="/tasks" className="btn-gold text-sm">Go to today&apos;s tasks</Link>
      </div>

      <BottomNav active="today" programId={program.id} />
    </div>
  );
}
