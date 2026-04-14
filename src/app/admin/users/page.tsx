import { supabaseAdmin } from "@/lib/supabase/admin";
import UsersClient from "./UsersClient";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const { data: users } = await supabaseAdmin()
    .from("users")
    .select("id, full_name, phone, whatsapp, level, active, login_key_hint, created_at, last_login_at, role")
    .eq("role", "participant")
    .order("created_at", { ascending: false });

  return <UsersClient initialUsers={users ?? []} />;
}
