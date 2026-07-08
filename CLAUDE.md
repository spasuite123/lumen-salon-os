# CLAUDE.md — Lumen Salon OS

> **Read this first.** This file is the source of truth for the project. It exists
> so any Claude instance — on any account — can pick the work up cold without the
> original chat history or memory. If you're a fresh Claude reading this: everything
> you need is in this repo. Nothing important lives only in a conversation.

## What this is

A multi-location salon & spa management platform (a "build-it-ourselves Mangomint").
Deploys to **one store** today and scales to **many** with no schema change —
adding a location is inserting rows, not refactoring.

Core surface: appointment calendar (the heart), client CRM, checkout/POS, staff
with per-store permissions, plus memberships / packages / gift cards / retail
inventory. Owner-facing reporting rolls up across stores.

## Stack

- **Backend:** Supabase (Postgres 16 + Row-Level Security + Auth)
- **Frontend (target):** Expo / React Native (the owner's standard stack)
- **Prototype:** a single self-contained HTML file (`prototype/index.html`) — clickable
  mock of the whole app with in-memory data. Not wired to Supabase yet; it's the
  visual + interaction spec the real app should match.
- **Deploy:** Netlify (web), Supabase (data)

## Architecture — the decisions that matter

1. **`organizations` is the tenant boundary.** `organizations (1) ──< stores (N)`.
   Same schema serves either "our own business adding locations" (one org) or
   "SaaS sold to many salons" (many orgs). Costs nothing now; preserves the option.

2. **Everything operational scopes to `store_id` — except `clients`, which are
   org-level.** A client's record and history follow them between locations. This
   is the central multi-store call and it mirrors how Mangomint actually behaves.

3. **Isolation lives in the database via RLS, not the app.** A bug in the Expo
   client cannot leak another store's or another org's rows — the row never leaves
   Postgres. This is why "1 store → 20 stores" is cheap and safe.

4. **Store access for non-owners comes from `staff_stores`.** Enable a stylist at a
   new location by adding one row — no second login/account.

## Role model (enforced in `02_security.sql`)

| Role         | Stores               | Calendar read | Appointment writes              | Catalog/pricing |
|--------------|----------------------|---------------|---------------------------------|-----------------|
| `owner`      | all in org           | all           | any appointment                 | full            |
| `manager`    | all in org           | all           | any appointment                 | full (no billing)|
| `front_desk` | assigned only        | their stores  | any appointment at their store  | none            |
| `stylist`    | assigned only        | their stores  | **only their own appointments** | none            |

Inventory writes = owner/manager/front_desk (`can_manage_store`). Stylists never write catalog or stock.

## File map

```
supabase/migrations/
  01_schema.sql    tables, enums, indexes, updated_at triggers
  02_security.sql  RLS helper fns, role policies, onboarding RPCs, table grants
  03_seed.sql      demo data (1 org "Lumen Beauty Co.", 3 UT stores, staff, menu,
                   8 clients, a day of appointments) + RLS test instructions
  04_domain.sql    memberships, packages, gift cards, products, per-store inventory
  05_reporting.sql line items, payments, refunds, offers, client accounts,
                   time clock/off, inventory movements, deposits (+ RLS)
  06_reports_seed.sql  demo backfill so report views return real numbers
  07_reports.sql   report views wave 1 (security_invoker — auto-scoped per caller)
  08_reports_wave2.sql remaining views + package-redemption & credit-ledger tables
  09_modules.sql   Inbox, Forms, Campaigns, Flows, Resources, Payroll (+ RLS, demo)
  README.md        deploy steps + role matrix + verified behavior
app/                 RUNNABLE React + Vite + Supabase app (demo mode out of the box;
                   add keys to go live). See app/README.md.  ← the actual software
prototype/
  index.html       FULL app shell — horizontal navy top nav (icon+label, active pill,
                   badge counts), 20-app launcher (⌘K), all modules, complete
                   Settings tree, Reports browser; core modules functional
docs/
  DECISIONS.md     architecture decision log (the "why")
  ROADMAP.md       what's done / what's next, in priority order
  REPORTS.md       catalog of all 40 reports → data source + build status
```

## Conventions (follow these when extending)

- New operational tables carry **both `org_id` and `store_id`**, with FKs to
  `organizations` and `stores`, plus an index on `(store_id, <time or sort key>)`.
- New "shared-across-stores" tables (like clients) carry `org_id` only.
- Money is stored as **integer cents** (`*_cents`), never floats.
- Every mutable table gets an `updated_at` column + the `set_updated_at` trigger.
- RLS: reuse the helpers from `02` — `auth_org_id()`, `auth_role()`,
  `auth_store_ids()`, `can_access_store(id)`, `can_manage_store(id)`,
  `current_staff_id()`. They are `SECURITY DEFINER` so they don't recurse.
- Pattern per table: one broad `*_select` policy (read), one `*_write` (FOR ALL)
  with the management check. Permissive policies OR together.
- Always `grant select,insert,update,delete ... to authenticated` on new tables
  (hosted Supabase usually does this by default; explicit keeps it portable).
- **Report views** are `create view … with (security_invoker = true)` so the
  caller's RLS applies — never plain views (those run as owner and leak all orgs).
  Name them `rpt_<category>_<name>`; return integer cents, format in the client.

## Status — what's true right now (verified)

All four migrations run clean on Postgres 16 with the Supabase `auth` shims, and
RLS was tested by impersonating each role + a second tenant. Confirmed:

- owner sees all 3 stores; stylist & front desk see only assigned stores
- a second org sees **0** rows of the first org's data (tenant isolation)
- stylist can read the whole floor but `UPDATE` on another provider's appointment
  touches 0 rows; booking at an un-assigned store raises an RLS violation
- per-store inventory is independent and isolated; stylists can't adjust stock
- brand-new signup sees nothing until `create_account(...)`, then a clean tenant
- the `on_auth_user_created` trigger auto-links invited staff by email
- **reporting:** 23 report views compute correct numbers and inherit RLS via
  `security_invoker` — owner sees all stores, a stylist sees only theirs, a rival
  org sees zero rows, all from the *same* view definition

Schema is now **47 tables + 42 report views**, and **all 40 reports from the
source menu are live**. See `docs/REPORTS.md` for the full catalog.

**Not done yet:** the Expo frontend is not wired to Supabase (prototype is mock
data only); no online/client-facing booking; no live Supabase project provisioned;
no payments integration. The report *engine* is complete (all 40); what remains is
rendering them in the UI once the client is wired to Supabase.

**Every app in the launcher is now backed by schema** (`09_modules.sql` added
Inbox, Forms, Campaigns, Flows, Resources, Payroll). Payroll is owner/manager-only;
Inbox/Resources are store-scoped; the rest follow the org catalog + instance pattern.

## How to deploy / resume

1. Create a Supabase project. In the SQL editor (or `supabase db push`), run
   `01 → 02 → 03 → 04` in order.
2. Sign up your first user, then run once: `select create_account('Lumen Beauty Co.','<Your Name>');`
3. Add staff: insert a `staff` row with their email; they sign up → auto-linked.
4. Open `prototype/index.html` to see the target UX while building the Expo client.

> **After any DB reset:** re-running `03_seed.sql` re-inserts demo data, but the
> auth users (and their `staff.user_id` links) must be recreated too — see the
> test block at the bottom of `03_seed.sql`. Seed data without linked auth users
> will appear empty under RLS (that's correct behavior, not a bug).

## Migration note (personal → Enterprise account)

This repo *is* the handoff. Claude memory and saved chats do **not** transfer
between accounts — only exported files do. Keep all project knowledge in these
files (and a Git remote), and a fresh Claude on the Enterprise account is oriented
the moment it reads this `CLAUDE.md`.
