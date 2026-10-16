"use client";

import { forwardRef } from "react";
import { THEME_MAP, resolveCardConfig, type CardConfig } from "@/lib/cardConfig";
import { normalizeHexColor } from "@/lib/colors";

export type { CardConfig } from "@/lib/cardConfig";
export { THEMES } from "@/lib/cardConfig";

type Scripture = { reference: string; text: string | null };

export type CardProps = {
  config: CardConfig;
  groupName: string;
  dayNumber: number | null;
  title: string | null;
  bodyHtml: string | null;
  scriptures: Scripture[];
  width?: number | string;       // 440 for export; "100%" for responsive on-page render
};

const CardPreview = forwardRef<HTMLDivElement, CardProps>(function CardPreview(
  { config, groupName, dayNumber, title, bodyHtml, scriptures, width = 440 },
  ref
) {
  const c = resolveCardConfig(config);
  const theme = THEME_MAP[c.theme] ?? THEME_MAP["theme-royal"];
  const accent = normalizeHexColor(c.accent_color) ?? theme.accent;
  const bg = theme.bg;

  const dispGroup = c.group_name.trim() || groupName;
  const showDay = c.show_day && dayNumber != null;
  const footer = c.footer_text.trim();

  const groupSize = c.group_name_size;
  const daySize = c.day_size;
  const titleSize = c.title_size;
  const prayerSize = c.prayer_font_size;
  const verseSize = c.verse_font_size;

  const rounded = c.rounded_corners;
  return (
    <div
      ref={ref}
      style={{
        width,
        background: bg,
        borderRadius: rounded ? 18 : 0,
        padding: "18px 18px 14px",
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
      <div style={{ textAlign: "center", paddingTop: 4 }}>
        <div
          style={{
            fontSize: groupSize, fontWeight: 800, color: accent,
            letterSpacing: 3, textTransform: "uppercase",
          }}
        >
          {dispGroup}
        </div>
      </div>
      <div style={{ width: 50, height: 2, background: accent, margin: "10px auto", borderRadius: 2 }} />

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
          <div style={{ width: 50, height: 2, background: accent, margin: "10px auto", borderRadius: 2 }} />
        </>
      )}

      {(title || bodyHtml) && (
        <div style={{ marginBottom: 12 }}>
          {title && (
            <div
              style={{
                fontSize: titleSize, fontWeight: 700, color: accent,
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
            color: "rgba(240,230,210,0.45)", letterSpacing: 1, textTransform: "uppercase",
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
        .card-prose mark { border-radius: 2px; padding: 0 2px; color: inherit; }
        .card-prose ul, .card-prose ol { margin: 4px 0 4px 20px; }
        .card-prose ul { list-style: disc; }
        .card-prose ol { list-style: decimal; }
        .card-prose a { color: ${accent}; text-decoration: underline; }
        .card-prose hr { border: 0; border-top: 1px solid ${accent}55; margin: 10px 0; }
        .card-prose li { margin: 2px 0; }
        .card-prose blockquote { border-left: 2px solid ${accent}; padding-left: 10px; margin: 6px 0; font-style: italic; }
        .card-prose h1, .card-prose h2, .card-prose h3 { color: ${accent}; font-weight: 700; margin: 6px 0 4px; }
        .card-prose h1 { font-size: 1.3em; }
        .card-prose h2 { font-size: 1.15em; }
        .card-prose h3 { font-size: 1.05em; }
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
