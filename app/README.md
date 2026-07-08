# Lumen Salon OS — web app

A React + Vite + Supabase app for the Lumen multi-location salon platform. Runs
immediately in **demo mode** (local sample data) and goes fully live the moment
you add Supabase credentials.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
```

That's it — it boots in demo mode with sample data, no backend required. You can
click through every screen: Calendar, Clients, Sales, Reports, Inbox, Settings,
the store switcher, the ⌘K app launcher, and all 20 modules.

## Go live (connect Supabase)

1. Create a Supabase project and run the migrations in `../supabase/migrations`
   (`01` → `09`) in the SQL editor or with `supabase db push`.
2. Copy `.env.example` to `.env` and fill in from Supabase → Settings → API:
   ```
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY
   ```
3. Restart `npm run dev`. The demo banner disappears and every screen now reads
   from your database. RLS scopes the data to the signed-in user's role and stores.

## How it's wired

- **`src/lib/supabase.ts`** — the client. `isSupabaseConfigured` is false until you
  add keys, which is what flips the app between demo and live.
- **`src/lib/data.ts`** — the data layer. Every getter returns the same shape from
  either Supabase or `src/lib/demo.ts`. Screens never know which mode they're in,
  so wiring a new table is just editing one function here.
- **`src/components/`** — `TopNav` (the navy bar, store dropdown, badges) and
  `AppLauncher` (⌘K).
- **`src/screens/`** — one file per area. `ListScreen.tsx` is config-driven and
  powers all the table modules (Products, Gift Cards, Staff, etc.).
- **`src/lib/config.ts`** — the app list, nav set, settings tree, and reports catalog.

## Deploy to Netlify

```bash
npm run build        # outputs dist/
```

`netlify.toml` is already set up (build command + SPA redirect). Connect the repo
in Netlify, or `netlify deploy --prod`. Add the two `VITE_SUPABASE_*` env vars in
the Netlify dashboard for the live build.

## Notes

- Reports read from the `rpt_*` views, which already enforce per-role scoping via
  RLS — the same report query returns store-appropriate rows for owner vs stylist.
- A few getters in `data.ts` (packages, memberships, offers, etc.) currently use
  demo data even in live mode; each is a one-line swap to a real `supabase.from(...)`
  select when you want it wired. They're marked in the file.
- Auth: when you're ready, gate the app on `supabase.auth` and call
  `create_account(...)` for the first user (see the migrations README).
