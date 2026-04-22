import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";

const Body = z.object({ program_id: z.string().uuid().nullable() });

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const res = NextResponse.json({ ok: true });
  if (parsed.data.program_id) {
    res.cookies.set("elmoan_program", parsed.data.program_id, {
      httpOnly: false, sameSite: "lax", path: "/",
      maxAge: 60 * 60 * 24 * 365,     // 1 year
    });
  } else {
    res.cookies.delete("elmoan_program");
  }
  return res;
}
