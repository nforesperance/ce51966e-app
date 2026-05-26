"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import { Mark, mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle, Color, FontSize } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import {
  AlignCenter,
  AlignLeft,
  BookOpen,
  Bold,
  Eraser,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Palette,
  Plus,
  Quote,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

const DEFAULT_TEXT_COLOR = "#f0e6d2";
const DEFAULT_HIGHLIGHT_COLOR = "#fef08a";
const DEFAULT_FONT_SIZE = 15;

const HighlightMark = Mark.create({
  name: "highlight",

  addAttributes() {
    return {
      style: {
        default: null,
        parseHTML: (element) => element.getAttribute("style"),
        renderHTML: (attributes) => attributes.style ? { style: attributes.style } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "mark" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["mark", mergeAttributes(HTMLAttributes), 0];
  },
});

export default function Editor({
  value, onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [activeColor, setActiveColor] = useState<string | null>(null);
  const [fontSizeInput, setFontSizeInput] = useState("");

  const selectionRef = useRef<{ from: number; to: number } | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      HighlightMark,
      TextStyle,
      Color,
      FontSize,
      TextAlign.configure({ types: ["heading", "paragraph"], alignments: ["left", "center", "right", "justify"] }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" },
      }),
    ],
    content: value || "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "prose-prayer tiptap min-h-[360px] outline-none px-6 py-5 text-[15px] leading-relaxed",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) editor.commands.setContent(value || "", { emitUpdate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (!editor) return;
    const capture = () => {
      const { from, to } = editor.state.selection;
      selectionRef.current = { from, to };
      setActiveColor(normalizeHexColor(editor.getAttributes("textStyle").color));
      setFontSizeInput(parseFontSize(editor.getAttributes("textStyle").fontSize)?.toString() ?? "");
    };
    editor.on("selectionUpdate", capture);
    editor.on("transaction", capture);
    capture();
    return () => {
      editor.off("selectionUpdate", capture);
      editor.off("transaction", capture);
    };
  }, [editor]);

  if (!editor) return null;

  function withSelection(run: () => void) {
    if (selectionRef.current) editor!.commands.setTextSelection(selectionRef.current);
    editor!.commands.focus();
    run();
  }

  function applyTextColor(color: string) {
    const nextColor = normalizeHexColor(color) ?? DEFAULT_TEXT_COLOR;
    setActiveColor(nextColor);
    withSelection(() => editor!.chain().setColor(nextColor).run());
  }

  function applyHighlight(color: string) {
    withSelection(() => {
      editor!.chain().setMark("highlight", { style: `background-color: ${color}` }).run();
    });
  }

  function clearHighlight() {
    withSelection(() => editor!.chain().unsetMark("highlight").run());
  }

  function applyFontSize(value: string | number) {
    const parsed = typeof value === "number" ? value : parseFloat(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    const next = roundFontSize(parsed);
    setFontSizeInput(next.toString());
    withSelection(() => {
      (editor!.chain() as unknown as { setFontSize: (size: string) => { run: () => void } })
        .setFontSize(`${next}px`)
        .run();
    });
  }

  function bumpFontSize(delta: number) {
    const current = parseFontSize(fontSizeInput) ?? parseFontSize(editor!.getAttributes("textStyle").fontSize) ?? DEFAULT_FONT_SIZE;
    applyFontSize(Math.max(1, current + delta));
  }

  function resetFontSize() {
    setFontSizeInput("");
    withSelection(() => {
      (editor!.chain() as unknown as { unsetFontSize: () => { run: () => void } })
        .unsetFontSize()
        .run();
    });
  }

  function openLinkDialog() {
    if (editor!.isActive("link")) {
      withSelection(() => editor!.chain().unsetLink().run());
      return;
    }
    const { from, to } = editor!.state.selection;
    setLinkText(from !== to ? editor!.state.doc.textBetween(from, to) : "");
    setLinkUrl("");
    setShowLinkDialog(true);
  }

  function insertLink() {
    const trimmedUrl = linkUrl.trim();
    if (!trimmedUrl) return;
    const href = /^https?:\/\//i.test(trimmedUrl) ? trimmedUrl : `https://${trimmedUrl}`;
    withSelection(() => {
      if (linkText.trim()) {
        editor!.chain().insertContent({
          type: "text",
          text: linkText.trim(),
          marks: [{ type: "link", attrs: { href, target: "_blank", rel: "noopener noreferrer" } }],
        }).run();
      } else {
        editor!.chain().setLink({ href, target: "_blank", rel: "noopener noreferrer" }).run();
      }
    });
    setLinkText("");
    setLinkUrl("");
    setShowLinkDialog(false);
  }

  return (
    <div className="flex min-h-[460px] flex-col overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)]/70 shadow-sm">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-[color:var(--border)] bg-white/[0.035] px-2 py-1.5">
        <ToolBtn title="Heading 1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
          <Heading1 size={16} />
        </ToolBtn>
        <ToolBtn title="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 size={16} />
        </ToolBtn>
        <ToolBtn title="Heading 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          <Heading3 size={16} />
        </ToolBtn>

        <Separator />

        <ToolBtn title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold size={16} />
        </ToolBtn>
        <ToolBtn title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic size={16} />
        </ToolBtn>
        <ToolBtn title="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon size={16} />
        </ToolBtn>
        <ToolBtn title="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <Strikethrough size={16} />
        </ToolBtn>

        <Separator />

        <ColorTool
          title="Text color"
          color={activeColor ?? DEFAULT_TEXT_COLOR}
          onChange={applyTextColor}
          icon={<Palette size={16} />}
        />
        {activeColor && (
          <ToolBtn title="Reset text color" onClick={() => withSelection(() => editor.chain().unsetColor().run())}>
            <X size={14} />
          </ToolBtn>
        )}
        <ColorTool
          title="Highlight"
          color={DEFAULT_HIGHLIGHT_COLOR}
          active={editor.isActive("highlight")}
          onChange={applyHighlight}
          icon={<Highlighter size={16} />}
        />
        {editor.isActive("highlight") && (
          <ToolBtn title="Remove highlight" onClick={clearHighlight}>
            <Eraser size={15} />
          </ToolBtn>
        )}

        <Separator />

        <div className="flex h-8 items-center gap-1 rounded-md border border-[color:var(--border)] px-1 text-fg-muted">
          <button
            type="button"
            title="Smaller text"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => bumpFontSize(-1)}
            className="grid h-6 w-6 place-items-center rounded hover:bg-white/10 hover:text-fg"
          >
            <Minus size={14} />
          </button>
          <input
            type="number"
            min={1}
            step={1}
            value={fontSizeInput}
            onChange={(e) => {
              setFontSizeInput(e.target.value);
              applyFontSize(e.target.value);
            }}
            placeholder={DEFAULT_FONT_SIZE.toString()}
            title="Font size in pixels"
            className="h-6 w-12 bg-transparent text-center text-xs tabular-nums text-fg outline-none placeholder:text-fg-muted"
          />
          <button
            type="button"
            title="Larger text"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => bumpFontSize(1)}
            className="grid h-6 w-6 place-items-center rounded hover:bg-white/10 hover:text-fg"
          >
            <Plus size={14} />
          </button>
          {fontSizeInput && (
            <button
              type="button"
              title="Reset font size"
              onMouseDown={(e) => e.preventDefault()}
              onClick={resetFontSize}
              className="grid h-6 w-6 place-items-center rounded hover:bg-white/10 hover:text-fg"
            >
              <X size={13} />
            </button>
          )}
        </div>

        <Separator />

        <ToolBtn title="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List size={16} />
        </ToolBtn>
        <ToolBtn title="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered size={16} />
        </ToolBtn>

        <Separator />

        <ToolBtn title="Block quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote size={16} />
        </ToolBtn>
        <ToolBtn title="Horizontal rule" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <Minus size={16} />
        </ToolBtn>

        <Separator />

        <ToolBtn title="Align left" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
          <AlignLeft size={16} />
        </ToolBtn>
        <ToolBtn title="Align center" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}>
          <AlignCenter size={16} />
        </ToolBtn>

        <Separator />

        <div className="relative">
          <ToolBtn title={editor.isActive("link") ? "Remove link" : "Insert link"} active={editor.isActive("link")} onClick={openLinkDialog}>
            <Link2 size={16} />
          </ToolBtn>
          {showLinkDialog && (
            <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-xl">
              <div className="space-y-2">
                <input
                  type="text"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  placeholder="Display text (optional)"
                  className="input text-sm"
                  autoFocus
                />
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="input text-sm"
                  onKeyDown={(e) => { if (e.key === "Enter") insertLink(); }}
                />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setShowLinkDialog(false)} className="btn-ghost px-2.5 py-1 text-xs">Cancel</button>
                  <button type="button" onClick={insertLink} disabled={!linkUrl.trim()} className="btn-gold px-2.5 py-1 text-xs disabled:opacity-40">Insert</button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1" />

        <ToolBtn title="Clear formatting" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>
          <RemoveFormatting size={16} />
        </ToolBtn>
        <ToolBtn title="Undo" onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 size={16} />
        </ToolBtn>
        <ToolBtn title="Redo" onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 size={16} />
        </ToolBtn>
      </div>

      <div className="flex-1 overflow-y-auto bg-black/10">
        <EditorContent editor={editor} />
      </div>

      <div className="flex items-center gap-2 border-t border-[color:var(--border)] bg-white/[0.025] px-4 py-2 text-xs text-fg-muted">
        <BookOpen size={14} />
        <span>Prayer point editor</span>
      </div>
    </div>
  );
}

