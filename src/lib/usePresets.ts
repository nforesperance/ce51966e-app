"use client";

import { useCallback, useEffect, useState } from "react";

export type PresetKind = "card" | "task";
export type Preset<T = Record<string, unknown>> = {
  id: string;
  kind: PresetKind;
  name: string;
  config: T;
  updated_at: string;
};

function friendlyError(message: string) {
  return /presets/i.test(message) && /(does not exist|schema cache)/i.test(message)
    ? "Run migration 0009_presets.sql to enable presets"
    : message;
}

/** Shared, server-stored presets (see /api/admin/presets). */
export function usePresets<T extends Record<string, unknown>>(kind: PresetKind) {
  const [presets, setPresets] = useState<Preset<T>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/presets?kind=${kind}`, { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setError(friendlyError(j.error ?? "Failed to load presets")); return; }
      setError(null);
      setPresets(j.presets ?? []);
    } finally { setLoading(false); }
  }, [kind]);

  useEffect(() => { reload(); }, [reload]);

  const save = useCallback(async (name: string, config: T) => {
    const res = await fetch("/api/admin/presets", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, name, config }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(friendlyError(j.error ?? "Failed to save preset"));
    const saved = j.preset as Preset<T>;
    setPresets((ps) => [...ps.filter((p) => p.id !== saved.id), saved].sort((a, b) => a.name.localeCompare(b.name)));
    return saved;
  }, [kind]);

  const remove = useCallback(async (id: string) => {
    const res = await fetch(`/api/admin/presets/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(friendlyError(j.error ?? "Failed to delete preset"));
    }
    setPresets((ps) => ps.filter((p) => p.id !== id));
  }, []);

  return { presets, loading, error, save, remove, reload };
}
