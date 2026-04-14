import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { loadToday } from "@/lib/loadToday";
import TasksSection from "./TasksSection";
import BottomNav from "@/components/BottomNav";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
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

  const { program, day, tasks } = data;
  return (
    <div className="pt-6 pb-20">
      <div className="text-center mb-6">
        <div className="label">{program.name}</div>
        <div className="mt-3 flex items-baseline justify-center gap-3">
          <span className="text-xs tracking-[0.3em] text-fg-muted">DAY</span>
          <span className="text-4xl font-semibold text-gold-soft leading-none">{day.day_number}</span>
        </div>
      </div>
      <div className="rule mb-6" />

      {tasks.length === 0 ? (
        <div className="card p-6 text-center text-fg-muted">No tasks for today.</div>
      ) : (
        <TasksSection tasks={tasks} />
      )}

      <div className="mt-8 text-center">
        <Link href="/today" className="text-sm text-fg-muted hover:text-gold">Read today&apos;s prayer point →</Link>
      </div>

      <BottomNav active="tasks" programId={program.id} />
    </div>
  );
}
