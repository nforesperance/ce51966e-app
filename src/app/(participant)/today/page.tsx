import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSessionUser } from "@/lib/auth/session";
import { loadToday } from "@/lib/loadToday";
import BottomNav from "@/components/BottomNav";
import LockedBanner from "@/components/LockedBanner";
import CardPreview, { type CardConfig } from "@/components/CardPreview";
import ProgramSwitcher from "@/components/ProgramSwitcher";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const preferred = (await cookies()).get("elmoan_program")?.value ?? null;
  const data = await loadToday(user.id, preferred);

  if (!data) {
    return (
      <div className="pt-10 text-center">
        <p className="label mb-3">No active program</p>
        <p className="text-fg-muted">You are not enrolled in an active program today.</p>
      </div>
    );
  }

  const { program, day, prayerPoint, locked, lockedUntilIso, allTodayDone, availablePrograms } = data;
  const effectiveCardConfig: CardConfig = {
    ...(program.card_defaults as CardConfig),
    ...((prayerPoint?.card_config ?? {}) as CardConfig),
  };

  return (
    <div className="pt-3 pb-16">
      <ProgramSwitcher programs={availablePrograms} currentId={program.id} />
      <div className="flex items-center justify-between mb-3">
        <span className="label">{program.name}</span>
        <span className="pill">Day {day.day_number}</span>
      </div>

      {locked && lockedUntilIso && (
        <LockedBanner unlockIso={lockedUntilIso} timezone={program.timezone} />
      )}
      {!locked && allTodayDone && (
        <div className="card px-3 py-2 mb-3 text-[12px] text-[color:var(--ok)] border-[color:var(--ok)]/40">
          ✓ Today complete. Next day&apos;s content will appear when the admin publishes it.
        </div>
      )}

      {prayerPoint?.image_url ? (
        <div className={`mb-5 rounded-2xl overflow-hidden border border-[color:var(--border)] ${locked ? "opacity-80" : ""}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={prayerPoint.image_url} alt="" className="w-full h-auto" />
        </div>
      ) : prayerPoint && (prayerPoint.body_markdown || prayerPoint.title || prayerPoint.scriptures.length > 0) ? (
        <div className={`mb-5 ${locked ? "opacity-80" : ""}`}>
          <CardPreview
            config={effectiveCardConfig}
            groupName={program.name}
            level={user.level}
            dayNumber={day.day_number}
            title={prayerPoint.title}
            bodyHtml={prayerPoint.body_markdown}
            scriptures={prayerPoint.scriptures}
            width="100%"
          />
        </div>
      ) : null}

      <div className="text-center mt-6">
        <Link href="/tasks" className="btn-gold text-sm">
          {locked ? "See upcoming tasks" : "Go to today's tasks"}
        </Link>
      </div>

      <BottomNav active="today" programId={program.id} />
    </div>
  );
}
