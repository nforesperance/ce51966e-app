import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { zonedToUtc, effectiveProgramDate } from "@/lib/time";
import type { UITask } from "@/app/(participant)/tasks/TasksSection";

type Program = {
  id: string; name: string; timezone: string;
  start_date: string; end_date: string;
  next_day_preview_hours: number; day_unlock_offset_minutes: number;
  card_defaults: Record<string, unknown>;
};

export type TodayData = {
  program: {
    id: string; name: string; timezone: string;
    next_day_preview_hours: number; day_unlock_offset_minutes: number;
    card_defaults: Record<string, unknown>;
  };
  day: { id: string; day_number: number; date: string };
  prayerPoint: {
    title: string | null; body_markdown: string | null; image_url: string | null;
    card_config: Record<string, unknown>;
    scriptures: { reference: string; text: string | null }[];
  } | null;
  tasks: UITask[];
  locked: boolean;
  lockedUntilIso: string | null;
  allTodayDone: boolean;
} | null;

export async function loadToday(userId: string): Promise<TodayData> {
  const sb = supabaseAdmin();
  const { data: memberships } = await sb
    .from("program_participants")
    .select("program_id, programs(id, name, timezone, start_date, end_date, next_day_preview_hours, day_unlock_offset_minutes, card_defaults)")
    .eq("user_id", userId);
  if (!memberships?.length) return null;

  const programs: Program[] = [];
  for (const m of memberships) {
    const raw = (m as { programs: unknown }).programs;
    const p = Array.isArray(raw) ? raw[0] : raw as Program;
    if (p) programs.push(p);
  }

  // Evaluate every program in parallel, then prefer:
  //   1. active (non-locked, has today content) — user actually has work to do
  //   2. locked (preview mode)
  //   3. no-content — today in range but no tasks or prayer point
  const results = await Promise.all(programs.map((p) => loadForProgram(p, userId)));
  const nonNull = results.filter((r): r is NonNullable<TodayData> => r !== null);
  if (nonNull.length === 0) return null;

  const active = nonNull.find((r) => !r.locked && r.tasks.length > 0);
  if (active) return active;
  const lockedOne = nonNull.find((r) => r.locked);
  if (lockedOne) return lockedOne;
  return nonNull[0];
}

async function loadForProgram(p: Program, userId: string): Promise<TodayData> {
  const sb = supabaseAdmin();
  const today = effectiveProgramDate(p.timezone, p.day_unlock_offset_minutes ?? 0);
  if (today < p.start_date || today > p.end_date) return null;

  const { data: currentDay } = await sb.from("program_days")
    .select("id, day_number, date").eq("program_id", p.id).eq("date", today).maybeSingle();
  if (!currentDay) return null;

  const { data: currentTasks } = await sb.from("tasks")
    .select("id").eq("program_day_id", currentDay.id);
  const taskIds = (currentTasks ?? []).map((t) => t.id);
  const { data: completions } = await sb.from("task_completions")
    .select("task_id, completed_at")
    .eq("user_id", userId)
    .in("task_id", taskIds.length ? taskIds : ["00000000-0000-0000-0000-000000000000"]);
  const doneCount = (completions ?? []).filter((c) => !!c.completed_at).length;
  const allTodayDone = taskIds.length > 0 && doneCount >= taskIds.length;

  let useNext = false;
  let nextDay: { id: string; day_number: number; date: string } | null = null;
  let lockedUntilIso: string | null = null;

  if (allTodayDone || p.next_day_preview_hours > 0) {
    const { data: upcoming } = await sb.from("program_days")
      .select("id, day_number, date")
      .eq("program_id", p.id)
      .gt("date", currentDay.date)
      .order("day_number", { ascending: true })
      .limit(10);

    for (const nd of upcoming ?? []) {
      const rawStart = zonedToUtc(nd.date, "00:00", p.timezone);
      const effectiveStart = new Date(rawStart.getTime() - (p.day_unlock_offset_minutes ?? 0) * 60_000);
      const hoursUntilNext = (effectiveStart.getTime() - Date.now()) / 3_600_000;
      const withinWindow = p.next_day_preview_hours > 0
        && hoursUntilNext > 0
        && hoursUntilNext <= p.next_day_preview_hours;
      if (!(allTodayDone || withinWindow)) break;

      const [{ data: ppRow }, { data: taskRow }] = await Promise.all([
        sb.from("prayer_points").select("id").eq("program_day_id", nd.id).maybeSingle(),
        sb.from("tasks").select("id").eq("program_day_id", nd.id).limit(1).maybeSingle(),
      ]);
      if (ppRow || taskRow) {
        useNext = true;
        nextDay = nd;
        lockedUntilIso = effectiveStart.toISOString();
        break;
      }
    }
  }

  const effectiveDay = useNext && nextDay ? nextDay : currentDay;

  let { data: pp } = await sb
    .from("prayer_points")
    .select("title, body_markdown, image_url, card_config, scriptures(reference, text, position)")
    .eq("program_day_id", effectiveDay.id).maybeSingle();
  if (!pp && useNext) {
    const r = await sb
      .from("prayer_points")
      .select("title, body_markdown, image_url, card_config, scriptures(reference, text, position)")
      .eq("program_day_id", currentDay.id).maybeSingle();
    pp = r.data;
  }
  const scriptures = ((pp?.scriptures ?? []) as { reference: string; text: string | null; position: number }[])
    .sort((a, b) => a.position - b.position);

  const { data: tasks } = await sb.from("tasks")
    .select("id, type, title, duration_minutes, target_start_time, max_points, metadata, translation, position")
    .eq("program_day_id", effectiveDay.id).order("position");

  const compByTask = new Map(
    useNext ? [] : (completions ?? []).map((c) => [c.task_id, c as unknown])
  );
  if (!useNext && taskIds.length) {
    const { data: full } = await sb.from("task_completions")
      .select("task_id, first_started_at, started_at, elapsed_seconds, completed_at, points_awarded, chapter_states")
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
      chapter_states?: Record<string, unknown>;
    } | undefined;
    return {
      id: t.id, type: t.type, title: t.title,
      duration_minutes: t.duration_minutes,
      target_start_time: t.target_start_time,
      max_points: t.max_points,
      chapters: (t.metadata?.chapters as string[] | undefined) ?? [],
      translation: ((t as unknown as { translation?: string }).translation ?? "kjv") as "kjv" | "web",
      chapter_states: useNext ? {} : ((c?.chapter_states ?? {}) as Record<string, { read_at?: string; reflection?: string | null }>),
      completion: useNext ? null : (c ?? null),
    };
  });

  return {
    program: {
      id: p.id, name: p.name, timezone: p.timezone,
      next_day_preview_hours: p.next_day_preview_hours,
      day_unlock_offset_minutes: p.day_unlock_offset_minutes ?? 0,
      card_defaults: (p.card_defaults ?? {}) as Record<string, unknown>,
    },
    day: { id: effectiveDay.id, day_number: effectiveDay.day_number, date: effectiveDay.date },
    prayerPoint: pp ? {
      title: pp.title, body_markdown: pp.body_markdown, image_url: pp.image_url,
      card_config: (pp.card_config ?? {}) as Record<string, unknown>,
      scriptures: scriptures.map((s) => ({ reference: s.reference, text: s.text })),
    } : null,
    tasks: uiTasks,
    locked: useNext,
    lockedUntilIso,
    allTodayDone: allTodayDone && !useNext,
  };
}
