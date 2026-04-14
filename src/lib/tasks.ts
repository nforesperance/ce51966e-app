import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { todayInTz } from "@/lib/time";

// Returns context if the task is actionable for this user today, else null.
// Guards: participant enrolled, task's day equals today in program's timezone.
export async function loadActionableTaskForUser(taskId: string, userId: string) {
  const sb = supabaseAdmin();
  const { data: task } = await sb.from("tasks")
    .select("id, type, title, duration_minutes, target_start_time, full_marks_window_minutes, zero_marks_window_minutes, max_points, metadata, program_day_id")
    .eq("id", taskId).maybeSingle();
  if (!task) return null;

  const { data: day } = await sb.from("program_days")
    .select("id, date, program_id, programs(id, timezone, start_date, end_date)")
    .eq("id", task.program_day_id).maybeSingle();
  if (!day) return null;
  const programRaw = (day as { programs: unknown }).programs;
  const program = Array.isArray(programRaw) ? programRaw[0] : programRaw as { id: string; timezone: string; start_date: string; end_date: string };
  if (!program) return null;

  const { data: membership } = await sb.from("program_participants")
    .select("user_id").eq("program_id", program.id).eq("user_id", userId).maybeSingle();
  if (!membership) return null;

  const today = todayInTz(program.timezone);
  if (day.date !== today) return null;

  return { task, day, program };
}
