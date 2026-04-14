# Elmoan — Prayer & Bible Study

Mobile-first web app for daily prayer points, Bible study tasks, and progress tracking.

- **Frontend/server:** Next.js 16 (App Router, TypeScript)
- **Backend:** Supabase (Postgres + Storage)
- **Auth:** custom — short (4-char) login keys, opaque server session cookies
- **Deploy target:** Vercel (free tier)

---

## 1. Supabase setup

1. Create a project at https://supabase.com.
2. In the SQL editor, paste and run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
3. **Settings → API** — copy three values:
   - `Project URL`
   - `anon` public key
   - `service_role` secret key (keep private — server-only)

### Storage bucket (for prayer point images)

In **Storage**, create a public bucket named `prayer-images`. We'll wire uploads to it in a later milestone.

---

## 2. Environment variables

Copy `.env.example` → `.env.local` and fill:

```env
SUPABASE_URL="https://xxxx.supabase.co"
SUPABASE_KEY="eyJ...anon..."             # safe to expose to browser
SUPABASE_SERVICE_ROLE_KEY="eyJ...srk..." # SERVER ONLY
SESSION_SECRET="$(openssl rand -base64 48)"
```

Generate `SESSION_SECRET` with: `openssl rand -base64 48`.

### On Vercel

Add the same four variables in **Project Settings → Environment Variables**, scoped to Production + Preview. `SUPABASE_SERVICE_ROLE_KEY` and `SESSION_SECRET` must stay server-only (do **not** prefix with `NEXT_PUBLIC_`).

---

## 3. First run

```bash
npm install
npm run bootstrap:admin -- "Your Name"    # creates the first admin, prints the login key
npm run dev
```

Open http://localhost:3000 → enter the 4-char login key from the bootstrap output.

The admin login key is the only bootstrap credential. Save it somewhere safe; resetting requires re-running `bootstrap:admin`.

---

## 4. Deploy

```bash
npx vercel                 # first time: link the project
npx vercel --prod          # ship
```

Vercel auto-detects Next.js. Env vars must be set before first deploy.

---

## 5. What's built so far

- [x] Navy/gold theme matching the app design
- [x] Login-key authentication with server-side sessions
- [x] Admin shell (overview, users, programs pages)
- [x] Participant "Today" page rendering prayer point + scriptures
- [x] Full database schema with RLS enabled (app goes through service role)

## 6. Coming next

- Admin: CSV user upload, key generation, level assignment
- Admin: program creation, participant assignment, day generation
- Admin: prayer point Markdown editor + image upload
- Admin: task builder (prayer / reading / other)
- Participant: prayer timer (start/finish) + reading checklists
- Scoring engine + leaderboard
- Admin drilldown per participant + manual overrides
- PWA manifest + offline shell

---

## Project layout

```
src/
  app/
    (participant)/         # group: participant-only layout + pages
      today/
    admin/                 # admin-only layout + pages
    api/auth/              # login / logout endpoints
    login/
  components/              # shared UI
  lib/
    auth/                  # session, login-key, hashing
    supabase/admin.ts      # service-role client (server-only)
supabase/migrations/       # SQL schema
scripts/bootstrap-admin.ts # first-admin seeding
```
