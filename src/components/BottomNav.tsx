"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function haptic() {
  // Android / Chrome support navigator.vibrate. iOS Safari silently ignores it,
  // but the CSS :active state below still gives visible feedback.
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try { navigator.vibrate(8); } catch {}
  }
}

export default function BottomNav({
  active, programId,
}: {
  active: "today" | "tasks" | "board";
  programId?: string;
}) {
  const pathname = usePathname();
  const linkCls = (key: string, href: string) => {
    const isActive = key === active || pathname === href;
    return [
      "flex-1 py-3 text-center transition-all duration-75",
      "active:scale-95 active:opacity-70",                    // press feedback
      isActive ? "text-gold" : "text-fg-muted hover:text-gold",
    ].join(" ");
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[color:var(--bg)]/95 backdrop-blur border-t border-[color:var(--border)]">
      <div className="max-w-md mx-auto flex text-xs uppercase tracking-[0.2em]">
        <Link href="/today" onClick={haptic} prefetch className={linkCls("today", "/today")}>Today</Link>
        <Link href="/tasks" onClick={haptic} prefetch className={linkCls("tasks", "/tasks")}>Tasks</Link>
        <Link
          href={programId ? `/leaderboard/${programId}` : "/today"}
          onClick={haptic}
          prefetch
          className={linkCls("board", programId ? `/leaderboard/${programId}` : "/today")}
        >
          Board
        </Link>
      </div>
    </div>
  );
}
