"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  onConfirm: () => void;
  disabled?: boolean;
  holdMs?: number;             // how long to hold (default 1500)
  label?: string;              // resting label
  holdingLabel?: string;       // while pressing
  className?: string;
  children?: React.ReactNode;  // overrides label entirely
};

// A button that must be held for `holdMs` milliseconds before firing onConfirm.
// Visual progress fills left-to-right; release early to cancel.
export default function LongPressButton({
  onConfirm, disabled, holdMs = 1500,
  label = "Hold to confirm", holdingLabel = "Hold…",
  className = "",
}: Props) {
  const [progress, setProgress] = useState(0); // 0..1
  const [holding, setHolding] = useState(false);
  const raf = useRef<number | null>(null);
  const start = useRef<number>(0);
  const fired = useRef<boolean>(false);

  function haptic(pattern: number | number[] = 10) {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try { (navigator.vibrate as (p: number | number[]) => boolean)(pattern); } catch {}
    }
  }

  function step() {
    const elapsed = performance.now() - start.current;
    const p = Math.min(1, elapsed / holdMs);
    setProgress(p);
    if (p >= 1) {
      if (!fired.current) {
        fired.current = true;
        haptic([10, 30, 15]);
        onConfirm();
      }
      stop(true);
      return;
    }
    raf.current = requestAnimationFrame(step);
  }

  function begin() {
    if (disabled || holding) return;
    // Dismiss any open mobile keyboard so it doesn't cover the button.
    if (typeof document !== "undefined") {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) el.blur();
    }
    fired.current = false;
    start.current = performance.now();
    setHolding(true);
    setProgress(0);
    haptic(8);
    raf.current = requestAnimationFrame(step);
  }

  function stop(completed = false) {
    setHolding(false);
    if (!completed) setProgress(0);
    if (raf.current) { cancelAnimationFrame(raf.current); raf.current = null; }
  }

  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); }, []);

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={(e) => { e.preventDefault(); begin(); }}
      onPointerUp={() => stop()}
      onPointerLeave={() => stop()}
      onPointerCancel={() => stop()}
      onContextMenu={(e) => e.preventDefault()}
      className={[
        "relative overflow-hidden w-full py-3 rounded-full font-semibold text-sm select-none",
        "bg-[color:var(--surface)] border border-[color:var(--gold)]",
        "text-gold disabled:opacity-40 disabled:cursor-not-allowed",
        "transition-[transform] active:scale-[0.99]",
        "touch-none",
        className,
      ].join(" ")}
      style={{ WebkitUserSelect: "none", userSelect: "none" }}
    >
      <span
        aria-hidden
        className="absolute inset-0 bg-gold"
        style={{
          width: `${progress * 100}%`,
          transition: holding ? "none" : "width .25s ease",
          opacity: 0.9,
        }}
      />
      <span className="relative z-10 mix-blend-difference">
        {progress >= 1 ? "✓ Confirmed" : holding ? holdingLabel : label}
      </span>
    </button>
  );
}
