import "server-only";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabase/admin";

const COOKIE_NAME = "elmoan_session";
const SESSION_DAYS = 30;

function sha256(v: string) {
  return crypto.createHash("sha256").update(v).digest("hex");
}

function randomToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export async function createSession(userId: string, userAgent?: string) {
  const token = randomToken();
  const token_hash = sha256(token);
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  const { error } = await supabaseAdmin().from("sessions").insert({
    user_id: userId,
    token_hash,
    expires_at: expires.toISOString(),
    user_agent: userAgent ?? null,
  });
  if (error) throw error;
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    // Only mark Secure when actually served over HTTPS. Browsers reject
    // Secure cookies on HTTP, which breaks LAN/preview testing.
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export type SessionUser = {
  id: string;
  full_name: string;
  role: "admin" | "participant";
  level: string | null;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const token_hash = sha256(token);
  const sb = supabaseAdmin();
  const { data: session } = await sb
    .from("sessions")
    .select("user_id, expires_at")
    .eq("token_hash", token_hash)
    .maybeSingle();
  if (!session) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) return null;
  const { data: user } = await sb
    .from("users")
    .select("id, full_name, role, level, active")
    .eq("id", session.user_id)
    .maybeSingle();
  if (!user || !user.active) return null;
  return {
    id: user.id,
    full_name: user.full_name,
    role: user.role,
    level: user.level,
  };
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (token) {
    await supabaseAdmin().from("sessions").delete().eq("token_hash", sha256(token));
  }
  jar.delete(COOKIE_NAME);
}

export async function authenticateLoginKey(loginKey: string, userAgent?: string) {
  const key = loginKey.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,12}$/.test(key)) return { ok: false as const, error: "Invalid key format" };
  // Load candidate users (we don't know which one; keys are short so we scan active users).
  const { data: users, error } = await supabaseAdmin()
    .from("users")
    .select("id, login_key_hash, active")
    .eq("active", true);
  if (error) throw error;
  for (const u of users ?? []) {
    if (await bcrypt.compare(key, u.login_key_hash)) {
      await createSession(u.id, userAgent);
      await supabaseAdmin().from("users").update({ last_login_at: new Date().toISOString() }).eq("id", u.id);
      return { ok: true as const, userId: u.id };
    }
  }
  return { ok: false as const, error: "Key not recognized" };
}

export async function hashLoginKey(key: string) {
  return bcrypt.hash(key.trim().toUpperCase(), 10);
}

export function loginKeyHint(key: string) {
  const k = key.trim().toUpperCase();
  return k.slice(0, 1) + "***";
}
