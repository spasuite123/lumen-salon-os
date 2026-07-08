# Go live — Supabase + Netlify

A start-to-finish checklist. ~20 minutes. You do the account clicks; every step
is a single paste. **Never share your `service_role` key or DB password.** The app
only needs your Project URL + `anon` key, and those are safe in the browser.

---

## Part 1 · Supabase (database)

1. **New project.** Pick a region near you (e.g. `West US`). Wait for it to finish
   provisioning.
2. **Load the schema.** SQL Editor → New query → paste **`lumen-full-with-demo.sql`**
   → **Run**. Creates 47 tables, all RLS policies, 42 report views, and demo data.
   (To start empty instead, delete the four seed blocks — they're commented in the file.)
3. **Create your login.** Authentication → Users → **Add user**:
   - Email: `owner@lumen.test`  ·  set any password  ·  check **Auto Confirm User**.
   - The schema seeds an owner record with that email and a trigger links your new
     login to it — so you're instantly the **owner** of the demo business.
   - *Prefer your real email?* Add the user with it, then run in SQL Editor:
     ```sql
     update public.staff
        set email = 'you@yourdomain.com',
            user_id = (select id from auth.users where email = 'you@yourdomain.com')
      where email = 'owner@lumen.test';
     ```
4. **Grab your keys.** Settings → API → copy **Project URL** and the **`anon` public**
   key. (Leave `service_role` alone.)

---

## Part 2 · Test locally against Supabase (optional, 2 min)

```bash
cd app
cp .env.example .env          # then paste your two values:
#   VITE_SUPABASE_URL=https://YOURPROJECT.supabase.co
#   VITE_SUPABASE_ANON_KEY=eyJ...
npm install
npm run dev                    # http://localhost:5173
```
Log in with `owner@lumen.test`. The demo banner disappears — you're on live data.

---

## Part 3 · Netlify (hosting)

**Recommended: connect a Git repo** (also gives you a clean handoff to Enterprise).

```bash
# from the repo root (lumen-salon-os/)
git init && git add . && git commit -m "Lumen Salon OS"
# create an empty repo on GitHub, then:
git remote add origin https://github.com/YOURNAME/lumen-salon-os.git
git push -u origin main
```

In Netlify → **Add new site → Import from Git** → pick the repo, then set:
- **Base directory:** `app`
- **Build command:** `npm run build`
- **Publish directory:** `dist`   (relative to base → resolves to `app/dist`)
- **Environment variables:** add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- **Deploy.**

(The `app/netlify.toml` already sets the build + the SPA redirect, so client-side
routes work on refresh.)

**Alternative: drag-and-drop.** `cd app && npm run build`, then drag the `app/dist`
folder into Netlify. Note: env vars are baked at build time, so set them in `.env`
*before* building this way.

---

## Part 4 · Make it yours

- Log in and click around — Calendar, Reports, the works, now on your database.
- Rename the business + locations in Settings (or via SQL).
- Add staff: insert a `staff` row with their email; when they sign up with that
  email, they're auto-linked (see `supabase/migrations/README.md`).

## If something looks empty after connecting
That's RLS doing its job — you must be **signed in** for any data to show (anon
users see nothing by design). Confirm you logged in with a user that's linked to a
`staff` row (step 3). The demo `owner@lumen.test` is the quickest way in.
