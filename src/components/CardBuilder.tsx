"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { ClipboardCopy, Download, Image as ImageIcon, RotateCcw, Share2, Star } from "lucide-react";
import CardControls from "@/components/CardControls";
import CardPreview from "@/components/CardPreview";
import PresetMenu from "@/components/PresetMenu";
import Popover from "@/components/ui/Popover";
import {
  describeCardConfig, diffCardConfig, pickCardConfig, resolveCardConfig,
  type CardConfig, type ResolvedCardConfig,
} from "@/lib/cardConfig";

type Scripture = { reference: string; text: string };
type Status = { kind: "ok" | "error"; text: string } | null;

const noopSubscribe = () => () => {};

export default function CardBuilder({
  programDefaults, overrides, onOverridesChange, onSaveProgramDefaults,
  groupName, dayNumber, title, bodyHtml, scriptures, filenameBase,
}: {
  programDefaults: CardConfig;
  overrides: CardConfig;
  onOverridesChange: (c: CardConfig) => void;
  onSaveProgramDefaults: (config: CardConfig, resetAllDays: boolean) => Promise<void>;
  groupName: string;
  dayNumber: number | null;
  title: string | null;
  bodyHtml: string | null;
  scriptures: Scripture[];
  filenameBase: string;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [busy, setBusy] = useState<null | "copy" | "share" | "download">(null);
  const [status, setStatus] = useState<Status>(null);
  const canShare = useSyncExternalStore(noopSubscribe, () => typeof navigator.share === "function", () => false);

  const base = resolveCardConfig(programDefaults);
  const config = resolveCardConfig(programDefaults, overrides);
  const overrideCount = Object.keys(diffCardConfig(config, base)).length;

  const setConfig = (next: ResolvedCardConfig) => onOverridesChange(diffCardConfig(next, base));
  const patch = (p: Partial<ResolvedCardConfig>) => setConfig({ ...config, ...p });

  function flash(next: Status) {
    setStatus(next);
    if (next) setTimeout(() => setStatus((s) => (s === next ? null : s)), 3500);
  }

  async function renderPng(): Promise<Blob> {
    if (!cardRef.current) throw new Error("Card not ready");
    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(cardRef.current, {
      scale: 3, backgroundColor: null, useCORS: true, logging: false,
    });
    return new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode PNG"))), "image/png"));
  }

  async function copyImage() {
    if (!window.isSecureContext || !navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
      flash({ kind: "error", text: "Image copy needs HTTPS — use Share or Download." });
      return;
    }
    setBusy("copy");
    try {
      // Pass the promise straight to ClipboardItem so Safari keeps the user gesture.
      await navigator.clipboard.write([new ClipboardItem({ "image/png": renderPng() })]);
      flash({ kind: "ok", text: "Copied — paste into WhatsApp" });
    } catch (e) {
      flash({ kind: "error", text: `Copy failed: ${e instanceof Error ? e.message : String(e)}` });
    } finally { setBusy(null); }
  }

  async function shareImage() {
    setBusy("share");
    try {
      const file = new File([await renderPng()], `${filenameBase}.png`, { type: "image/png" });
      if (navigator.canShare && !navigator.canShare({ files: [file] })) {
        flash({ kind: "error", text: "Sharing not supported here" });
        return;
      }
      await navigator.share({ files: [file], title: title ?? filenameBase });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      flash({ kind: "error", text: `Share failed: ${e instanceof Error ? e.message : String(e)}` });
    } finally { setBusy(null); }
  }

  async function download() {
    setBusy("download");
    try {
      const url = URL.createObjectURL(await renderPng());
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filenameBase}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      flash({ kind: "error", text: `Export failed: ${e instanceof Error ? e.message : String(e)}` });
    } finally { setBusy(null); }
  }

  async function saveAsProgramDefault(resetAllDays: boolean) {
    if (resetAllDays && !confirm("Apply this design to every day of the program?")) return;
    try {
      await onSaveProgramDefaults(pickCardConfig(config), resetAllDays);
      flash({ kind: "ok", text: resetAllDays ? "Applied to all days" : "Saved as default" });
    } catch (e) {
      flash({ kind: "error", text: e instanceof Error ? e.message : String(e) });
    }
  }

  const mappedScriptures = scriptures
    .filter((s) => s.reference.trim())
    .map((s) => ({ reference: s.reference.trim(), text: s.text?.trim() || null }));

  return (
    <section className="card p-4 sm:p-5">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <ImageIcon size={18} className="text-gold" /> Card design
        </h3>
        <span className="mr-auto">
          {overrideCount > 0 && (
            <button type="button" onClick={() => onOverridesChange({})} title="Reset to program default"
              className="flex items-center gap-1 rounded-full border border-[color:var(--gold)]/40 px-2 py-0.5 text-[11px] text-gold hover:border-[color:var(--gold)]">
              Customized <RotateCcw size={10} />
            </button>
          )}
        </span>
        <PresetMenu<CardConfig>
          kind="card"
          align="right"
          current={pickCardConfig(config)}
          describe={describeCardConfig}
          onApply={(c) => setConfig(resolveCardConfig(c))}
        />
        <Popover
          align="right"
          className="w-60 p-1.5"
          trigger={(open, toggle) => (
            <button type="button" onClick={toggle} aria-expanded={open}
              className="btn-ghost flex items-center gap-1.5 px-3 py-1.5 text-sm">
              <Star size={14} /> Default
            </button>
          )}
        >
          {(close) => (
            <div className="space-y-1 text-sm">
              <MenuItem onClick={() => { close(); saveAsProgramDefault(false); }} title="Save as program default" />
              <MenuItem onClick={() => { close(); saveAsProgramDefault(true); }} title="Save & apply to all days" />
              <MenuItem disabled={overrideCount === 0} onClick={() => { close(); onOverridesChange({}); }} title="Reset this day" />
            </div>
          )}
        </Popover>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
        {/* ---------- Controls ---------- */}
        <CardControls config={config} base={base} onChange={patch} groupName={groupName} />

        {/* ---------- Preview + export ---------- */}
        <div className="min-w-0 lg:sticky lg:top-4 lg:self-start">
          <div className="flex justify-center overflow-x-auto rounded-xl bg-black/20 p-4">
            <CardPreview
              ref={cardRef}
              config={config}
              groupName={groupName}
              dayNumber={dayNumber}
              title={title}
              bodyHtml={bodyHtml}
              scriptures={mappedScriptures}
            />
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={copyImage} disabled={!!busy} className="btn-gold flex items-center gap-2 px-4 py-2 text-sm">
              <ClipboardCopy size={15} /> {busy === "copy" ? "Copying…" : "Copy image"}
            </button>
            {canShare && (
              <button type="button" onClick={shareImage} disabled={!!busy} className="btn-ghost flex items-center gap-2 px-4 py-2 text-sm">
                <Share2 size={15} /> {busy === "share" ? "Preparing…" : "Share"}
              </button>
            )}
            <button type="button" onClick={download} disabled={!!busy} className="btn-ghost flex items-center gap-2 px-4 py-2 text-sm">
              <Download size={15} /> {busy === "download" ? "Rendering…" : "Download PNG"}
            </button>
          </div>
          <p role="status" className={`mt-2 min-h-[1.25rem] text-center text-xs ${
            status?.kind === "error" ? "text-[color:var(--danger)]" : "text-[color:var(--ok)]"
          }`}>
            {status?.text}
          </p>
        </div>
      </div>
    </section>
  );
}

function MenuItem({ title, onClick, disabled }: {
  title: string; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="block w-full rounded-md px-2 py-1.5 text-left hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent">
      <span className="block text-fg">{title}</span>
    </button>
  );
}
