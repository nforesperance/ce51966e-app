"use client";

import { forwardRef } from "react";

export type CardConfig = {
  theme?: string;
  group_name?: string;
  level?: string;
  group_name_size?: number;
  level_size?: number;
  day_size?: number;
  prayer_font_size?: number;
  verse_font_size?: number;
  footer_text?: string;
  show_day?: boolean;
};

export const THEMES: { value: string; label: string; accent: string; bg: string }[] = [
  { value: "theme-royal",    label: "Royal Gold",    accent: "#d4af37", bg: "linear-gradient(160deg,#0f3460 0%,#1a1a2e 50%,#16213e 100%)" },
  { value: "theme-fire",     label: "Fire",          accent: "#f39c12", bg: "linear-gradient(160deg,#4a1a0a 0%,#1a0a04 50%,#2d1206 100%)" },
  { value: "theme-grace",    label: "Grace Purple",  accent: "#c39be8", bg: "linear-gradient(160deg,#1a0a2e 0%,#0d0620 50%,#1a0e30 100%)" },
  { value: "theme-earth",    label: "Earth Green",   accent: "#6ecf8e", bg: "linear-gradient(160deg,#1a2e0f 0%,#0d1a08 50%,#1e3012 100%)" },
  { value: "theme-ocean",    label: "Ocean Blue",    accent: "#4dd0e1", bg: "linear-gradient(160deg,#0a2e4e 0%,#061a2e 50%,#0d3355 100%)" },
  { value: "theme-crimson",  label: "Crimson",       accent: "#ff6b81", bg: "linear-gradient(160deg,#3b0a0a 0%,#1a0505 50%,#2a0808 100%)" },
  { value: "theme-midnight", label: "Midnight",      accent: "#e0e0e0", bg: "linear-gradient(160deg,#141428 0%,#0a0a1a 50%,#1a1a30 100%)" },
  { value: "theme-sunrise",  label: "Sunrise",       accent: "#ffd166", bg: "linear-gradient(160deg,#4a2010 0%,#2a1008 50%,#3d1a0e 100%)" },
  { value: "theme-silver",   label: "Silver",        accent: "#c8c8d8", bg: "linear-gradient(160deg,#2c2c3a 0%,#1a1a24 50%,#262632 100%)" },
  { value: "theme-burgundy", label: "Burgundy Wine", accent: "#f48fb1", bg: "linear-gradient(160deg,#3b0f2a 0%,#1a0812 50%,#2e0c20 100%)" },
  { value: "theme-emerald",  label: "Emerald",       accent: "#58d68d", bg: "linear-gradient(160deg,#0a3020 0%,#051a10 50%,#0e3828 100%)" },
  { value: "theme-sapphire", label: "Sapphire",      accent: "#9fa8da", bg: "linear-gradient(160deg,#0d1b4a 0%,#060e28 50%,#10204e 100%)" },
];

const THEME_MAP = Object.fromEntries(THEMES.map((t) => [t.value, t]));

type Scripture = { reference: string; text: string | null };

export type CardProps = {
  config: CardConfig;
  groupName: string;
  level: string | null;
  dayNumber: number | null;
  title: string | null;
  bodyHtml: string | null;
  scriptures: Scripture[];
  width?: number;                // for fixed export size
};

