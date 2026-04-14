"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, List, ListOrdered, Quote, Heading2, Undo2, Redo2 } from "lucide-react";
import { useEffect } from "react";

export default function Editor({
  value, onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] } })],
    content: value || "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "prose-prayer min-h-[180px] outline-none px-4 py-3 text-[15px] leading-relaxed",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Keep editor in sync if parent resets the value (e.g. after save).
  useEffect(() => {
    if (editor && value !== editor.getHTML()) editor.commands.setContent(value || "", { emitUpdate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!editor) return null;

  const Btn = ({
    onClick, active, children, title,
  }: { onClick: () => void; active?: boolean; children: React.ReactNode; title: string }) => (
    <button type="button" title={title} onClick={onClick}
      className={`p-1.5 rounded hover:bg-white/5 ${active ? "text-gold" : "text-fg-muted"}`}>
      {children}
    </button>
  );

  return (
    <div className="border border-[color:var(--border)] rounded-xl overflow-hidden bg-white/5">
      <div className="flex items-center gap-1 px-2 py-1 border-b border-[color:var(--border)]">
        <Btn title="Bold" onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")}><Bold size={15} /></Btn>
        <Btn title="Italic" onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")}><Italic size={15} /></Btn>
        <Btn title="Heading" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })}><Heading2 size={15} /></Btn>
        <Btn title="Bullet list" onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")}><List size={15} /></Btn>
        <Btn title="Numbered list" onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")}><ListOrdered size={15} /></Btn>
        <Btn title="Quote" onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")}><Quote size={15} /></Btn>
        <div className="flex-1" />
        <Btn title="Undo" onClick={() => editor.chain().focus().undo().run()}><Undo2 size={15} /></Btn>
        <Btn title="Redo" onClick={() => editor.chain().focus().redo().run()}><Redo2 size={15} /></Btn>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
