# Lumen Salon OS — Supabase backend

Multi-tenant Postgres schema with row-level security. Built to deploy to **one
store** and scale to **many** without a refactor: adding a location is inserting
a `stores` row, not changing the data model.

## Tenant model

```
organizations  ─┬─< stores ─┬─< staff_stores      (who works where)
                │           ├─< service_stores     (offered + priced per store)
                │           ├─< appointments
                │           └─< sales
                ├─< staff
                ├─< services
                └─< clients                         (org-wide — shared, no store_id)
```

The **organization** is the tenant boundary. Everything operational scopes to a
`store_id`; **clients are org-level** so a client's record and history follow them
between locations. Same schema works whether this stays your own multi-location
business (one org) or becomes SaaS sold to many salons (many orgs).

## Files (run in order)

1. `migrations/01_schema.sql` — tables, enums, indexes, `updated_at` triggers
2. `migrations/02_security.sql` — RLS helpers, role policies, onboarding RPCs, grants
3. `migrations/03_seed.sql` — demo data matching the prototype (optional)

**Supabase CLI:** drop these in `supabase/migrations/` and `supabase db push`.
**Dashboard:** paste each into the SQL editor and run top to bottom.

## Roles

| Role         | Stores                | Calendar read | Appointment writes            | Settings / pricing |
|--------------|-----------------------|---------------|-------------------------------|--------------------|
| `owner`      | every store in org    | all           | any appointment               | full               |
| `manager`    | every store in org    | all           | any appointment               | full (no billing)  |
| `front_desk` | assigned stores only  | their stores  | any appointment at their store| none               |
| `stylist`    | assigned stores only  | their stores  | **only their own appointments** | none             |

Store access for non-owners comes from `staff_stores`. Enable a stylist at a new
location by adding one row — no second account.

## Onboarding

- **First user:** sign up, then call once — `select create_account('My Salon','My Name');`
  (creates the org + your `owner` staff row).
- **Add staff:** owner inserts a `staff` row with the person's `email`; when they
  sign up with that email the `on_auth_user_created` trigger auto-links them.

## Verified behavior

Run against Postgres 16 with the Supabase `auth` shims. All passed:

- owner sees all 3 stores (7 / 3 / 2 appts); stylist sees only assigned stores; front desk only theirs
- a second org (“Rival Salon”) sees **0** rows of Lumen data — tenant isolation holds
- stylist can read the whole floor but `update` on another provider's appointment touches **0 rows**
- stylist `insert` at a store they aren't enabled at → `row violates row-level security policy`
- brand-new user sees nothing until `create_account`, then lands in a clean empty tenant

## Notes / next

- Clients are readable by every role in the org. To restrict stylists to clients
  they've served, tighten `clients_select` (commented where).
- Add `memberships`, `packages`, `gift_cards`, `products` + `inventory` as
  store-scoped tables following the same pattern.
- `price_cents` on `appointments` snapshots price at booking; `service_stores`
  holds current menu pricing.
