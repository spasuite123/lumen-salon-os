-- ============================================================================
-- 01_schema.sql  —  Lumen Salon OS · multi-tenant schema
-- Postgres 15 / Supabase
--
-- Tenant model:  organizations (1) ─< stores (N)
--   Everything operational is scoped to a store_id EXCEPT clients, which are
--   shared across the whole organization (a client's history follows them
--   between locations). RLS (see 02_security.sql) enforces all isolation.
-- ============================================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()

-- ---------- enums (guarded so the file is safe to re-run) -------------------
do $$ begin
  create type staff_role as enum ('owner','manager','front_desk','stylist');
exception when duplicate_object then null; end $$;

do $$ begin
  create type appt_status as enum
    ('booked','confirmed','checked_in','completed','paid','canceled','no_show');
exception when duplicate_object then null; end $$;

-- ---------- updated_at helper ----------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ===========================================================================
-- ORGANIZATIONS  — the tenant boundary (one salon business / one account)
-- ===========================================================================
create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_org_updated before update on public.organizations
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- STORES  — locations within an org. The unit of operational scoping.
-- ===========================================================================
create table public.stores (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  name        text not null,
  city        text,
  timezone    text not null default 'America/Denver',
  color       text not null default '#0FA06F',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index idx_stores_org on public.stores(org_id);
create trigger trg_stores_updated before update on public.stores
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- STAFF  — team members. user_id links to a Supabase auth user once they log
-- in (null = invited / non-login record). role drives RLS permissions.
-- ===========================================================================
create table public.staff (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  user_id     uuid unique references auth.users(id) on delete set null,
  name        text not null,
  email       text,                       -- used to auto-link on signup
  title       text,                       -- e.g. "Senior Stylist"
  role        staff_role not null default 'stylist',
  color       text not null default '#5C7488',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index idx_staff_org  on public.staff(org_id);
create index idx_staff_user on public.staff(user_id);
create index idx_staff_email on public.staff(lower(email));
create trigger trg_staff_updated before update on public.staff
  for each row execute function public.set_updated_at();

-- which stores a staff member works at (drives store access for non-owners)
create table public.staff_stores (
  staff_id  uuid not null references public.staff(id)  on delete cascade,
  store_id  uuid not null references public.stores(id) on delete cascade,
  primary key (staff_id, store_id)
);
create index idx_staff_stores_store on public.staff_stores(store_id);

-- ===========================================================================
-- SERVICES  — defined once per org; offered + priced per store.
-- A service is available at a store iff a service_stores row exists.
-- ===========================================================================
create table public.services (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  name          text not null,
  category      text,
  duration_min  int  not null default 60,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index idx_services_org on public.services(org_id);
create trigger trg_services_updated before update on public.services
  for each row execute function public.set_updated_at();

-- availability + per-location pricing in one table (matches Mangomint:
-- "curate offerings and adjust pricing for each location")
create table public.service_stores (
  service_id   uuid not null references public.services(id) on delete cascade,
  store_id     uuid not null references public.stores(id)   on delete cascade,
  price_cents  int  not null,
  primary key (service_id, store_id)
);
create index idx_service_stores_store on public.service_stores(store_id);

-- ===========================================================================
-- CLIENTS  — ORG-LEVEL (no store_id). Shared across every location so a
-- client's record and history are unified. This is the key multi-store call.
-- ===========================================================================
create table public.clients (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  name        text not null,
  phone       text,
  email       text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index idx_clients_org on public.clients(org_id);
create trigger trg_clients_updated before update on public.clients
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- APPOINTMENTS  — store-scoped. price_cents snapshots the price at booking.
-- ===========================================================================
create table public.appointments (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  store_id     uuid not null references public.stores(id)        on delete cascade,
  client_id    uuid not null references public.clients(id)       on delete restrict,
  staff_id     uuid not null references public.staff(id)         on delete restrict,
  service_id   uuid not null references public.services(id)      on delete restrict,
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  status       appt_status not null default 'booked',
  price_cents  int not null default 0,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index idx_appt_store_time on public.appointments(store_id, starts_at);
create index idx_appt_staff_time on public.appointments(staff_id, starts_at);
create index idx_appt_client     on public.appointments(client_id);
create trigger trg_appt_updated before update on public.appointments
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- SALES  — a checkout record (service + tip). Store-scoped.
-- ===========================================================================
create table public.sales (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id) on delete cascade,
  store_id       uuid not null references public.stores(id)        on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  client_id      uuid references public.clients(id)       on delete set null,
  staff_id       uuid references public.staff(id)         on delete set null,
  subtotal_cents int not null default 0,
  tip_cents      int not null default 0,
  total_cents    int not null default 0,
  payment_method text not null default 'card',
  created_at     timestamptz not null default now()
);
create index idx_sales_store_time on public.sales(store_id, created_at);