function ToolBtn({
  active, onClick, title, children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`grid h-8 w-8 place-items-center rounded-md transition-colors ${
        active
          ? "bg-[color:var(--gold)]/20 text-gold"
          : "text-fg-muted hover:bg-white/10 hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}

function Separator() {
  return <div className="mx-0.5 h-5 w-px bg-[color:var(--border)]" />;
}

function ColorTool({
  active, color, icon, onChange, title,
}: {
  active?: boolean;
  color: string;
  icon: React.ReactNode;
  onChange: (color: string) => void;
  title: string;
}) {
  return (
    <label
      title={title}
      className={`relative grid h-8 w-8 cursor-pointer place-items-center rounded-md transition-colors ${
        active
          ? "bg-[color:var(--gold)]/20 text-gold"
          : "text-fg-muted hover:bg-white/10 hover:text-fg"
      }`}
    >
      <input
        type="color"
        value={normalizeHexColor(color) ?? DEFAULT_TEXT_COLOR}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        tabIndex={-1}
      />
      {icon}
      <span className="absolute bottom-1 h-0.5 w-4 rounded-full" style={{ backgroundColor: color }} />
    </label>
  );
}

function normalizeHexColor(color: unknown) {
  if (typeof color !== "string") return null;
  const value = color.trim();
  const shortHex = /^#([0-9a-f]{3})$/i.exec(value);
  if (shortHex) return `#${shortHex[1].split("").map((ch) => ch + ch).join("")}`.toLowerCase();
  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase();
  const rgb = /^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/i.exec(value);
  if (!rgb) return null;
  return `#${rgb.slice(1, 4).map((part) => {
    const n = Math.max(0, Math.min(255, parseInt(part, 10)));
    return n.toString(16).padStart(2, "0");
  }).join("")}`;
}

function parseFontSize(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundFontSize(value: number) {
  return Math.round(value * 10) / 10;
}
