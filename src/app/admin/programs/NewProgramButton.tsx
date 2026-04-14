"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";

const TIMEZONES = [
  "UTC", "Africa/Douala", "Africa/Lagos", "Africa/Nairobi", "Africa/Johannesburg",
  "Europe/London", "Europe/Paris", "America/New_York", "America/Los_Angeles", "Asia/Dubai",
];

export default function NewProgramButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ name: "", start_date: "", end_date: "", timezone: "UTC" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/admin/programs", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f),
      });
      const j = await res.json();
      if (!res.ok) { alert(j.error ?? "Failed"); return; }
      setOpen(false);
      setF({ name: "", start_date: "", end_date: "", timezone: "UTC" });
      router.refresh();
      router.push(`/admin/programs/${j.program.id}`);
    } finally { setBusy(false); }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-gold flex items-center gap-2 text-sm">
        <Plus size={15} /> New program
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4" onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="card w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">New program</h2>
              <button onClick={() => setOpen(false)} className="text-fg-muted hover:text-fg"><X size={18} /></button>
            </div>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="label block mb-1">Name</label>
                <input required maxLength={120} className="input"
                  placeholder="21-day Prayer Training"
                  value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label block mb-1">Start date</label>
                  <input required type="date" className="input"
                    value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} />
                </div>
                <div>
                  <label className="label block mb-1">End date</label>
                  <input required type="date" className="input"
                    value={f.end_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label block mb-1">Timezone</label>
                <select className="input" value={f.timezone}
                  onChange={(e) => setF({ ...f, timezone: e.target.value })}>
                  {TIMEZONES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <p className="text-xs text-fg-muted mt-1">
                  Used for daily cutoffs and prayer timing scoring.
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="btn-ghost text-sm">Cancel</button>
                <button disabled={busy} className="btn-gold text-sm">{busy ? "Creating…" : "Create"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
