import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { todayInTz, zonedToUtc } from "@/lib/time";
import type { UITask } from "@/app/(participant)/tasks/TasksSection";

export type PreviewDay = {
  day_number: number;
  date: string;                  // YYYY-MM-DD in program tz
  startsAtIso: string;           // ISO of next-day 00:00 in program tz
  prayerPoint: {
    title: string | null;
    body_markdown: string | null;
    image_url: string | null;
    scriptures: { reference: string; text: string | null }[];
  } | null;
};

export type TodayData = {
  program: { id: string; name: string; timezone: string; next_day_preview_hours: number };
  day: { id: string; day_number: number; date: string };
  prayerPoint: {
    title: string | null; body_markdown: string | null; image_url: string | null;
    scriptures: { reference: string; text: string | null }[];
  } | null;
  tasks: UITask[];
  preview: PreviewDay | null;
} | null;

export async function loadToday(userId: string): Promise<TodayData> {
  const sb = supabaseAdmin();
  const { data: memberships } = await sb
    .from("program_participants")
    .select("program_id, programs(id, name, timezone, start_date, end_date, next_day_preview_hours)")
    .eq("user_id", userId);
  if (!memberships?.length) return null;

  for (const m of memberships) {
    const raw = (m as { programs: unknown }).programs;
    const p = Array.isArray(raw) ? raw[0] : raw as {
      id: string; name: string; timezone: string;
      start_date: string; end_date: string; next_day_preview_hours: number;
    };
    if (!p) continue;
    const today = todayInTz(p.timezone);
    if (today < p.start_date || today > p.end_date) continue;

    const { data: day } = await sb.from("program_days")
      .select("id, day_number, date").eq("program_id", p.id).eq("date", today).maybeSingle();
    if (!day) continue;

    const { data: pp } = await sb
      .from("prayer_points")
      .select("title, body_markdown, image_url, scriptures(reference, text, position)")
      .eq("program_day_id", day.id).maybeSingle();
    const scriptures = ((pp?.scriptures ?? []) as { reference: string; text: string | null; position: number }[])
      .sort((a, b) => a.position - b.position);

    const { data: tasks } = await sb.from("tasks")
      .select("id, type, title, duration_minutes, target_start_time, max_points, metadata, position")
      .eq("program_day_id", day.id).order("position");

    const { data: completions } = await sb.from("task_completions")
      .select("task_id, first_started_at, started_at, elapsed_seconds, completed_at, points_awarded")
      .eq("user_id", userId)
      .in("task_id", (tasks ?? []).map((t) => t.id).concat("00000000-0000-0000-0000-000000000000"));
    const compByTask = new Map(completions?.map((c) => [c.task_id, c]));

    const uiTasks: UITask[] = (tasks ?? []).map((t) => ({
      id: t.id, type: t.type, title: t.title,
      duration_minutes: t.duration_minutes,
      target_start_time: t.target_start_time,
      max_points: t.max_points,
      chapters: (t.metadata?.chapters as string[] | undefined) ?? [],
      completion: compByTask.get(t.id) ?? null,
    }));

    // Decide if next-day preview should be exposed.
    const preview = await maybeLoadPreview({
      sb, programId: p.id, programTimezone: p.timezone, previewHours: p.next_day_preview_hours,
      currentDayNumber: day.day_number, uiTasks,
    });

    return {
      program: { id: p.id, name: p.name, timezone: p.timezone, next_day_preview_hours: p.next_day_preview_hours },
      day,
      prayerPoint: pp ? {
        title: pp.title, body_markdown: pp.body_markdown, image_url: pp.image_url,
        scriptures: scriptures.map((s) => ({ reference: s.reference, text: s.text })),
      } : null,
      tasks: uiTasks,
      preview,
    };
  }
  return null;
}

async function maybeLoadPreview({
  sb, programId, programTimezone, previewHours, currentDayNumber, uiTasks,
}: {
  sb: ReturnType<typeof supabaseAdmin>;
  programId: string;
  programTimezone: string;
  previewHours: number;
  currentDayNumber: number;
  uiTasks: UITask[];
}): Promise<PreviewDay | null> {
  // Find the next day in the program, if any.
  const { data: nextDay } = await sb.from("program_days")
    .select("id, day_number, date")
    .eq("program_id", programId)
    .eq("day_number", currentDayNumber + 1)
    .maybeSingle();
  if (!nextDay) return null;

  // Eligibility: completed all today's tasks, OR within the admin-configured preview window.
  const allTasksDone = uiTasks.length > 0 && uiTasks.every((t) => !!t.completion?.completed_at);
  const nextStart = zonedToUtc(nextDay.date, "00:00", programTimezone);
  const hoursUntilNext = (nextStart.getTime() - Date.now()) / 3_600_000;
  const withinPreviewWindow = previewHours > 0 && hoursUntilNext <= previewHours && hoursUntilNext > 0;

  if (!allTasksDone && !withinPreviewWindow) return null;

  const { data: pp } = await sb
    .from("prayer_points")
    .select("title, body_markdown, image_url, scriptures(reference, text, position)")
    .eq("program_day_id", nextDay.id).maybeSingle();
  const scriptures = ((pp?.scriptures ?? []) as { reference: string; text: string | null; position: number }[])
    .sort((a, b) => a.position - b.position);

  return {
    day_number: nextDay.day_number,
    date: nextDay.date,
    startsAtIso: nextStart.toISOString(),
    prayerPoint: pp ? {
      title: pp.title,
      body_markdown: pp.body_markdown,
      image_url: pp.image_url,
      scriptures: scriptures.map((s) => ({ reference: s.reference, text: s.text })),
    } : null,
  };
}
