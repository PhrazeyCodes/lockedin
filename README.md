# LockedIn 🔒

Social accountability fitness OS. Next.js 14 (App Router) + Tailwind + Supabase, deployed on Vercel. Installable as a PWA on iPhone.

## Deploy (10 minutes)

1. **Supabase**: open your project → SQL Editor → paste and run `schema.sql` once. This creates all tables, RLS policies, and the `checkins` storage bucket.
2. **Auth settings** (Supabase → Authentication → Providers → Email): for frictionless signup between friends, turn OFF "Confirm email" (or keep it on and confirm via email).
3. **GitHub**: push this folder to a new repo.
4. **Vercel**: Import the repo → set env vars (copy from `.env.local.example`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_USDA_KEY` (optional; `DEMO_KEY` works with low limits)
   - `ANTHROPIC_API_KEY` (optional server-side fallback — each user can instead paste
     their own key in the app under Settings → AI food scan; it's stored only on their device)
5. Deploy. On iPhone: open in Safari → Share → **Add to Home Screen**.

## Local dev

```bash
npm install
cp .env.local.example .env.local   # fill in your keys
npm run dev
```

## Structure

- `app/(tabs)/` — the 5 tabs: Home · Plan · Lift · Journal · Social
- `app/api/scan/route.js` — Claude vision food analysis (API key never touches the client)
- `lib/store.js` — per-day docs in Supabase `days` + localStorage cache (`lockedin_v1`), sync-on-reconnect queue, and the **feed summary boundary**: only summary counts/totals are ever written to `feed_events`
- `schema.sql` — tables + RLS. `days` and `journal` are owner-only always; friends can select only `feed_events`, `checkins`, `reactions`, profile basics

## Privacy model (enforced by RLS)

| Data | Friends see |
|---|---|
| Meals/foods detail | ❌ summary totals only |
| Lift sets/weights | ❌ session type + set count + optional note |
| Habits/tasks detail | ❌ completion counts only |
| Journal, daily weight, scheduler | ❌ never |
| Weekly check-in photo + weight | ✅ explicit post |
| Streaks, Locked-In score, goal progress | ✅ |

## v1 notes

- Schedule blocks are created/edited by tap (30-min snap via time pickers); drag-to-resize is a v2 nicety
- Feed refreshes on load (no Realtime yet); nudges appear in-app, no push notifications
- Habit list and day/lift templates are stored locally per device
