import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { fetchChapter, minDwellSeconds, pickRecall } from "@/lib/bibleApi";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ref = req.nextUrl.searchParams.get("ref");
  const translation = req.nextUrl.searchParams.get("translation") || "kjv";
  if (!ref) return NextResponse.json({ error: "ref required" }, { status: 400 });

  try {
    const ch = await fetchChapter(ref, translation);
    const recall = pickRecall(ch.verses);
    return NextResponse.json({
      reference: ch.reference,
      translation: ch.translation,
      verses: ch.verses,
      word_count: ch.word_count,
      min_dwell_seconds: minDwellSeconds(ch.word_count),
      recall_verse: recall?.verse ?? null,
      recall_word_kind: recall?.word_kind ?? null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fetch failed" },
      { status: 502 }
    );
  }
}
