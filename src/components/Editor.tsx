"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle, Color, FontSize } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import {
  Bold, Italic, List, ListOrdered, Quote, Heading2, Undo2, Redo2,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, Minus, Plus,
  Palette,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

const DEFAULT_COLORS = ["#f0e6d2", "#d4af37", "#ffffff", "#c8bfa0", "#ff6b81", "#6ecf8e", "#4dd0e1"];
const FALLBACK_COLOR = DEFAULT_COLORS[1];

export default function Editor({
  value, onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      TextStyle,
      Color,
      FontSize,
      TextAlign.configure({ types: ["paragraph", "heading"], alignments: ["left", "center", "right", "justify"] }),
    ],
    content: value || "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "prose-prayer min-h-[180px] outline-none px-4 py-3 text-[15px] leading-relaxed",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) editor.commands.setContent(value || "", { emitUpdate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Remember the last selection so we can restore it when the user interacts
  // with a control outside the editor (number input, color picker).
  const savedFrom = useRef<number | null>(null);
  const savedTo = useRef<number | null>(null);
  const [activeColor, setActiveColor] = useState<string | null>(null);
  const [recentColors, setRecentColors] = useState<string[]>(DEFAULT_COLORS);

  useEffect(() => {
    if (!editor) return;
    const capture = () => {
      const { from, to } = editor.state.selection;
      savedFrom.current = from;
      savedTo.current = to;
      setActiveColor(normalizeHexColor(editor.getAttributes("textStyle").color));
    };
    editor.on("selectionUpdate", capture);
    editor.on("transaction", capture);
    capture();
    return () => {
      editor.off("selectionUpdate", capture);
      editor.off("transaction", capture);
    };
  }, [editor]);

  const [size, setSize] = useState<number>(14);

  if (!editor) return null;

  // Before running a command from an outside control, restore the captured
  // selection so the mark/attribute lands on the right range.
  function withSelection(run: () => void) {
    if (savedFrom.current != null && savedTo.current != null) {
      editor!.commands.setTextSelection({ from: savedFrom.current, to: savedTo.current });
    }
    editor!.commands.focus();
    run();
  }

  // preventDefault on mousedown keeps focus in the editor so native selection
  // isn't collapsed by the button taking focus.
  const noFocusSteal = (e: React.MouseEvent) => e.preventDefault();

  const Btn = ({ onClick, active, children, title }: {
    onClick: () => void; active?: boolean; children: React.ReactNode; title: string;
  }) => (
    <button type="button" title={title}
      onMouseDown={noFocusSteal}
      onClick={onClick}
      className={`p-1.5 rounded hover:bg-white/5 ${active ? "text-gold" : "text-fg-muted"}`}>
      {children}
    </button>
  );

  function applyFontSize(px: number) {
    const num = Math.max(6, Math.min(96, Math.round(px)));
    setSize(num);
    withSelection(() => {
      (editor!.chain() as unknown as { setFontSize: (v: string) => { run: () => void } })
        .setFontSize(`${num}px`).run();
    });
  }
  function bumpSize(delta: number) { applyFontSize(size + delta); }

  function applyColor(c: string) {
    const color = normalizeHexColor(c) ?? FALLBACK_COLOR;
    setActiveColor(color);
    setRecentColors((colors) => [color, ...colors.filter((item) => item.toLowerCase() !== color.toLowerCase())].slice(0, 7));
    withSelection(() => { editor!.chain().setColor(color).run(); });
  }

  function resetColor() {
    setActiveColor(null);
    withSelection(() => { editor!.chain().unsetColor().run(); });
  }

  const colorPickerValue = activeColor ?? recentColors[0] ?? FALLBACK_COLOR;

  return (
    <div className="border border-[color:var(--border)] rounded-xl overflow-hidden bg-white/5">
      <div className="flex items-center flex-wrap gap-1 px-2 py-1 border-b border-[color:var(--border)]">
        <Btn title="Bold" onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")}><Bold size={15} /></Btn>
        <Btn title="Italic" onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")}><Italic size={15} /></Btn>
        <Btn title="Heading" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })}><Heading2 size={15} /></Btn>
        <Btn title="Bullet list" onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")}><List size={15} /></Btn>
        <Btn title="Numbered list" onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")}><ListOrdered size={15} /></Btn>
        <Btn title="Quote" onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")}><Quote size={15} /></Btn>

        <span className="mx-1 h-4 w-px bg-[color:var(--border)]" />

        <Btn title="Align left"    onClick={() => editor.chain().focus().setTextAlign("left").run()}    active={editor.isActive({ textAlign: "left" })}><AlignLeft size={15} /></Btn>
        <Btn title="Align center"  onClick={() => editor.chain().focus().setTextAlign("center").run()}  active={editor.isActive({ textAlign: "center" })}><AlignCenter size={15} /></Btn>
        <Btn title="Align right"   onClick={() => editor.chain().focus().setTextAlign("right").run()}   active={editor.isActive({ textAlign: "right" })}><AlignRight size={15} /></Btn>
        <Btn title="Justify"       onClick={() => editor.chain().focus().setTextAlign("justify").run()} active={editor.isActive({ textAlign: "justify" })}><AlignJustify size={15} /></Btn>

        <span className="mx-1 h-4 w-px bg-[color:var(--border)]" />

        <div className="flex items-center gap-0.5 text-xs text-fg-muted">
          <span className="mr-1">Size</span>
          <button type="button"
            onMouseDown={noFocusSteal}
            onClick={() => bumpSize(-1)}
            className="p-1 rounded hover:bg-white/5 text-fg-muted active:scale-95"
            title="Smaller"><Minus size={14} /></button>
          <input
            type="number" min={6} max={96}
            value={size}
            onMouseDown={noFocusSteal}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              if (!Number.isNaN(n)) applyFontSize(n);
            }}
            className="w-10 text-center bg-transparent border border-[color:var(--border)] rounded px-1 py-0.5 text-fg tabular-nums"
          />
          <button type="button"
            onMouseDown={noFocusSteal}
            onClick={() => bumpSize(+1)}
            className="p-1 rounded hover:bg-white/5 text-fg-muted active:scale-95"
            title="Larger"><Plus size={14} /></button>
        </div>

        <span className="mx-1 h-4 w-px bg-[color:var(--border)]" />

        <div className="flex items-center gap-1 text-xs text-fg-muted">
          <span>Color</span>
          <button
            type="button"
            title={activeColor ? `Reuse ${activeColor}` : "Reuse recent color"}
            onMouseDown={noFocusSteal}
            onClick={() => applyColor(colorPickerValue)}
            className="h-7 w-7 rounded border border-[color:var(--border)] grid place-items-center hover:border-[color:var(--gold)]"
          >
            <span className="h-4 w-4 rounded-sm border border-black/30" style={{ backgroundColor: colorPickerValue }} />
          </button>
          <div className="flex items-center gap-0.5">
            {recentColors.slice(0, 5).map((color) => (
              <button
                key={color}
                type="button"
                title={`Apply ${color}`}
                onMouseDown={noFocusSteal}
                onClick={() => applyColor(color)}
                className={`h-6 w-6 rounded border p-0.5 hover:border-[color:var(--gold)] ${
                  activeColor?.toLowerCase() === color.toLowerCase()
                    ? "border-[color:var(--gold)]"
                    : "border-[color:var(--border)]"
                }`}
              >
                <span className="block h-full w-full rounded-sm border border-black/30" style={{ backgroundColor: color }} />
              </button>
            ))}
          </div>
          <label
            title="Choose another color"
            onMouseDown={noFocusSteal}
            className="h-7 px-2 rounded border border-[color:var(--border)] hover:border-[color:var(--gold)] cursor-pointer inline-flex items-center gap-1 text-fg-muted"
          >
            <Palette size={14} />
            <span>More</span>
            <input
              type="color"
              value={colorPickerValue}
              onChange={(e) => applyColor(e.target.value)}
              className="sr-only"
            />
          </label>
          <button type="button"
            onMouseDown={noFocusSteal}
            onClick={resetColor}
            className="text-fg-muted hover:text-gold underline">
            reset
          </button>
        </div>

        <div className="flex-1" />

        <Btn title="Undo" onClick={() => editor.chain().focus().undo().run()}><Undo2 size={15} /></Btn>
        <Btn title="Redo" onClick={() => editor.chain().focus().redo().run()}><Redo2 size={15} /></Btn>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

function normalizeHexColor(color: unknown) {
  if (typeof color !== "string") return null;
  const value = color.trim();
  const shortHex = /^#([0-9a-f]{3})$/i.exec(value);
  if (shortHex) {
    return `#${shortHex[1].split("").map((ch) => ch + ch).join("")}`.toLowerCase();
  }
  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase();
  const rgb = /^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/i.exec(value);
  if (!rgb) return null;
  return `#${rgb.slice(1, 4).map((part) => {
    const n = Math.max(0, Math.min(255, parseInt(part, 10)));
    return n.toString(16).padStart(2, "0");
  }).join("")}`;
}
