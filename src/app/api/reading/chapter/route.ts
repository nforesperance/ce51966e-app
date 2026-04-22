import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { fetchChapter, minDwellSeconds } from "@/lib/bibleApi";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ref = req.nextUrl.searchParams.get("ref");
  const translation = req.nextUrl.searchParams.get("translation") || "kjv";
  if (!ref) return NextResponse.json({ error: "ref required" }, { status: 400 });

  try {
    const ch = await fetchChapter(ref, translation);
    // Pick a random verse for the recall prompt. Deterministic per request so
    // the client can echo it back without re-randomizing.
    const totalVerses = ch.verses.length;
    const recallVerse = totalVerses > 0
      ? ch.verses[Math.floor(Math.random() * totalVerses)].verse
      : null;
    return NextResponse.json({
      reference: ch.reference,
      translation: ch.translation,
      verses: ch.verses,
      word_count: ch.word_count,
      min_dwell_seconds: minDwellSeconds(ch.word_count),
      recall_verse: recallVerse,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fetch failed" },
      { status: 502 }
    );
  }
}
