"use client";

import { useCallback, useSyncExternalStore } from "react";
import { normalizeHexColor } from "@/lib/colors";

// Per-browser "Recent colors" (like Word). Stored in localStorage and shared
// between every picker instance on the page via a tiny external store.

const MAX_RECENT = 10;
const EMPTY: string[] = [];
const listeners = new Set<() => void>();
const cache = new Map<string, string[]>();

function storageKey(kind: string) {
  return `prayer-editor:recent-colors:${kind}`;
}

function read(kind: string): string[] {
  const cached = cache.get(kind);
  if (cached) return cached;
  let list: string[] = EMPTY;
  try {
    const raw = window.localStorage.getItem(storageKey(kind));
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) list = parsed.map(normalizeHexColor).filter((c): c is string => !!c);
  } catch { /* storage unavailable */ }
  cache.set(kind, list);
  return list;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function useRecentColors(kind: "text" | "highlight") {
  const colors = useSyncExternalStore(subscribe, () => read(kind), () => EMPTY);

  const push = useCallback((color: string) => {
    const hex = normalizeHexColor(color);
    if (!hex) return;
    const next = [hex, ...read(kind).filter((c) => c !== hex)].slice(0, MAX_RECENT);
    cache.set(kind, next);
    try { window.localStorage.setItem(storageKey(kind), JSON.stringify(next)); } catch { /* ignore */ }
    listeners.forEach((l) => l());
  }, [kind]);

  return { colors, push };
}
