import "server-only";

// Uses https://bible-api.com — free, no key. Supported translations we expose:
// 'kjv' (King James), 'web' (World English Bible).
const BASE = "https://bible-api.com";
const ALLOWED = new Set(["kjv", "web"]);

export type BibleVerse = { verse: number; text: string };
export type BibleChapter = {
  reference: string;       // as echoed by the API
  translation: string;
  verses: BibleVerse[];
  text_full: string;
  word_count: number;
};

export async function fetchChapter(reference: string, translation: string): Promise<BibleChapter> {
  const t = ALLOWED.has(translation) ? translation : "kjv";
  const q = encodeURIComponent(reference.trim());
  const url = `${BASE}/${q}?translation=${t}`;
  // Cache forever — the same chapter reference never changes.
  const res = await fetch(url, { next: { revalidate: 31_536_000 } });
  if (!res.ok) throw new Error(`Bible API ${res.status}: ${reference}`);
  const json = (await res.json()) as {
    reference: string;
    translation_id?: string;
    verses: { verse: number; text: string }[];
  };

  const verses = (json.verses ?? []).map((v) => ({
    verse: v.verse,
    text: v.text.replace(/\s+/g, " ").trim(),
  }));
  const text_full = verses.map((v) => v.text).join(" ");
  const word_count = text_full.split(/\s+/).filter(Boolean).length;

  return {
    reference: json.reference || reference,
    translation: json.translation_id ?? t,
    verses,
    text_full,
    word_count,
  };
}

// Normalize a word for the recall check.
// Lowercase, strip diacritics, drop ALL non-letter/digit characters.
// "Blessed!" / "blessed" / "  Blessed  " / "BLÉSSÉD" all collapse to "blessed".
export function normalizeWord(w: string) {
  return w
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")     // strip combining diacritics
    .replace(/[‘’‚‛]/g, "'") // curly → straight apostrophe
    .replace(/[^a-z0-9]/g, "");          // drop everything else
}

export function firstWord(text: string): string {
  return getNthWord(text, "first");
}

export type WordKind = "first" | "second" | "third" | "last";

export const WORD_KIND_LABEL: Record<WordKind, string> = {
  first: "first", second: "second", third: "third", last: "last",
};

export function getNthWord(text: string, kind: WordKind): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  switch (kind) {
    case "first":  return normalizeWord(words[0]);
    case "second": return normalizeWord(words[1] ?? "");
    case "third":  return normalizeWord(words[2] ?? "");
    case "last":   return normalizeWord(words[words.length - 1]);
  }
}

// Pick a verse and a question variant for the recall prompt.
// Bias toward "second" and "last" so it's unpredictable, but only choose
// a variant the verse can actually answer (e.g. no "third" if it has 2 words).
export function pickRecall(verses: BibleVerse[]): { verse: number; word_kind: WordKind } | null {
  if (verses.length === 0) return null;
  const v = verses[Math.floor(Math.random() * verses.length)];
  const words = v.text.trim().split(/\s+/).filter(Boolean);
  const allowed: WordKind[] = ["first", "last"];
  if (words.length >= 2) allowed.push("second");
  if (words.length >= 3) allowed.push("third");
  const word_kind = allowed[Math.floor(Math.random() * allowed.length)];
  return { verse: v.verse, word_kind };
}

// Suggested minimum dwell time to read the chapter — slow attentive read.
const WORDS_PER_MINUTE = 400;
export function minDwellSeconds(wordCount: number): number {
  const est = Math.ceil((wordCount / WORDS_PER_MINUTE) * 60);
  return Math.max(30, Math.min(est, 600)); // bounded [30s, 10m]
}
