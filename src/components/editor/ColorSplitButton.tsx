"use client";

import { useState } from "react";
import { ChevronDown, Pipette, X } from "lucide-react";
import Popover from "@/components/ui/Popover";
import {
  HIGHLIGHT_COLORS, STANDARD_COLORS, THEME_COLORS, THEME_VARIATIONS,
  normalizeHexColor, shade,
} from "@/lib/colors";
import { useRecentColors } from "@/lib/useRecentColors";

/**
 * Word-style split button: the left half re-applies the last used color, the
 * arrow opens a palette with Automatic / Recent / Document / Theme / Standard
 * colors and a custom "More colors…" picker.
 */
export default function ColorSplitButton({
  kind, icon, title, defaultColor, currentColor, documentColors, onApply, onClear,
}: {
  kind: "text" | "highlight";
  icon: React.ReactNode;
  title: string;
  defaultColor: string;
  currentColor: string | null;
  documentColors: string[];
  onApply: (color: string) => void;
  onClear: () => void;
}) {
  const { colors: recent, push } = useRecentColors(kind);
  const [lastUsed, setLastUsed] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState<string>(defaultColor);
  const swatch = lastUsed ?? recent[0] ?? defaultColor;

  function pick(color: string) {
    const hex = normalizeHexColor(color);
    if (!hex) return;
    setLastUsed(hex);
    push(hex);
    onApply(hex);
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      className="w-[264px]"
      trigger={(isOpen, toggle) => (
        <div
          className={`flex h-8 items-stretch rounded-md transition-colors ${
            isOpen ? "bg-white/10" : "hover:bg-white/5"
          }`}
        >
          <button
            type="button"
            title={`${title} (${swatch})`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pick(swatch)}
            className={`relative grid w-8 place-items-center rounded-l-md hover:bg-white/10 ${
              currentColor ? "text-gold" : "text-fg-muted hover:text-fg"
            }`}
          >
            {icon}
            <span className="absolute bottom-1 h-[3px] w-5 rounded-sm" style={{ backgroundColor: swatch }} />
          </button>
          <button
            type="button"
            title={`${title} options`}
            aria-expanded={isOpen}
            onMouseDown={(e) => e.preventDefault()}
            onClick={toggle}
            className="grid w-4 place-items-center rounded-r-md text-fg-muted hover:bg-white/10 hover:text-fg"
          >
            <ChevronDown size={12} />
          </button>
        </div>
      )}
    >
      <div className="space-y-3 text-xs">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => { onClear(); setOpen(false); }}
          className="flex w-full items-center gap-2 rounded-md border border-[color:var(--border)] px-2 py-1.5 text-left text-fg hover:border-[color:var(--gold)]"
        >
          {kind === "text" ? (
            <span className="h-4 w-4 rounded-sm border border-white/20" style={{ backgroundColor: defaultColor }} />
          ) : (
            <X size={14} className="text-fg-muted" />
          )}
          {kind === "text" ? "Automatic" : "No color"}
        </button>

        {recent.length > 0 && (
          <SwatchRow label="Recent colors" colors={recent} current={currentColor} onPick={pick} />
        )}
        {documentColors.length > 0 && (
          <SwatchRow label="Colors in this document" colors={documentColors} current={currentColor} onPick={pick} />
        )}

        {kind === "text" ? (
          <>
            <div>
              <p className="mb-1.5 text-fg-muted">Theme colors</p>
              <div className="grid grid-cols-10 gap-[3px]">
                {THEME_COLORS.map((c) => (
                  <Swatch key={c} color={c} current={currentColor} onPick={pick} />
                ))}
              </div>
              <div className="mt-1.5 grid grid-cols-10 gap-x-[3px]">
                {THEME_VARIATIONS.flatMap((amount) =>
                  THEME_COLORS.map((c) => (
                    <Swatch key={`${c}${amount}`} color={shade(c, amount)} current={currentColor} onPick={pick} tight />
                  )),
                )}
              </div>
            </div>
            <SwatchRow label="Standard colors" colors={STANDARD_COLORS} current={currentColor} onPick={pick} />
          </>
        ) : (
          <div>
            <p className="mb-1.5 text-fg-muted">Highlight colors</p>
            <div className="grid grid-cols-5 gap-1">
              {HIGHLIGHT_COLORS.map((c) => (
                <Swatch key={c} color={c} current={currentColor} onPick={pick} large />
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-[color:var(--border)] pt-3">
          <p className="mb-1.5 flex items-center gap-1 text-fg-muted"><Pipette size={12} /> More colors…</p>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={normalizeHexColor(custom) ?? defaultColor}
              onChange={(e) => setCustom(e.target.value)}
              className="h-8 w-10 cursor-pointer rounded border border-[color:var(--border)] bg-transparent"
              title="Pick a custom color"
            />
            <input
              type="text"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); pick(custom); } }}
              placeholder="#hex"
              className="h-8 w-full min-w-0 rounded-md border border-[color:var(--border)] bg-white/5 px-2 font-mono text-xs text-fg outline-none focus:border-[color:var(--gold)]"
            />
            <button
              type="button"
              disabled={!normalizeHexColor(custom)}
              onClick={() => pick(custom)}
              className="btn-gold px-3 py-1.5 text-xs"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </Popover>
  );
}

function SwatchRow({ label, colors, current, onPick }: {
  label: string; colors: string[]; current: string | null; onPick: (c: string) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-fg-muted">{label}</p>
      <div className="grid grid-cols-10 gap-[3px]">
        {colors.map((c) => <Swatch key={c} color={c} current={current} onPick={onPick} />)}
      </div>
    </div>
  );
}

function Swatch({ color, current, onPick, tight, large }: {
  color: string; current: string | null; onPick: (c: string) => void; tight?: boolean; large?: boolean;
}) {
  const selected = current != null && normalizeHexColor(current) === normalizeHexColor(color);
  return (
    <button
      type="button"
      title={color}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onPick(color)}
      className={`${large ? "h-7" : "h-5"} w-full border transition-transform hover:z-10 hover:scale-125 ${
        tight ? "rounded-none" : "rounded-sm"
      } ${selected ? "border-[color:var(--gold)] ring-1 ring-[color:var(--gold)]" : "border-white/15"}`}
      style={{ backgroundColor: color }}
    />
  );
}
