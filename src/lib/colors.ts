// Color helpers + palettes shared by the editor's Word-style color pickers.

export function normalizeHexColor(color: unknown): string | null {
  if (typeof color !== "string") return null;
  const value = color.trim();
  const shortHex = /^#?([0-9a-f]{3})$/i.exec(value);
  if (shortHex) return `#${shortHex[1].split("").map((ch) => ch + ch).join("")}`.toLowerCase();
  const longHex = /^#?([0-9a-f]{6})$/i.exec(value);
  if (longHex) return `#${longHex[1]}`.toLowerCase();
  const rgb = /^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/i.exec(value);
  if (!rgb) return null;
  return `#${rgb.slice(1, 4).map((part) => {
    const n = Math.max(0, Math.min(255, parseInt(part, 10)));
    return n.toString(16).padStart(2, "0");
  }).join("")}`;
}

/** Mix `hex` toward white (amount > 0) or black (amount < 0). amount ∈ [-1, 1]. */
export function shade(hex: string, amount: number): string {
  const n = normalizeHexColor(hex);
  if (!n) return hex;
  const target = amount >= 0 ? 255 : 0;
  const t = Math.abs(amount);
  const channels = [1, 3, 5].map((i) => parseInt(n.slice(i, i + 2), 16));
  return `#${channels
    .map((c) => Math.round(c + (target - c) * t).toString(16).padStart(2, "0"))
    .join("")}`;
}

/** Base "theme" colors, tuned for the dark prayer card. Each becomes a column of tints/shades. */
export const THEME_COLORS = [
  "#ffffff", "#f0e6d2", "#d4af37", "#f39c12", "#ff6b81",
  "#c39be8", "#9fa8da", "#4dd0e1", "#6ecf8e", "#111a3a",
];

/** Word's layout: base row, then 3 lighter + 2 darker variations. */
export const THEME_VARIATIONS = [0.8, 0.6, 0.4, -0.25, -0.5];

export const STANDARD_COLORS = [
  "#c00000", "#ff0000", "#ffc000", "#ffff00", "#92d050",
  "#00b050", "#00b0f0", "#0070c0", "#002060", "#7030a0",
];

export const HIGHLIGHT_COLORS = [
  "#fef08a", "#fde047", "#bbf7d0", "#86efac", "#a5f3fc",
  "#93c5fd", "#f5d0fe", "#f9a8d4", "#fecaca", "#fed7aa",
  "#d4af37", "#7c2d12", "#14532d", "#1e3a8a", "#581c87",
];

/** Collect distinct colors used in an HTML string ("Colors in this document"). Browser-only. */
export function documentColors(html: string, kind: "text" | "highlight"): string[] {
  if (!html || typeof DOMParser === "undefined") return [];
  const doc = new DOMParser().parseFromString(html, "text/html");
  const found = new Set<string>();
  const nodes = doc.body.querySelectorAll<HTMLElement>(kind === "text" ? "span[style]" : "mark[style]");
  nodes.forEach((el) => {
    const hex = normalizeHexColor(kind === "text" ? el.style.color : el.style.backgroundColor);
    if (hex) found.add(hex);
  });
  return [...found].slice(0, 10);
}

/** Dark or light text, whichever reads better on `background`. */
export function readableTextOn(background: string): string {
  const n = normalizeHexColor(background);
  if (!n) return "inherit";
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(n.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.3 ? "#1a1a1a" : "#ffffff";
}
