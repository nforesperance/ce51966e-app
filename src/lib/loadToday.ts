import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { zonedToUtc, effectiveProgramDate } from "@/lib/time";
import type { UITask } from "@/app/(participant)/tasks/TasksSection";

export type TodayData = {
  program: { id: string; name: string; timezone: string; next_day_preview_hours: number; day_unlock_offset_minutes: number };
  day: { id: string; day_number: number; date: string };
  prayerPoint: {
    title: string | null; body_markdown: string | null; image_url: string | null;
    scriptures: { reference: string; text: string | null }[];
  } | null;
  tasks: UITask[];
  locked: boolean;
  lockedUntilIso: string | null;
  allTodayDone: boolean;       // today's tasks all completed (useful when we stayed on today)
} | null;

export async function loadToday(userId: string): Promise<TodayData> {
  const sb = supabaseAdmin();
  const { data: memberships } = await sb
    .from("program_participants")
    .select("program_id, programs(id, name, timezone, start_date, end_date, next_day_preview_hours, day_unlock_offset_minutes)")
    .eq("user_id", userId);
  if (!memberships?.length) return null;

  for (const m of memberships) {
    const raw = (m as { programs: unknown }).programs;
    const p = Array.isArray(raw) ? raw[0] : raw as {
      id: string; name: string; timezone: string;
      start_date: string; end_date: string;
      next_day_preview_hours: number; day_unlock_offset_minutes: number;
    };
    if (!p) continue;

    const today = effectiveProgramDate(p.timezone, p.day_unlock_offset_minutes ?? 0);
    if (today < p.start_date || today > p.end_date) continue;

    const { data: currentDay } = await sb.from("program_days")
      .select("id, day_number, date").eq("program_id", p.id).eq("date", today).maybeSingle();
    if (!currentDay) continue;

    // Load today's tasks + completions to check if the user has finished everything.
    const { data: currentTasks } = await sb.from("tasks")
      .select("id").eq("program_day_id", currentDay.id);
    const taskIds = (currentTasks ?? []).map((t) => t.id);
    const { data: completions } = await sb.from("task_completions")
      .select("task_id, completed_at")
      .eq("user_id", userId)
      .in("task_id", taskIds.length ? taskIds : ["00000000-0000-0000-0000-000000000000"]);
    const doneCount = (completions ?? []).filter((c) => !!c.completed_at).length;
    const allTodayDone = taskIds.length > 0 && doneCount >= taskIds.length;

    // Preview eligibility.
    let useNext = false;
    let nextDay: { id: string; day_number: number; date: string } | null = null;
    let lockedUntilIso: string | null = null;

    if (allTodayDone || p.next_day_preview_hours > 0) {
      const { data: nd } = await sb.from("program_days")
        .select("id, day_number, date")
        .eq("program_id", p.id)
        .eq("day_number", currentDay.day_number + 1)
        .maybeSingle();
      if (nd) {
        const rawStart = zonedToUtc(nd.date, "00:00", p.timezone);
        const effectiveStart = new Date(rawStart.getTime() - (p.day_unlock_offset_minutes ?? 0) * 60_000);
        const hoursUntilNext = (effectiveStart.getTime() - Date.now()) / 3_600_000;
        const withinWindow = p.next_day_preview_hours > 0
          && hoursUntilNext > 0
          && hoursUntilNext <= p.next_day_preview_hours;

        // Only swap if there's content to show for the next day. If the admin
        // hasn't published tomorrow's prayer point or any task yet, keep
        // showing today so the user doesn't land on a blank screen.
        if (allTodayDone || withinWindow) {
          const [{ count: ndPpCount }, { count: ndTaskCount }] = await Promise.all([
            sb.from("prayer_points").select("*", { count: "exact", head: true }).eq("program_day_id", nd.id),
            sb.from("tasks").select("*", { count: "exact", head: true }).eq("program_day_id", nd.id),
          ]);
          const hasContent = (ndPpCount ?? 0) > 0 || (ndTaskCount ?? 0) > 0;
          if (hasContent) {
            useNext = true;
            nextDay = nd;
            lockedUntilIso = effectiveStart.toISOString();
          }
        }
      }
    }

    const effectiveDay = useNext && nextDay ? nextDay : currentDay;

    // Load prayer point + tasks for the effective day.
    const { data: pp } = await sb
      .from("prayer_points")
      .select("title, body_markdown, image_url, scriptures(reference, text, position)")
      .eq("program_day_id", effectiveDay.id).maybeSingle();
    const scriptures = ((pp?.scriptures ?? []) as { reference: string; text: string | null; position: number }[])
      .sort((a, b) => a.position - b.position);

    const { data: tasks } = await sb.from("tasks")
      .select("id, type, title, duration_minutes, target_start_time, max_points, metadata, position")
      .eq("program_day_id", effectiveDay.id).order("position");

    // Completions only apply to the actual today (not to a locked preview).
    const compByTask = new Map(
      useNext ? [] : (completions ?? []).map((c) => [c.task_id, c as unknown])
    );
    // If we're showing today, we need the full completion fields, not just completed_at.
    if (!useNext && taskIds.length) {
      const { data: full } = await sb.from("task_completions")
        .select("task_id, first_started_at, started_at, elapsed_seconds, completed_at, points_awarded")
        .eq("user_id", userId)
        .in("task_id", taskIds);
      compByTask.clear();
      for (const c of full ?? []) compByTask.set(c.task_id, c);
    }

    const uiTasks: UITask[] = (tasks ?? []).map((t) => {
      const c = compByTask.get(t.id) as {
        first_started_at: string | null;
        started_at: string | null;
        elapsed_seconds: number;
        completed_at: string | null;
        points_awarded: number;
      } | undefined;
      return {
        id: t.id, type: t.type, title: t.title,
        duration_minutes: t.duration_minutes,
        target_start_time: t.target_start_time,
        max_points: t.max_points,
        chapters: (t.metadata?.chapters as string[] | undefined) ?? [],
        completion: useNext ? null : (c ?? null),
      };
    });

    return {
      program: {
        id: p.id, name: p.name, timezone: p.timezone,
        next_day_preview_hours: p.next_day_preview_hours,
        day_unlock_offset_minutes: p.day_unlock_offset_minutes ?? 0,
      },
      day: { id: effectiveDay.id, day_number: effectiveDay.day_number, date: effectiveDay.date },
      prayerPoint: pp ? {
        title: pp.title, body_markdown: pp.body_markdown, image_url: pp.image_url,
        scriptures: scriptures.map((s) => ({ reference: s.reference, text: s.text })),
      } : null,
      tasks: uiTasks,
      locked: useNext,
      lockedUntilIso,
      allTodayDone: allTodayDone && !useNext,
    };
  }
  return null;
}
