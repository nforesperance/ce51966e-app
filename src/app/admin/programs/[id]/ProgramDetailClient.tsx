"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2, UserPlus, X, Search, Calendar, ChevronRight } from "lucide-react";

type Program = {
  id: string; name: string; start_date: string; end_date: string;
  timezone: string; next_day_preview_hours: number; day_unlock_offset_minutes: number;
};
type Day = { id: string; day_number: number; date: string };
type Participant = { id: string; full_name: string; level: string | null; whatsapp: string | null; active: boolean };
type Candidate = { id: string; full_name: string; level: string | null };

export default function ProgramDetailClient({
  program: initialProgram, days, participants: initialParticipants, candidates: initialCandidates,
}: {
  program: Program; days: Day[]; participants: Participant[]; candidates: Candidate[];
}) {
  const router = useRouter();
  const [program, setProgram] = useState(initialProgram);
  const [participants, setParticipants] = useState(initialParticipants);
  const [candidates, setCandidates] = useState(initialCandidates);
  const [addOpen, setAddOpen] = useState(false);
  const [savingPreview, setSavingPreview] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  async function savePreviewHours(h: number) {
    setSavingPreview(true);
    try {
      const res = await fetch(`/api/admin/programs/${program.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ next_day_preview_hours: h }),
      });
      const j = await res.json();
      if (!res.ok) { alert(j.error ?? "Failed"); return; }
      setProgram({ ...program, next_day_preview_hours: h });
    } finally { setSavingPreview(false); }
  }

  async function saveUnlockOffset(m: number) {
    const res = await fetch(`/api/admin/programs/${program.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day_unlock_offset_minutes: m }),
    });
    const j = await res.json();
    if (!res.ok) { alert(j.error ?? "Failed"); return; }
    setProgram({ ...program, day_unlock_offset_minutes: m });
  }

  async function removeParticipant(userId: string, name: string) {
    if (!confirm(`Remove ${name} from this program?`)) return;
    const res = await fetch(`/api/admin/programs/${program.id}/participants?user_id=${userId}`, { method: "DELETE" });
    if (!res.ok) { const j = await res.json().catch(() => ({})); alert(j.error ?? "Failed"); return; }
    const removed = participants.find((p) => p.id === userId);
    setParticipants((ps) => ps.filter((p) => p.id !== userId));
    if (removed) setCandidates((cs) => [{ id: removed.id, full_name: removed.full_name, level: removed.level }, ...cs]
      .sort((a, b) => a.full_name.localeCompare(b.full_name)));
  }

  async function deleteProgram() {
    if (!confirm(`Delete "${program.name}"? This removes all days, prayer points, tasks, and completions.`)) return;
    const res = await fetch(`/api/admin/programs/${program.id}`, { method: "DELETE" });
    if (!res.ok) { const j = await res.json().catch(() => ({})); alert(j.error ?? "Failed"); return; }
    router.replace("/admin/programs");
    router.refresh();
  }

  async function addParticipants(userIds: string[]) {
    const res = await fetch(`/api/admin/programs/${program.id}/participants`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_ids: userIds }),
    });
    const j = await res.json();
    if (!res.ok) { alert(j.error ?? "Failed"); return; }
    const added = candidates.filter((c) => userIds.includes(c.id));
    setParticipants((ps) => [...ps, ...added.map((a) => ({ ...a, whatsapp: null, active: true }))]
      .sort((a, b) => a.full_name.localeCompare(b.full_name)));
    setCandidates((cs) => cs.filter((c) => !userIds.includes(c.id)));
    setAddOpen(false);
  }

  return (
    <div>
      <div className="mb-1"><Link href="/admin/programs" className="text-sm text-fg-muted hover:text-gold">← All programs</Link></div>
      <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold">{program.name}</h1>
          <p className="text-fg-muted text-sm mt-1">
            {program.start_date} → {program.end_date} · {program.timezone} · {days.length} days
          </p>
        </div>
        <button onClick={deleteProgram} className="btn-ghost text-sm text-[color:var(--danger)] hover:border-[color:var(--danger)]">
          Delete program
        </button>
      </div>

      <section className="card p-4 mb-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="label w-40">Next-day preview</label>
          <input
            type="number" min={0} max={24}
            className="input w-24 text-center"
            defaultValue={program.next_day_preview_hours}
            onBlur={(e) => {
              const v = Math.max(0, Math.min(24, parseInt(e.target.value, 10) || 0));
              if (v !== program.next_day_preview_hours) savePreviewHours(v);
            }}
          />
          <span className="text-xs text-fg-muted flex-1">
            hours before unlock — participants see tomorrow&apos;s prayer point (tasks stay locked). {savingPreview && "Saving…"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="label w-40">Day unlocks</label>
          <input
            type="number" min={0} max={60}
            className="input w-24 text-center"
            defaultValue={program.day_unlock_offset_minutes}
            onBlur={(e) => {
              const v = Math.max(0, Math.min(60, parseInt(e.target.value, 10) || 0));
              if (v !== program.day_unlock_offset_minutes) saveUnlockOffset(v);
            }}
          />
          <span className="text-xs text-fg-muted flex-1">
            minutes before local midnight — matches the prayer start-window tolerance so participants can tap <em>Start</em> just before 00:00 and still score full marks.
          </span>
        </div>
      </section>

      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Days</h2>
          <div className="text-xs text-fg-muted flex items-center gap-1"><Calendar size={13} /> Click a day to edit its prayer point and tasks</div>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
          {days.map((d) => {
            const state = d.date < today ? "past" : d.date === today ? "today" : "future";
            return (
              <Link
                key={d.id} href={`/admin/programs/${program.id}/days/${d.id}`}
                className={`card p-3 text-center transition-colors hover:border-[color:var(--gold)] ${
                  state === "today" ? "border-[color:var(--gold)]" : ""
                }`}
                title={d.date}
              >
                <div className="text-[10px] tracking-[0.2em] uppercase text-fg-muted">Day</div>
                <div className="text-xl font-semibold text-gold-soft leading-none">{d.day_number}</div>
                <div className="text-[10px] text-fg-muted mt-1">{d.date.slice(5)}</div>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Participants ({participants.length})</h2>
          <button onClick={() => setAddOpen(true)} className="btn-gold text-sm flex items-center gap-1">
            <UserPlus size={15} /> Add
          </button>
        </div>
        {participants.length === 0 ? (
          <div className="card p-5 text-fg-muted">No participants yet.</div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-left text-fg-muted border-b border-[color:var(--border)]">
                <tr><th className="py-3 px-4">Name</th><th className="py-3 px-4">Level</th><th className="py-3 px-4 w-20"></th></tr>
              </thead>
              <tbody>
                {participants.map((p) => (
                  <tr key={p.id} className="border-b border-[color:var(--border)] last:border-0">
                    <td className="py-3 px-4">
                      <Link href={`/admin/programs/${program.id}/participants/${p.id}`}
                        className="hover:text-gold inline-flex items-center gap-1">
                        {p.full_name}<ChevronRight size={14} className="text-fg-muted" />
                      </Link>
                      {!p.active && <span className="ml-2 text-xs text-[color:var(--danger)]">inactive</span>}
                    </td>
                    <td className="py-3 px-4 text-fg-muted">{p.level ?? "—"}</td>
                    <td className="py-3 px-4 text-right">
                      <button onClick={() => removeParticipant(p.id, p.full_name)} className="text-fg-muted hover:text-[color:var(--danger)]" title="Remove">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {addOpen && <AddDialog candidates={candidates} onClose={() => setAddOpen(false)} onAdd={addParticipants} />}
    </div>
  );
}

function AddDialog({ candidates, onClose, onAdd }: {
  candidates: Candidate[]; onClose: () => void; onAdd: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) =>
      c.full_name.toLowerCase().includes(q) || (c.level ?? "").toLowerCase().includes(q)
    );
  }, [candidates, query]);

  function toggle(id: string) {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="card w-full max-w-lg p-6 flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Add participants</h2>
          <button onClick={onClose} className="text-fg-muted hover:text-fg"><X size={18} /></button>
        </div>
        <div className="flex items-center gap-2 text-sm text-fg-muted border border-[color:var(--border)] rounded-lg px-3 py-2 mb-3">
          <Search size={14} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…"
            className="bg-transparent outline-none flex-1 text-fg placeholder:text-fg-muted" />
        </div>
        <div className="flex-1 overflow-y-auto border border-[color:var(--border)] rounded-lg">
          {filtered.length === 0 ? (
            <p className="p-4 text-sm text-fg-muted">No available users.</p>
          ) : filtered.map((c) => (
            <label key={c.id} className="flex items-center justify-between gap-2 px-4 py-2 border-b border-[color:var(--border)] last:border-0 cursor-pointer hover:bg-white/5">
              <div className="flex items-center gap-3">
                <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                <span>{c.full_name}</span>
              </div>
              <span className="text-xs text-fg-muted">{c.level ?? ""}</span>
            </label>
          ))}
        </div>
        <div className="flex items-center justify-between pt-4">
          <p className="text-sm text-fg-muted">{selected.size} selected</p>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-ghost text-sm">Cancel</button>
            <button disabled={selected.size === 0}
              onClick={() => onAdd(Array.from(selected))} className="btn-gold text-sm">
              Add {selected.size > 0 ? selected.size : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
