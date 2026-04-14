What you need to do now
Run the migration. Open Supabase SQL editor → paste supabase/migrations/0001_init.sql → run.
Create a Storage bucket called prayer-images (public).
Fill .env.local: add these two I don't have yet:
SUPABASE_SERVICE_ROLE_KEY — Supabase → Project Settings → API → service_role
SESSION_SECRET — run openssl rand -base64 48 and paste the output
Bootstrap admin: npm run bootstrap:admin -- "Your Name" — it prints a 4-char key; save it.
Run: npm run dev → http://localhost:3000 → enter key → lands on /admin.

User management milestone is in. Hot reload should pick everything up (no restart needed). Go to /admin/users and try it.

What you can do now:

Add user — name + phone + whatsapp + level. Key is generated and shown once in a reveal dialog with Copy key, Copy WhatsApp message, and Open WhatsApp (auto-prefilled with the message to the user's number).
Import CSV — columns: name (required), phone, whatsapp, level. All generated keys are revealed at once so you can send them before closing.
Edit — name / phone / whatsapp / level / active toggle.
Reset key — generates a new one, invalidates old sessions, reveals the new key once.
Delete — participants only (admins protected).
Search — by name/phone/level.