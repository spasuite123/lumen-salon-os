# Lumen Salon OS

Multi-location salon & spa platform. Built single-store, multi-store-ready —
adding a location is inserting rows, not refactoring. Backend is Supabase
(Postgres + RLS); target frontend is Expo / React Native.

**New here? Read [`CLAUDE.md`](./CLAUDE.md) first** — it's the full project context
and is written so anyone (human or a fresh Claude on another account) can resume cold.

## The app (runnable)

The real React + Vite + Supabase app lives in [`app/`](./app). `cd app && npm install && npm run dev`
boots it in demo mode (no backend needed); add Supabase keys to go live. See `app/README.md`.

## Quick start

```bash
# 1. create a Supabase project, then run migrations in order:
#    supabase/migrations/01_schema.sql
#    supabase/migrations/02_security.sql
#    supabase/migrations/03_seed.sql   (demo data — optional)
#    supabase/migrations/04_domain.sql

# 2. as your first signed-in user, bootstrap the account:
#    select create_account('Lumen Beauty Co.', 'Your Name');

# 3. see the target UX:
open prototype/index.html
```

## Layout

- `supabase/migrations/` — the database (schema, security, seed, domain). See its README.
- `prototype/index.html` — clickable UI mock (no build step). The spec for the real client.
- `docs/DECISIONS.md` — why the architecture is the way it is.
- `docs/ROADMAP.md` — done / next.

## Status

Schema + RLS + role model + domain tables are built and verified end-to-end on
Postgres 16. The Expo frontend is **not yet wired** to Supabase (prototype uses
mock data). Next step: wire the client to live data. See `docs/ROADMAP.md`.
