"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Minimal anchored popover: renders `trigger(open, toggle)` and, when open, the
 * panel below it. Closes on outside click and Escape. Buttons inside the panel
 * should `preventDefault` on mousedown when they must not steal editor focus.
 */
export default function Popover({
  trigger, children, align = "left", className = "", open: controlledOpen, onOpenChange,
}: {
  trigger: (open: boolean, toggle: () => void) => React.ReactNode;
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
  align?: "left" | "right";
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const rootRef = useRef<HTMLDivElement | null>(null);

  const setOpen = useCallback((next: boolean) => {
    if (controlledOpen === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  }, [controlledOpen, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    // Capture phase so Escape closes only the popover, not an enclosing dialog.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); setOpen(false); }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open, setOpen]);

  const close = () => setOpen(false);

  return (
    <div ref={rootRef} className="relative">
      {trigger(open, () => setOpen(!open))}
      {open && (
        <div
          className={`absolute top-full z-50 mt-1 max-w-[calc(100vw-2rem)] rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-2xl ${
            align === "right" ? "right-0" : "left-0"
          } ${className}`}
        >
          {typeof children === "function" ? children(close) : children}
        </div>
      )}
    </div>
  );
}
