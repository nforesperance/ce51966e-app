"use client";

import { useState } from "react";
import { Bookmark, BookmarkPlus, Check, ChevronDown, Trash2 } from "lucide-react";
import Popover from "@/components/ui/Popover";
import { usePresets, type Preset, type PresetKind } from "@/lib/usePresets";

/**
 * "Presets ▾" menu: apply a saved preset, save the current settings under a
 * name (same name overwrites), or delete one. Presets are shared by all admins.
 */
export default function PresetMenu<T extends Record<string, unknown>>({
  kind, current, onApply, describe, align = "left", label = "Presets",
}: {
  kind: PresetKind;
  current: T;
  onApply: (config: T, preset: Preset<T>) => void;
  describe?: (config: T) => string;
  align?: "left" | "right";
  label?: string;
}) {
  const { presets, loading, error, save, remove } = usePresets<T>(kind);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (presets.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())
      && !confirm(`Overwrite the preset “${trimmed}”?`)) return;
    setBusy(true);
    try {
      await save(trimmed, current);
      setName("");
      setFlash(`Saved “${trimmed}”`);
      setTimeout(() => setFlash(null), 2000);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  async function handleDelete(p: Preset<T>) {
    if (!confirm(`Delete the preset “${p.name}”?`)) return;
    try { await remove(p.id); } catch (e) { alert(e instanceof Error ? e.message : String(e)); }
  }

  return (
    <Popover
      align={align}
      className="w-80"
      trigger={(open, toggle) => (
        <button type="button" onClick={toggle} aria-expanded={open}
          className="btn-ghost flex items-center gap-1.5 px-3 py-1.5 text-sm">
          <Bookmark size={14} /> {label} {presets.length > 0 && <span className="text-xs text-fg-muted">({presets.length})</span>}
          <ChevronDown size={13} />
        </button>
      )}
    >
      {(close) => (
        <div className="space-y-3">
          <div>
            <p className="label mb-2">Presets</p>
            {loading ? (
              <p className="text-xs text-fg-muted">Loading…</p>
            ) : error ? (
              <p className="text-xs text-[color:var(--danger)]">{error}</p>
            ) : presets.length === 0 ? (
              <p className="text-xs text-fg-muted">No presets yet</p>
            ) : (
              <ul className="max-h-60 space-y-1 overflow-y-auto">
                {presets.map((p) => (
                  <li key={p.id} className="group flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => { onApply(p.config, p); close(); }}
                      className="min-w-0 flex-1 rounded-md px-2 py-1.5 text-left hover:bg-white/10"
                    >
                      <span className="block truncate text-sm text-fg">{p.name}</span>
                      {describe && <span className="block truncate text-[11px] text-fg-muted">{describe(p.config)}</span>}
                    </button>
                    <button type="button" title="Delete preset" onClick={() => handleDelete(p)}
                      className="p-1.5 text-fg-muted opacity-60 hover:text-[color:var(--danger)] group-hover:opacity-100">
                      <Trash2 size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-[color:var(--border)] pt-3">
            <p className="label mb-2">Save current</p>
            <div className="flex gap-2">
              <input
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSave(); } }}
                placeholder="Preset name"
                className="input py-2 text-sm"
              />
              <button type="button" onClick={handleSave} disabled={busy || !name.trim() || !!error}
                className="btn-gold flex items-center gap-1 px-3 py-1.5 text-xs">
                <BookmarkPlus size={13} /> Save
              </button>
            </div>
            {flash && <p className="mt-2 flex items-center gap-1 text-xs text-[color:var(--ok)]"><Check size={12} /> {flash}</p>}
          </div>
        </div>
      )}
    </Popover>
  );
}