const CardPreview = forwardRef<HTMLDivElement, CardProps>(function CardPreview(
  { config, groupName, level, dayNumber, title, bodyHtml, scriptures, width = 440 },
  ref
) {
  const theme = THEME_MAP[config.theme ?? "theme-royal"] ?? THEME_MAP["theme-royal"];
  const accent = theme.accent;
  const bg = theme.bg;

  const dispGroup = config.group_name?.trim() || groupName;
  const dispLevel = config.level?.trim() || level || null;
  const showDay = config.show_day !== false && dayNumber != null;
  const footer = config.footer_text?.trim();

  const groupSize = config.group_name_size ?? 26;
  const levelSize = config.level_size ?? 11;
  const daySize = config.day_size ?? 44;
  const prayerSize = config.prayer_font_size ?? 15;
  const verseSize = config.verse_font_size ?? 13;

  return (
    <div
      ref={ref}
      style={{
        width,
        background: bg,
        borderRadius: 18,
        padding: "32px 28px 24px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        position: "relative",
        overflow: "hidden",
        color: "#f0e6d2",
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      }}
    >
      <div
        style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 6,
          background: `linear-gradient(90deg, ${accent}, ${lighten(accent)}, ${accent})`,
        }}
      />
      <div style={{ textAlign: "center", paddingTop: 8 }}>
        <div
          style={{
            fontSize: groupSize, fontWeight: 800, color: accent,
            letterSpacing: 3, textTransform: "uppercase",
          }}
        >
          {dispGroup}
        </div>
        {dispLevel && (
          <div
            style={{
              display: "inline-block", marginTop: 8,
              padding: "3px 16px",
              border: `1.5px solid ${accent}`,
              borderRadius: 20,
              fontSize: levelSize, color: accent,
              letterSpacing: 1.5, textTransform: "uppercase",
            }}
          >
            {dispLevel}
          </div>
        )}
      </div>
      <div style={{ width: 50, height: 2, background: accent, margin: "16px auto", borderRadius: 2 }} />

      {showDay && (
        <>
          <div
            style={{
              textAlign: "center", fontSize: 13, color: "#aaa",
              textTransform: "uppercase", letterSpacing: 2,
            }}
          >
            Day
          </div>
          <div
            style={{
              textAlign: "center", fontSize: daySize, fontWeight: 800,
              color: "#fff", lineHeight: 1.1,
            }}
          >
            {dayNumber}
          </div>
          <div style={{ width: 50, height: 2, background: accent, margin: "16px auto", borderRadius: 2 }} />
        </>
      )}

      {(title || bodyHtml) && (
        <div style={{ marginBottom: 12 }}>
          {title && (
            <div
              style={{
                fontSize: 17, fontWeight: 700, color: accent,
                marginBottom: 8, textAlign: "center",
              }}
            >
              {title}
            </div>
          )}
          {bodyHtml && (
            <div
              className="card-prose"
              style={{ fontSize: prayerSize, color: "#f0e6d2", lineHeight: 1.55, fontWeight: 500 }}
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
          )}
        </div>
      )}

      {scriptures.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          {scriptures.map((s, i) => (
            <div key={i} style={{ marginBottom: i === scriptures.length - 1 ? 0 : 8 }}>
              {s.text && (
                <div
                  style={{
                    fontSize: verseSize, color: "#c8bfa0",
                    lineHeight: 1.5, fontStyle: "italic",
                  }}
                >
                  “{s.text}”
                </div>
              )}
              <div
                style={{
                  marginTop: 4, fontSize: Math.max(11, verseSize - 2),
                  color: accent, fontWeight: 600,
                }}
              >
                {s.reference}
              </div>
            </div>
          ))}
        </div>
      )}

      {footer && (
        <div
          style={{
            marginTop: 12, textAlign: "center", fontSize: 10,
            color: "#555", letterSpacing: 1, textTransform: "uppercase",
          }}
        >
          {footer}
        </div>
      )}
      <style>{`
        .card-prose p { margin: 0 0 0.55em 0; min-height: 1em; }
        .card-prose p:last-child { margin-bottom: 0; }
        .card-prose p:empty::before { content: "\\00a0"; }
        .card-prose strong { color: inherit; font-weight: 700; }
        .card-prose em { font-style: italic; }
        .card-prose ul, .card-prose ol { margin: 4px 0 4px 20px; }
        .card-prose li { margin: 2px 0; }
        .card-prose blockquote { border-left: 2px solid ${accent}; padding-left: 10px; margin: 6px 0; font-style: italic; }
        .card-prose h2, .card-prose h3 { color: ${accent}; font-weight: 700; margin: 6px 0 4px; }
      `}</style>
    </div>
  );
});

function lighten(hex: string) {
  // Small helper to produce a lighter accent for the top bar gradient.
  if (!hex.startsWith("#") || hex.length !== 7) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const blend = (c: number) => Math.min(255, Math.round(c + (255 - c) * 0.35));
  return `rgb(${blend(r)}, ${blend(g)}, ${blend(b)})`;
}

export default CardPreview;
