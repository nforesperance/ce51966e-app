"use client";

import Link from "next/link";
import { LogOut, History } from "lucide-react";
import { useRouter } from "next/navigation";

export default function TopBar({ name, level }: { name: string; level: string | null }) {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }
  return (
    <header className="w-full">
      <div className="max-w-md mx-auto px-5 pt-3 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-gold/20 border border-gold grid place-items-center">
            <span className="text-gold text-xs font-bold">
              {name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
            </span>
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">{name}</div>
            {level && <div className="text-[11px] text-fg-muted">LEVEL {level.toUpperCase()}</div>}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/history" className="text-fg-muted hover:text-gold" aria-label="History" title="History">
            <History size={18} />
          </Link>
          <button onClick={logout} className="text-fg-muted hover:text-gold" aria-label="Log out">
            <LogOut size={18} />
          </button>
        </div>
      </div>
      <div className="max-w-md mx-auto px-5"><div className="rule" /></div>
    </header>
  );
}
