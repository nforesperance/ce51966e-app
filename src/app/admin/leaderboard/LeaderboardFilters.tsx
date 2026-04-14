"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

export default function LeaderboardFilters({
  programs, levels, current,
}: {
  programs: { id: string; name: string }[];
  levels: string[];
  current: { program: string; level: string; q: string };
}) {
  const router = useRouter();
  const sp = useSearchParams();

  function push(next: Partial<{ program: string; level: string; q: string }>) {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(next)) {
      if (!v || v === "all") params.delete(k);
      else params.set(k, v);
    }
    router.push(`/admin/leaderboard?${params.toString()}`);
  }

  const qDebounce = useMemo(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    return (v: string) => {
      if (t) clearTimeout(t);
      t = setTimeout(() => push({ q: v }), 250);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="card p-3 mb-4 flex flex-wrap items-center gap-3">
      <label className="text-xs text-fg-muted">Program</label>
      <select
        className="input max-w-[240px]"
        value={current.program}
        onChange={(e) => push({ program: e.target.value })}
      >
        <option value="all">All programs</option>
        {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>

      <label className="text-xs text-fg-muted">Level</label>
      <select
        className="input max-w-[160px]"
        value={current.level}
        onChange={(e) => push({ level: e.target.value })}
      >
        <option value="all">All levels</option>
        {levels.map((l) => <option key={l} value={l}>{l}</option>)}
      </select>

      <input
        defaultValue={current.q}
        placeholder="Search name…"
        className="input flex-1 min-w-[160px]"
        onChange={(e) => qDebounce(e.target.value)}
      />
    </div>
  );
}
