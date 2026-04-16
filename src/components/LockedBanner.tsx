"use client";

import { useEffect, useState } from "react";
import { Lock } from "lucide-react";

function formatCountdown(ms: number) {
  if (ms <= 0) return "soon";
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  const s = Math.floor((ms % 60000) / 1000).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function LockedBanner({ unlockIso, timezone }: { unlockIso: string; timezone: string }) {
  const unlockTs = new Date(unlockIso).getTime();
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);
  const unlockLocal = new Date(unlockIso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const left = unlockTs - now;
  return (
    <div className="card px-3 py-2 flex items-center gap-2 mb-3 border-[color:var(--gold)]/50">
      <Lock size={14} className="text-gold" />
      <div className="flex-1 text-[12px]">
        <span className="text-gold font-semibold">Upcoming</span>
        <span className="text-fg-muted"> · unlocks in </span>
        <span className="text-gold tabular-nums">{formatCountdown(left)}</span>
        <span className="text-fg-muted"> ({unlockLocal} {timezone.split("/").pop()})</span>
      </div>
    </div>
  );
}
