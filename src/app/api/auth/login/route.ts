import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateLoginKey, getSessionUser } from "@/lib/auth/session";

const Body = z.object({ key: z.string().min(4).max(12) });

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const ua = req.headers.get("user-agent") ?? undefined;
  const result = await authenticateLoginKey(parsed.data.key, ua);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 401 });
  const user = await getSessionUser();
  return NextResponse.json({
    ok: true,
    redirect: user?.role === "admin" ? "/admin" : "/today",
  });
}
