"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

export default function AdminHeader({ name }: { name: string }) {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }
  return (
    <header className="border-b border-[color:var(--border)] px-6 py-4 flex items-center justify-between">
      <div className="text-sm text-fg-muted">Signed in as <span className="text-fg">{name}</span></div>
      <button onClick={logout} className="text-fg-muted hover:text-gold flex items-center gap-2 text-sm">
        <LogOut size={16} /> Log out
      </button>
    </header>
  );
}
