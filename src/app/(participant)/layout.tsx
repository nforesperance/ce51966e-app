import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import TopBar from "@/components/TopBar";

export default async function ParticipantLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "admin") redirect("/admin");
  return (
    <div className="flex-1 flex flex-col">
      <TopBar name={user.full_name} level={user.level} />
      <main className="flex-1 w-full max-w-md mx-auto px-5 pb-24">{children}</main>
    </div>
  );
}
