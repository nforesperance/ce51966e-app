/**
 * Creates (or resets) the first admin user.
 * Usage:  npx tsx scripts/bootstrap-admin.ts "Admin Name"
 *
 * Requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local.
 * Prints the generated 4-character login key — share it securely.
 */
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";

// Load .env.local manually (no dotenv dep).
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, "");
  }
}

const url = process.env.SUPABASE_URL!;
const srk = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !srk) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function genKey(len = 4) {
  const b = new Uint8Array(len);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => ALPHABET[x % ALPHABET.length]).join("");
}

async function main() {
  const name = process.argv[2] || "Site Admin";
  const sb = createClient(url, srk, { auth: { persistSession: false } });
  const key = genKey(4);
  const hash = await bcrypt.hash(key, 10);

  // If an admin already exists, reset their key rather than creating duplicates.
  const { data: existing } = await sb.from("users").select("id, full_name").eq("role", "admin").maybeSingle();
  if (existing) {
    await sb.from("users").update({
      login_key_hash: hash, login_key_hint: key[0] + "***", full_name: name, active: true,
    }).eq("id", existing.id);
    console.log(`Reset key for existing admin: ${existing.full_name}`);
  } else {
    const { error } = await sb.from("users").insert({
      full_name: name, role: "admin", level: "admin",
      login_key_hash: hash, login_key_hint: key[0] + "***",
    });
    if (error) { console.error(error); process.exit(1); }
    console.log(`Created admin: ${name}`);
  }
  console.log(`\n  Login key:  ${key}\n`);
  console.log("Save it now — it cannot be recovered.");
}
main();
