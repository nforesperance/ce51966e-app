import { Mark, mergeAttributes } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle, Color, FontFamily, FontSize } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import { readableTextOn } from "@/lib/colors";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    highlight: {
      setHighlight: (color: string) => ReturnType;
      unsetHighlight: () => ReturnType;
    };
  }
}

/**
 * Colored highlight stored as `<mark style="background-color: …">`, which is
 * what earlier versions of the editor saved, so existing content keeps working.
 */
export const Highlight = Mark.create({
  name: "highlight",

  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element) => element.style.backgroundColor || null,
        // Also pin a readable text color; an explicit font color nested inside still wins.
        renderHTML: (attributes) =>
          attributes.color
            ? { style: `background-color: ${attributes.color}; color: ${readableTextOn(attributes.color)}` }
            : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "mark" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["mark", mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setHighlight: (color) => ({ commands }) => commands.setMark(this.name, { color }),
      unsetHighlight: () => ({ commands }) => commands.unsetMark(this.name),
    };
  },
});

export function buildExtensions(placeholder: string) {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      codeBlock: false,
      code: false,
      link: {
        openOnClick: false,
        defaultProtocol: "https",
        HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" },
      },
    }),
    Highlight,
    TextStyle,
    Color,
    FontFamily,
    FontSize,
    TextAlign.configure({ types: ["heading", "paragraph"], alignments: ["left", "center", "right", "justify"] }),
    Placeholder.configure({ placeholder }),
    CharacterCount,
  ];
}

export const DEFAULT_TEXT_COLOR = "#f0e6d2";
export const DEFAULT_HIGHLIGHT_COLOR = "#fef08a";
export const DEFAULT_FONT_SIZE = 15;

export const FONT_SIZES = [8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 28, 32, 36, 48];

// Web-safe stacks only: the card is exported with html2canvas, so fonts must be
// available locally on the admin's device.
export const FONT_FAMILIES: { label: string; value: string | null }[] = [
  { label: "Default", value: null },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
  { label: "Palatino", value: "'Palatino Linotype', Palatino, 'Book Antiqua', serif" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Trebuchet MS", value: "'Trebuchet MS', Tahoma, sans-serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Courier New", value: "'Courier New', Courier, monospace" },
];

/** Match a stored font-family string back to one of FONT_FAMILIES by its first family name. */
export function matchFontFamily(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const first = (v: string) => v.split(",")[0].replace(/["']/g, "").trim().toLowerCase();
  const target = first(value);
  return FONT_FAMILIES.find((f) => f.value && first(f.value) === target)?.value ?? value;
}

export function parseFontSize(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Word-style grow/shrink: jump to the next size in FONT_SIZES. */
export function stepFontSize(current: number, direction: 1 | -1): number {
  if (direction > 0) return FONT_SIZES.find((s) => s > current) ?? current + 4;
  return [...FONT_SIZES].reverse().find((s) => s < current) ?? Math.max(1, current - 1);
}
