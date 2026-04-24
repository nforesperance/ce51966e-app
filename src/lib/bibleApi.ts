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
  const first = text.trim().split(/\s+/)[0] ?? "";
  return normalizeWord(first);
}

// Suggested minimum dwell time to read the chapter — slow attentive read.
const WORDS_PER_MINUTE = 80;
export function minDwellSeconds(wordCount: number): number {
  const est = Math.ceil((wordCount / WORDS_PER_MINUTE) * 60);
  return Math.max(30, Math.min(est, 600)); // bounded [30s, 10m]
}
