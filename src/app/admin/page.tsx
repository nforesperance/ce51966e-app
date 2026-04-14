import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function AdminOverview() {
  const sb = supabaseAdmin();
  const [{ count: users }, { count: programs }] = await Promise.all([
    sb.from("users").select("*", { count: "exact", head: true }).eq("role", "participant"),
    sb.from("programs").select("*", { count: "exact", head: true }),
  ]);
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Overview</h1>
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-5">
          <p className="label">Participants</p>
          <p className="text-3xl font-semibold text-gold-soft mt-2">{users ?? 0}</p>
        </div>
        <div className="card p-5">
          <p className="label">Programs</p>
          <p className="text-3xl font-semibold text-gold-soft mt-2">{programs ?? 0}</p>
        </div>
      </div>
      <p className="text-fg-muted text-sm mt-8">
        Next steps: create users, then create a program and add participants.
      </p>
    </div>
  );
}
