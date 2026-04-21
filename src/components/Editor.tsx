"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle, Color, FontSize } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import {
  Bold, Italic, List, ListOrdered, Quote, Heading2, Undo2, Redo2,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
} from "lucide-react";
import { useEffect, useRef } from "react";

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

  const sizeInput = useRef<HTMLInputElement | null>(null);

  if (!editor) return null;

  const Btn = ({ onClick, active, children, title }: {
    onClick: () => void; active?: boolean; children: React.ReactNode; title: string;
  }) => (
    <button type="button" title={title} onClick={onClick}
      className={`p-1.5 rounded hover:bg-white/5 ${active ? "text-gold" : "text-fg-muted"}`}>
      {children}
    </button>
  );

  function applyFontSize() {
    const raw = sizeInput.current?.value?.trim();
    if (!raw) return;
    const num = parseInt(raw, 10);
    if (!num || num < 6 || num > 96) return;
    (editor!.chain().focus() as unknown as { setFontSize: (v: string) => { run: () => void } })
      .setFontSize(`${num}px`).run();
  }

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

        <div className="flex items-center gap-1 text-xs text-fg-muted">
          <span>Size</span>
          <input
            ref={sizeInput}
            type="number" min={6} max={96} placeholder="14"
            defaultValue={14}
            className="w-12 text-center bg-transparent border border-[color:var(--border)] rounded px-1 py-0.5 text-fg"
          />
          <button type="button" onClick={applyFontSize}
            className="px-2 py-0.5 bg-gold text-[color:#111a3a] rounded text-[11px] font-semibold">
            Apply
          </button>
        </div>

        <span className="mx-1 h-4 w-px bg-[color:var(--border)]" />

        <label className="flex items-center gap-1 text-xs text-fg-muted cursor-pointer">
          <span>Color</span>
          <input
            type="color"
            onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
            className="h-6 w-6 rounded cursor-pointer border border-[color:var(--border)] bg-transparent p-0"
          />
          <button type="button" className="text-fg-muted hover:text-gold underline"
            onClick={() => editor.chain().focus().unsetColor().run()}>
            reset
          </button>
        </label>

        <div className="flex-1" />

        <Btn title="Undo" onClick={() => editor.chain().focus().undo().run()}><Undo2 size={15} /></Btn>
        <Btn title="Redo" onClick={() => editor.chain().focus().redo().run()}><Redo2 size={15} /></Btn>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
