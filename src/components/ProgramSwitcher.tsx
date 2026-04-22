"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ProgramSwitcher({
  programs, currentId,
}: {
  programs: { id: string; name: string }[];
  currentId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (programs.length < 2) return null;

  async function change(id: string) {
    if (id === currentId) return;
    setBusy(true);
    try {
      await fetch("/api/preference/program", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ program_id: id }),
      });
      router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <div className="mb-3">
      <select
        disabled={busy}
        value={currentId}
        onChange={(e) => change(e.target.value)}
        className="input text-xs"
        aria-label="Switch program"
      >
        {programs.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
    </div>
  );
}
