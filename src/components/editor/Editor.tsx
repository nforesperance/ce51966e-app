"use client";

import { EditorContent, useEditor, useEditorState, type Editor as TiptapEditor } from "@tiptap/react";
import type { Mark as PMMark } from "@tiptap/pm/model";
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Baseline, Bold, ChevronDown,
  Highlighter, IndentDecrease, IndentIncrease, Italic, Link2, List, ListOrdered,
  Minus, Paintbrush, Redo2, RemoveFormatting, Strikethrough, Underline as UnderlineIcon,
  Undo2, Unlink, AArrowDown, AArrowUp,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import Popover from "@/components/ui/Popover";
import ColorSplitButton from "@/components/editor/ColorSplitButton";
import { documentColors, normalizeHexColor } from "@/lib/colors";
import {
  DEFAULT_FONT_SIZE, DEFAULT_HIGHLIGHT_COLOR, DEFAULT_TEXT_COLOR, FONT_FAMILIES, FONT_SIZES,
  buildExtensions, matchFontFamily, parseFontSize, stepFontSize,
} from "@/components/editor/extensions";

const MOD = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";

export default function Editor({
  value, onChange, placeholder = "Write the prayer point…",
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const shortcutRef = useRef<(e: KeyboardEvent) => boolean>(() => false);

  const editor = useEditor({
    extensions: buildExtensions(placeholder),
    content: value || "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "prose-prayer tiptap min-h-[320px] outline-none px-6 py-5 sm:px-8 sm:py-7 text-[15px] leading-relaxed",
      },
      handleKeyDown: (_view, event) => shortcutRef.current(event),
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Keep in sync when the parent replaces the content (e.g. after a reload).
  useEffect(() => {
    if (editor && value !== editor.getHTML()) editor.commands.setContent(value || "", { emitUpdate: false });
  }, [editor, value]);

  if (!editor) {
    return <div className="min-h-[460px] animate-pulse rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)]/50" />;
  }
  return <EditorBody editor={editor} shortcutRef={shortcutRef} />;
}

/**
 * Mounted only once the editor exists: useEditorState captures its editor on
 * first render and won't pick up a late one until the next transaction.
 */
function EditorBody({ editor, shortcutRef }: {
  editor: TiptapEditor;
  shortcutRef: React.RefObject<(e: KeyboardEvent) => boolean>;
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [painter, setPainter] = useState<readonly PMMark[] | null>(null);

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const textStyle = e.getAttributes("textStyle");
      const level = ([1, 2, 3] as const).find((l) => e.isActive("heading", { level: l }));
      return {
        bold: e.isActive("bold"),
        italic: e.isActive("italic"),
        underline: e.isActive("underline"),
        strike: e.isActive("strike"),
        bulletList: e.isActive("bulletList"),
        orderedList: e.isActive("orderedList"),
        blockquote: e.isActive("blockquote"),
        link: e.isActive("link"),
        highlight: e.isActive("highlight") ? normalizeHexColor(e.getAttributes("highlight").color) ?? DEFAULT_HIGHLIGHT_COLOR : null,
        color: normalizeHexColor(textStyle.color),
        fontSize: parseFontSize(textStyle.fontSize),
        fontFamily: matchFontFamily(textStyle.fontFamily),
        align: (["center", "right", "justify"] as const).find((a) => e.isActive({ textAlign: a })) ?? "left",
        style: level ? `h${level}` : "p",
        canUndo: e.can().undo(),
        canRedo: e.can().redo(),
        canIndent: e.can().sinkListItem("listItem"),
        canOutdent: e.can().liftListItem("listItem"),
        words: e.storage.characterCount.words(),
        characters: e.storage.characterCount.characters(),
      };
    },
  });

  // Format painter: copy marks from the selection, paint them onto the next one.
  useEffect(() => {
    if (!painter) return;
    const dom = editor.view.dom;
    const onUp = () => requestAnimationFrame(() => {
      const { from, to, empty } = editor.state.selection;
      if (empty) return;
      const tr = editor.state.tr;
      Object.values(editor.schema.marks).forEach((type) => {
        if (type.name !== "link") tr.removeMark(from, to, type);
      });
      painter.forEach((m) => tr.addMark(from, to, m));
      editor.view.dispatch(tr);
      setPainter(null);
    });
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPainter(null); };
    dom.addEventListener("mouseup", onUp);
    document.addEventListener("keydown", onKey);
    return () => {
      dom.removeEventListener("mouseup", onUp);
      document.removeEventListener("keydown", onKey);
    };
  }, [editor, painter]);

  const docHtml = editor.getHTML();
  const docTextColors = useMemo(() => documentColors(docHtml, "text"), [docHtml]);
  const docHighlightColors = useMemo(() => documentColors(docHtml, "highlight"), [docHtml]);

  useEffect(() => {
    shortcutRef.current = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return false;
      const key = e.key;
      if (key.toLowerCase() === "k" && !e.shiftKey) { setLinkOpen(true); return true; }
      if (key === "]" || (e.shiftKey && (key === ">" || key === "."))) { bumpFontSize(editor, 1); return true; }
      if (key === "[" || (e.shiftKey && (key === "<" || key === ","))) { bumpFontSize(editor, -1); return true; }
      if (key === " " ) { editor.chain().focus().unsetAllMarks().run(); return true; }
      return false;
    };
  }, [editor, shortcutRef]);

  const chain = () => editor.chain().focus();

  const startPainter = () => {
    if (painter) { setPainter(null); return; }
    const { $from, empty } = editor.state.selection;
    const marks = (empty ? editor.state.storedMarks ?? $from.marks() : $from.marks())
      .filter((m) => m.type.name !== "link");
    setPainter(marks);
  };

  return (
    <div className="flex flex-col rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)]/70 shadow-sm">
      {/* ---------- Ribbon ---------- */}
      <div className="flex flex-wrap items-stretch gap-x-1 gap-y-2 rounded-t-xl border-b border-[color:var(--border)] bg-white/[0.035] px-2 py-2">
        <Group label="Edit">
          <Row>
            <ToolBtn title={`Undo (${MOD}+Z)`} disabled={!state.canUndo} onClick={() => chain().undo().run()}><Undo2 size={16} /></ToolBtn>
            <ToolBtn title={`Redo (${MOD}+Shift+Z)`} disabled={!state.canRedo} onClick={() => chain().redo().run()}><Redo2 size={16} /></ToolBtn>
          </Row>
          <Row>
            <ToolBtn
              title="Format painter"
              active={!!painter}
              onClick={startPainter}
            >
              <Paintbrush size={16} />
            </ToolBtn>
            <ToolBtn title={`Clear formatting (${MOD}+Space)`} onClick={() => chain().unsetAllMarks().clearNodes().unsetTextAlign().run()}>
              <RemoveFormatting size={16} />
            </ToolBtn>
          </Row>
        </Group>

        <Divider />

        <Group label="Font">
          <Row>
            <select
              title="Font"
              value={state.fontFamily ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                if (v) chain().setFontFamily(v).run();
                else chain().unsetFontFamily().run();
              }}
              className="h-8 w-[132px] rounded-md border border-[color:var(--border)] bg-white/5 px-2 text-xs text-fg outline-none [color-scheme:dark] focus:border-[color:var(--gold)]"
            >
              {FONT_FAMILIES.map((f) => (
                <option key={f.label} value={f.value ?? ""} style={{ fontFamily: f.value ?? undefined }}>{f.label}</option>
              ))}
              {state.fontFamily && !FONT_FAMILIES.some((f) => f.value === state.fontFamily) && (
                <option value={state.fontFamily}>{state.fontFamily.split(",")[0].replace(/["']/g, "")}</option>
              )}
            </select>
            <FontSizeBox editor={editor} size={state.fontSize} />
            <ToolBtn title={`Grow font (${MOD}+])`} onClick={() => bumpFontSize(editor, 1)}><AArrowUp size={16} /></ToolBtn>
            <ToolBtn title={`Shrink font (${MOD}+[)`} onClick={() => bumpFontSize(editor, -1)}><AArrowDown size={16} /></ToolBtn>
          </Row>
          <Row>
            <ToolBtn title={`Bold (${MOD}+B)`} active={state.bold} onClick={() => chain().toggleBold().run()}><Bold size={16} /></ToolBtn>
            <ToolBtn title={`Italic (${MOD}+I)`} active={state.italic} onClick={() => chain().toggleItalic().run()}><Italic size={16} /></ToolBtn>
            <ToolBtn title={`Underline (${MOD}+U)`} active={state.underline} onClick={() => chain().toggleUnderline().run()}><UnderlineIcon size={16} /></ToolBtn>
            <ToolBtn title={`Strikethrough (${MOD}+Shift+S)`} active={state.strike} onClick={() => chain().toggleStrike().run()}><Strikethrough size={16} /></ToolBtn>
            <span className="mx-0.5" />
            <ColorSplitButton
              kind="highlight"
              title="Text highlight color"
              icon={<Highlighter size={16} />}
              defaultColor={DEFAULT_HIGHLIGHT_COLOR}
              currentColor={state.highlight}
              documentColors={docHighlightColors}
              onApply={(c) => chain().setHighlight(c).run()}
              onClear={() => chain().unsetHighlight().run()}
            />
            <ColorSplitButton
              kind="text"
              title="Font color"
              icon={<Baseline size={16} />}
              defaultColor={DEFAULT_TEXT_COLOR}
              currentColor={state.color}
              documentColors={docTextColors}
              onApply={(c) => chain().setColor(c).run()}
              onClear={() => chain().unsetColor().run()}
            />
          </Row>
        </Group>

        <Divider />

        <Group label="Paragraph">
          <Row>
            <ToolBtn title={`Bullets (${MOD}+Shift+8)`} active={state.bulletList} onClick={() => chain().toggleBulletList().run()}><List size={16} /></ToolBtn>
            <ToolBtn title={`Numbering (${MOD}+Shift+7)`} active={state.orderedList} onClick={() => chain().toggleOrderedList().run()}><ListOrdered size={16} /></ToolBtn>
            <ToolBtn title="Decrease indent (Shift+Tab)" disabled={!state.canOutdent} onClick={() => chain().liftListItem("listItem").run()}><IndentDecrease size={16} /></ToolBtn>
            <ToolBtn title="Increase indent (Tab)" disabled={!state.canIndent} onClick={() => chain().sinkListItem("listItem").run()}><IndentIncrease size={16} /></ToolBtn>
          </Row>
          <Row>
            <ToolBtn title={`Align left (${MOD}+Shift+L)`} active={state.align === "left"} onClick={() => chain().setTextAlign("left").run()}><AlignLeft size={16} /></ToolBtn>
            <ToolBtn title={`Center (${MOD}+Shift+E)`} active={state.align === "center"} onClick={() => chain().setTextAlign("center").run()}><AlignCenter size={16} /></ToolBtn>
            <ToolBtn title={`Align right (${MOD}+Shift+R)`} active={state.align === "right"} onClick={() => chain().setTextAlign("right").run()}><AlignRight size={16} /></ToolBtn>
            <ToolBtn title={`Justify (${MOD}+Shift+J)`} active={state.align === "justify"} onClick={() => chain().setTextAlign("justify").run()}><AlignJustify size={16} /></ToolBtn>
          </Row>
        </Group>

        <Divider />

        <Group label="Styles">
          <div className="grid grid-cols-3 gap-1 sm:grid-cols-5 sm:grid-rows-1">
            <StyleTile label="Normal" active={state.style === "p" && !state.blockquote} onClick={() => chain().setParagraph().run()}>
              <span className="text-[12px]">AaBb</span>
            </StyleTile>
            <StyleTile label="Heading 1" active={state.style === "h1"} onClick={() => chain().toggleHeading({ level: 1 }).run()}>
              <span className="text-[15px] font-bold text-gold-soft">AaB</span>
            </StyleTile>
            <StyleTile label="Heading 2" active={state.style === "h2"} onClick={() => chain().toggleHeading({ level: 2 }).run()}>
              <span className="text-[13px] font-semibold text-gold-soft">AaBb</span>
            </StyleTile>
            <StyleTile label="Heading 3" active={state.style === "h3"} onClick={() => chain().toggleHeading({ level: 3 }).run()}>
              <span className="text-[12px] font-semibold text-gold-soft">AaBb</span>
            </StyleTile>
            <StyleTile label="Quote" active={state.blockquote} onClick={() => chain().toggleBlockquote().run()}>
              <span className="border-l-2 border-[color:var(--gold)] pl-1 text-[12px] italic text-fg-muted">AaBb</span>
            </StyleTile>
          </div>
        </Group>

        <Divider />

        <Group label="Insert">
          <Row>
            <LinkButton editor={editor} active={state.link} open={linkOpen} onOpenChange={setLinkOpen} />
            {state.link && (
              <ToolBtn title="Remove link" onClick={() => chain().extendMarkRange("link").unsetLink().run()}><Unlink size={16} /></ToolBtn>
            )}
          </Row>
          <Row>
            <ToolBtn title="Horizontal line" onClick={() => chain().setHorizontalRule().run()}><Minus size={16} /></ToolBtn>
          </Row>
        </Group>
      </div>

      {/* ---------- Page ---------- */}
      <div className={`max-h-[70vh] min-h-[360px] overflow-y-auto bg-black/25 px-2 py-4 sm:px-6 sm:py-6 ${painter ? "[&_.tiptap]:cursor-copy" : ""}`}>
        <div className="mx-auto max-w-[760px] rounded-md border border-white/5 bg-[color:var(--bg-2)] shadow-[0_6px_24px_rgba(0,0,0,0.35)]">
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* ---------- Status bar ---------- */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-b-xl border-t border-[color:var(--border)] bg-white/[0.025] px-4 py-1.5 text-[11px] text-fg-muted">
        <span className="tabular-nums">{state.words} {state.words === 1 ? "word" : "words"}</span>
        <span className="tabular-nums">{state.characters} characters</span>
        {painter && <span className="text-gold">Format painter · Esc to cancel</span>}
      </div>
    </div>
  );
}

function bumpFontSize(editor: TiptapEditor, direction: 1 | -1) {
  const current = parseFontSize(editor.getAttributes("textStyle").fontSize) ?? DEFAULT_FONT_SIZE;
  editor.chain().focus().setFontSize(`${stepFontSize(current, direction)}px`).run();
}

function FontSizeBox({ editor, size }: { editor: TiptapEditor; size: number | null }) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (size != null ? String(size) : "");

  function commit(raw: string) {
    setDraft(null);
    const n = parseFloat(raw);
    if (!raw.trim()) { editor.chain().focus().unsetFontSize().run(); return; }
    if (!Number.isFinite(n) || n <= 0 || n > 200) return;
    editor.chain().focus().setFontSize(`${Math.round(n * 10) / 10}px`).run();
  }

  return (
    <Popover
      className="w-24 p-1"
      trigger={(open, toggle) => (
        <div className="flex h-8 items-stretch rounded-md border border-[color:var(--border)] bg-white/5 focus-within:border-[color:var(--gold)]">
          <input
            value={shown}
            inputMode="decimal"
            placeholder={String(DEFAULT_FONT_SIZE)}
            title="Font size (px) — type and press Enter"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); commit(shown); }
              if (e.key === "Escape") setDraft(null);
            }}
            onBlur={() => { if (draft != null) commit(draft); }}
            className="w-10 bg-transparent text-center text-xs tabular-nums text-fg outline-none placeholder:text-fg-muted"
          />
          <button
            type="button"
            title="Font sizes"
            aria-expanded={open}
            onMouseDown={(e) => e.preventDefault()}
            onClick={toggle}
            className="grid w-5 place-items-center border-l border-[color:var(--border)] text-fg-muted hover:text-fg"
          >
            <ChevronDown size={12} />
          </button>
        </div>
      )}
    >
      {(close) => (
        <div className="max-h-64 overflow-y-auto">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { editor.chain().focus().unsetFontSize().run(); close(); }}
            className="w-full rounded px-2 py-1 text-left text-xs text-fg-muted hover:bg-white/10"
          >
            Default
          </button>
          {FONT_SIZES.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { editor.chain().focus().setFontSize(`${s}px`).run(); close(); }}
              className={`w-full rounded px-2 py-1 text-left text-xs tabular-nums hover:bg-white/10 ${
                size === s ? "bg-[color:var(--gold)]/20 text-gold" : "text-fg"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </Popover>
  );
}

function LinkButton({ editor, active, open, onOpenChange }: {
  editor: TiptapEditor; active: boolean; open: boolean; onOpenChange: (open: boolean) => void;
}) {
  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      className="w-72"
      trigger={(_o, toggle) => (
        <ToolBtn title={`${active ? "Edit link" : "Insert link"} (${MOD}+K)`} active={active} onClick={toggle}>
          <Link2 size={16} />
        </ToolBtn>
      )}
    >
      {(close) => <LinkForm editor={editor} active={active} onDone={close} />}
    </Popover>
  );
}

/** Mounted each time the link popover opens, so it prefills from the current selection. */
function LinkForm({ editor, active, onDone }: { editor: TiptapEditor; active: boolean; onDone: () => void }) {
  const [originalText] = useState(() => {
    const { from, to } = editor.state.selection;
    return from !== to ? editor.state.doc.textBetween(from, to) : "";
  });
  const [text, setText] = useState(originalText);
  const [url, setUrl] = useState(() => (editor.getAttributes("link").href as string | undefined) ?? "");

  function apply() {
    const trimmed = url.trim();
    if (!trimmed) return;
    const href = /^(https?:|mailto:|tel:)/i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const label = text.trim();
    const { empty } = editor.state.selection;
    if (active && (!label || label === originalText)) {
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    } else if (label && (empty || label !== originalText)) {
      editor.chain().focus().insertContent({
        type: "text", text: label, marks: [{ type: "link", attrs: { href } }],
      }).run();
    } else if (!empty) {
      editor.chain().focus().setLink({ href }).run();
    } else {
      editor.chain().focus().insertContent({
        type: "text", text: href, marks: [{ type: "link", attrs: { href } }],
      }).run();
    }
    onDone();
  }

  return (
    <div className="space-y-2">
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Text to display" className="input py-2 text-sm" />
      <input
        type="url"
        value={url}
        autoFocus
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://example.com"
        className="input py-2 text-sm"
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); apply(); } }}
      />
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onDone} className="btn-ghost px-3 py-1 text-xs">Cancel</button>
        <button type="button" onClick={apply} disabled={!url.trim()} className="btn-gold px-3 py-1 text-xs">
          {active ? "Update" : "Insert"}
        </button>
      </div>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-col justify-center gap-1 px-1">
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-0.5">{children}</div>;
}

function Divider() {
  return <div className="my-1 hidden w-px self-stretch bg-[color:var(--border)] sm:block" />;
}

function ToolBtn({ active, disabled, onClick, title, children }: {
  active?: boolean; disabled?: boolean; onClick: () => void; title: string; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`grid h-8 w-8 place-items-center rounded-md transition-colors disabled:opacity-30 disabled:hover:bg-transparent ${
        active ? "bg-[color:var(--gold)]/20 text-gold" : "text-fg-muted hover:bg-white/10 hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}

function StyleTile({ label, active, onClick, children }: {
  label: string; active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex h-[60px] w-[64px] flex-col items-center justify-center gap-1 rounded-md border px-1 transition-colors ${
        active
          ? "border-[color:var(--gold)] bg-[color:var(--gold)]/10"
          : "border-[color:var(--border)] bg-white/[0.03] hover:border-[color:var(--gold)]/60"
      }`}
    >
      {children}
      <span className="text-[10px] text-fg-muted">{label}</span>
    </button>
  );
}
