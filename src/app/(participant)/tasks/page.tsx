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
      <div className="pt-6 text-center">
        <p className="label mb-3">No active program</p>
        <p className="text-fg-muted">You are not enrolled in an active program today.</p>
      </div>
    );
  }

  const { program, day, tasks } = data;
  return (
    <div className="pt-3 pb-16">
      <div className="flex items-center justify-between mb-3">
        <span className="label">{program.name}</span>
        <span className="pill">Day {day.day_number}</span>
      </div>

      {tasks.length === 0 ? (
        <div className="card p-6 text-center text-fg-muted">No tasks for today.</div>
      ) : (
        <TasksSection tasks={tasks} />
      )}

      <div className="mt-4 text-center">
        <Link href="/today" className="text-xs text-fg-muted hover:text-gold">
          Read today&apos;s prayer point →
        </Link>
      </div>

      <BottomNav active="tasks" programId={program.id} />
    </div>
  );
}
