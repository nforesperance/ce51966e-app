import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth/session";
import { Users, CalendarDays, LayoutDashboard, Trophy } from "lucide-react";
import AdminHeader from "@/components/AdminHeader";

const nav = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/programs", label: "Programs", icon: CalendarDays },
  { href: "/admin/leaderboard", label: "Leaderboard", icon: Trophy },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/today");

  return (
    <div className="flex-1 flex flex-col md:flex-row">
      <aside className="md:w-60 md:border-r md:border-[color:var(--border)] md:min-h-screen">
        <div className="px-6 py-6">
          <div className="pill">ELMOAN · ADMIN</div>
        </div>
        <nav className="px-3 flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-3 md:pb-0">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-fg-muted hover:text-gold hover:bg-white/5 whitespace-nowrap"
            >
              <n.icon size={16} /> {n.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex-1 flex flex-col">
        <AdminHeader name={user.full_name} />
        <main className="flex-1 px-6 py-6 max-w-5xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
