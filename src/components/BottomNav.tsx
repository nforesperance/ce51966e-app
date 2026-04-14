import Link from "next/link";

export default function BottomNav({
  active, programId,
}: {
  active: "today" | "tasks" | "board";
  programId?: string;
}) {
  const cls = (k: string) => k === active ? "text-gold" : "text-fg-muted hover:text-gold";
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[color:var(--bg-2)]/90 backdrop-blur border-t border-[color:var(--border)]">
      <div className="max-w-md mx-auto flex items-center justify-around py-3 text-xs uppercase tracking-[0.2em]">
        <Link href="/today" className={cls("today")}>Today</Link>
        <Link href="/tasks" className={cls("tasks")}>Tasks</Link>
        <Link href={programId ? `/leaderboard/${programId}` : "/today"} className={cls("board")}>Board</Link>
      </div>
    </div>
  );
}
