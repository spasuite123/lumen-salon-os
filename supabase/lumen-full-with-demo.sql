-- ============================================================================
-- Lumen Salon OS — complete database, one file.
-- Paste into the Supabase SQL editor and Run. Includes demo data so the app
-- lights up immediately. (To start empty instead, skip 03/06/08-seed/09-demo
-- blocks — they're clearly commented in the originals.)
-- Safe to run once on a fresh project. auth schema/roles already exist on Supabase.
-- ============================================================================


-- ========================= 01_schema.sql =========================

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

-- ========================= 02_security.sql =========================

-- ============================================================================
-- 02_security.sql  —  RLS helpers + role-based policies + onboarding
--
-- Role model (3 primary personas + manager as an org-wide admin):
--   owner       full access to EVERY store in the org + settings + billing
--   manager     org-wide operations (everything but billing)         [optional]
--   front_desk  operate ONLY assigned stores: book / checkout / clients
--   stylist     read the calendar at assigned stores; only modify OWN appts
--
-- Isolation is enforced here, at the database. A bug in the app cannot leak
-- another org's or another store's rows — the query simply returns nothing.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helper functions. All are SECURITY DEFINER so they read membership tables
-- WITHOUT triggering RLS (this is what prevents infinite-recursion policies).
-- search_path is pinned for safety.
-- ---------------------------------------------------------------------------
create or replace function public.current_staff_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.staff where user_id = auth.uid() limit 1;
$$;

create or replace function public.auth_org_id()
returns uuid language sql stable security definer set search_path = public as $$
  select org_id from public.staff where user_id = auth.uid() limit 1;
$$;

create or replace function public.auth_role()
returns staff_role language sql stable security definer set search_path = public as $$
  select role from public.staff where user_id = auth.uid() limit 1;
$$;

-- The set of store_ids the current user may touch.
--   owner / manager  -> every store in their org
--   front_desk / stylist -> only stores in staff_stores
create or replace function public.auth_store_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select s.id
    from public.stores s
   where s.org_id = public.auth_org_id()
     and public.auth_role() in ('owner','manager')
  union
  select ss.store_id
    from public.staff_stores ss
    join public.staff st on st.id = ss.staff_id
   where st.user_id = auth.uid()
     and public.auth_role() in ('front_desk','stylist');
$$;

create or replace function public.can_access_store(p_store uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.auth_store_ids() x where x = p_store);
$$;

-- true if the user may create/edit appointments for anyone at a store
-- (owner/manager/front_desk). Stylists fall through and may edit only their own.
create or replace function public.can_manage_store(p_store uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.can_access_store(p_store)
     and public.auth_role() in ('owner','manager','front_desk');
$$;

grant execute on function
  public.current_staff_id, public.auth_org_id, public.auth_role,
  public.auth_store_ids, public.can_access_store, public.can_manage_store
to authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere (default-deny once enabled).
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.stores         enable row level security;
alter table public.staff          enable row level security;
alter table public.staff_stores   enable row level security;
alter table public.services       enable row level security;
alter table public.service_stores enable row level security;
alter table public.clients        enable row level security;
alter table public.appointments   enable row level security;
alter table public.sales          enable row level security;

-- Table privileges: RLS above is what restricts ROWS; these grants just let the
-- authenticated role reach the tables at all. Hosted Supabase usually applies
-- these by default — included here so the schema also works standalone.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

-- ===========================================================================
-- ORGANIZATIONS — see your own org; only owner edits it.
-- ===========================================================================
create policy org_select on public.organizations for select to authenticated
  using (id = public.auth_org_id());
create policy org_update on public.organizations for update to authenticated
  using (id = public.auth_org_id() and public.auth_role() = 'owner')
  with check (id = public.auth_org_id());

-- ===========================================================================
-- STORES — see accessible stores; owner/manager create & edit.
-- ===========================================================================
create policy stores_select on public.stores for select to authenticated
  using (public.can_access_store(id));
create policy stores_write on public.stores for all to authenticated
  using (org_id = public.auth_org_id() and public.auth_role() in ('owner','manager'))
  with check (org_id = public.auth_org_id() and public.auth_role() in ('owner','manager'));

-- ===========================================================================
-- STAFF — everyone sees teammates in their org; owner/manager manage them.
-- (current user reading their own row is covered by the org-wide select.)
-- ===========================================================================
create policy staff_select on public.staff for select to authenticated
  using (org_id = public.auth_org_id());
create policy staff_write on public.staff for all to authenticated
  using (org_id = public.auth_org_id() and public.auth_role() in ('owner','manager'))
  with check (org_id = public.auth_org_id() and public.auth_role() in ('owner','manager'));

-- staff_stores: readable within org; managed by owner/manager.
create policy staff_stores_select on public.staff_stores for select to authenticated
  using (exists (select 1 from public.staff s
                  where s.id = staff_id and s.org_id = public.auth_org_id()));
create policy staff_stores_write on public.staff_stores for all to authenticated
  using (public.auth_role() in ('owner','manager')
         and exists (select 1 from public.staff s
                      where s.id = staff_id and s.org_id = public.auth_org_id()))
  with check (public.auth_role() in ('owner','manager')
         and exists (select 1 from public.staff s
                      where s.id = staff_id and s.org_id = public.auth_org_id()));

-- ===========================================================================
-- SERVICES — menu is readable org-wide; owner/manager edit.
-- ===========================================================================
create policy services_select on public.services for select to authenticated
  using (org_id = public.auth_org_id());
create policy services_write on public.services for all to authenticated
  using (org_id = public.auth_org_id() and public.auth_role() in ('owner','manager'))
  with check (org_id = public.auth_org_id() and public.auth_role() in ('owner','manager'));

-- service_stores: visible for accessible stores; owner/manager set pricing.
create policy svc_stores_select on public.service_stores for select to authenticated
  using (public.can_access_store(store_id));
create policy svc_stores_write on public.service_stores for all to authenticated
  using (public.can_access_store(store_id) and public.auth_role() in ('owner','manager'))
  with check (public.can_access_store(store_id) and public.auth_role() in ('owner','manager'));

-- ===========================================================================
-- CLIENTS — shared across the whole org (every role can read/create/edit).
-- Tighten later if stylists should only see clients they've served.
-- ===========================================================================
create policy clients_select on public.clients for select to authenticated
  using (org_id = public.auth_org_id());
create policy clients_write on public.clients for all to authenticated
  using (org_id = public.auth_org_id())
  with check (org_id = public.auth_org_id());

-- ===========================================================================
-- APPOINTMENTS
--   read   : anyone may read the full calendar at stores they can access
--   modify : owner/manager/front_desk for any appt at the store;
--            stylists only for appointments where they are the provider.
-- (Permissive policies are OR-ed, so the read policy widens SELECT for all.)
-- ===========================================================================
create policy appt_select on public.appointments for select to authenticated
  using (org_id = public.auth_org_id() and public.can_access_store(store_id));

create policy appt_modify on public.appointments for all to authenticated
  using (
    org_id = public.auth_org_id()
    and public.can_access_store(store_id)
    and (public.can_manage_store(store_id) or staff_id = public.current_staff_id())
  )
  with check (
    org_id = public.auth_org_id()
    and public.can_access_store(store_id)
    and (public.can_manage_store(store_id) or staff_id = public.current_staff_id())
  );

-- ===========================================================================
-- SALES — read/create at accessible stores (anyone working that store).
-- ===========================================================================
create policy sales_select on public.sales for select to authenticated
  using (org_id = public.auth_org_id() and public.can_access_store(store_id));
create policy sales_write on public.sales for all to authenticated
  using (org_id = public.auth_org_id() and public.can_access_store(store_id))
  with check (org_id = public.auth_org_id() and public.can_access_store(store_id));

-- ============================================================================
-- ONBOARDING
-- ============================================================================

-- Bootstraps a brand-new account: creates the org and the caller's owner row.
-- Call once, right after the very first signup:  select create_account('Lumen Co','Caleb W.');
create or replace function public.create_account(p_org_name text, p_owner_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  if auth.uid() is null then
    raise exception 'must be authenticated';
  end if;
  if exists (select 1 from public.staff where user_id = auth.uid()) then
    raise exception 'this user already belongs to an account';
  end if;
  insert into public.organizations(name) values (p_org_name) returning id into v_org;
  insert into public.staff(org_id, user_id, name, email, role)
    values (v_org, auth.uid(), p_owner_name,
            (select email from auth.users where id = auth.uid()), 'owner');
  return v_org;
end $$;
grant execute on function public.create_account to authenticated;

-- Auto-link invited staff: when a user signs up with an email that matches an
-- invited staff record (user_id still null), claim that row for them.
-- Invite flow: owner inserts a staff row with the person's email; they sign up; linked.
create or replace function public.link_staff_on_signup()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.staff
     set user_id = new.id
   where user_id is null
     and lower(email) = lower(new.email);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.link_staff_on_signup();

-- ========================= 03_seed.sql =========================

-- ============================================================================
-- 03_seed.sql  —  Demo data matching the Lumen prototype.
-- Run in the Supabase SQL editor (service role bypasses RLS). One org, three
-- stores, staff, the full service menu with per-store pricing, clients, and a
-- day of appointments. Staff start with user_id = null; see the bottom of the
-- file for how to attach a real login and test RLS as each role.
-- ============================================================================

-- ----- organization --------------------------------------------------------
insert into public.organizations (id, name) values
  ('a0000000-0000-0000-0000-000000000001', 'Lumen Beauty Co.');

-- ----- stores ---------------------------------------------------------------
insert into public.stores (id, org_id, name, city, color) values
  ('a1000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','Layton','Layton, UT','#0FA06F'),
  ('a1000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','Lehi','Lehi, UT','#7C6FD0'),
  ('a1000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000001','Silicon Slopes','Draper, UT','#E8951F');

-- ----- staff (user_id null until they sign up) ------------------------------
insert into public.staff (id, org_id, name, email, title, role, color) values
  ('a2000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','Caleb W.','owner@lumen.test','Owner','owner','#16241D'),
  ('a2000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','Maya R.','maya@lumen.test','Senior Stylist','stylist','#0FA06F'),
  ('a2000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000001','Jordan T.','jordan@lumen.test','Colorist','stylist','#7C6FD0'),
  ('a2000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000001','Priya N.','priya@lumen.test','Esthetician','stylist','#D9657A'),
  ('a2000000-0000-0000-0000-000000000005','a0000000-0000-0000-0000-000000000001','Devon K.','devon@lumen.test','Massage Therapist','stylist','#3D94C9'),
  ('a2000000-0000-0000-0000-000000000006','a0000000-0000-0000-0000-000000000001','Alex M.','alex@lumen.test','Nail Artist','stylist','#E8951F'),
  ('a2000000-0000-0000-0000-000000000007','a0000000-0000-0000-0000-000000000001','Sam W.','sam@lumen.test','Front Desk','front_desk','#5C7488');

-- ----- staff_stores (who works where) ---------------------------------------
insert into public.staff_stores (staff_id, store_id) values
  ('a2000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001'), -- owner: access is org-wide via role, rows optional
  ('a2000000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000001'),
  ('a2000000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000002'),
  ('a2000000-0000-0000-0000-000000000003','a1000000-0000-0000-0000-000000000001'),
  ('a2000000-0000-0000-0000-000000000004','a1000000-0000-0000-0000-000000000001'),
  ('a2000000-0000-0000-0000-000000000004','a1000000-0000-0000-0000-000000000003'),
  ('a2000000-0000-0000-0000-000000000005','a1000000-0000-0000-0000-000000000001'),
  ('a2000000-0000-0000-0000-000000000006','a1000000-0000-0000-0000-000000000002'),
  ('a2000000-0000-0000-0000-000000000006','a1000000-0000-0000-0000-000000000003'),
  ('a2000000-0000-0000-0000-000000000007','a1000000-0000-0000-0000-000000000002'),
  ('a2000000-0000-0000-0000-000000000007','a1000000-0000-0000-0000-000000000003');

-- ----- services -------------------------------------------------------------
insert into public.services (id, org_id, name, category, duration_min) values
  ('a3000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','Women''s Cut & Style','Hair',60),
  ('a3000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','Full Highlights','Color',120),
  ('a3000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000001','Signature Facial','Skin',60),
  ('a3000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000001','Deep Tissue Massage','Body',60),
  ('a3000000-0000-0000-0000-000000000005','a0000000-0000-0000-0000-000000000001','Gel Manicure','Nails',45),
  ('a3000000-0000-0000-0000-000000000006','a0000000-0000-0000-0000-000000000001','Men''s Cut','Hair',30),
  ('a3000000-0000-0000-0000-000000000007','a0000000-0000-0000-0000-000000000001','Brow Lamination','Skin',45);

-- ----- per-store availability + pricing (cents) -----------------------------
insert into public.service_stores (service_id, store_id, price_cents) values
  ('a3000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001',7500),
  ('a3000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000002',8000),
  ('a3000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000003',9500),
  ('a3000000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000001',16500),
  ('a3000000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000002',17500),
  ('a3000000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000003',21000),
  ('a3000000-0000-0000-0000-000000000003','a1000000-0000-0000-0000-000000000001',11000),
  ('a3000000-0000-0000-0000-000000000003','a1000000-0000-0000-0000-000000000003',14000),
  ('a3000000-0000-0000-0000-000000000004','a1000000-0000-0000-0000-000000000001',12000),
  ('a3000000-0000-0000-0000-000000000005','a1000000-0000-0000-0000-000000000002',6000),
  ('a3000000-0000-0000-0000-000000000005','a1000000-0000-0000-0000-000000000003',7000),
  ('a3000000-0000-0000-0000-000000000006','a1000000-0000-0000-0000-000000000001',4500),
  ('a3000000-0000-0000-0000-000000000007','a1000000-0000-0000-0000-000000000001',8500),
  ('a3000000-0000-0000-0000-000000000007','a1000000-0000-0000-0000-000000000003',10000);

-- ----- clients (org-wide, no store) -----------------------------------------
insert into public.clients (id, org_id, name, phone, email) values
  ('a4000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','Hannah Brooks','(801) 555-0142','hannah@example.com'),
  ('a4000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','Olivia Chen','(801) 555-0198','olivia@example.com'),
  ('a4000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000001','Marcus Webb','(385) 555-0167','marcus@example.com'),
  ('a4000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000001','Sofia Ramirez','(801) 555-0123','sofia@example.com'),
  ('a4000000-0000-0000-0000-000000000005','a0000000-0000-0000-0000-000000000001','Tyler Nguyen','(385) 555-0211','tyler@example.com'),
  ('a4000000-0000-0000-0000-000000000006','a0000000-0000-0000-0000-000000000001','Grace Liu','(801) 555-0156','grace@example.com'),
  ('a4000000-0000-0000-0000-000000000007','a0000000-0000-0000-0000-000000000001','Ethan Park','(801) 555-0188','ethan@example.com'),
  ('a4000000-0000-0000-0000-000000000008','a0000000-0000-0000-0000-000000000001','Isabella Moore','(385) 555-0144','isabella@example.com');

-- ----- appointments (today; starts_at built from today's date + clock time) -
-- helper expression: ((now()::date) + time 'HH:MM')::timestamptz
insert into public.appointments
  (org_id, store_id, client_id, staff_id, service_id, starts_at, ends_at, status, price_cents)
values
  -- Layton
  ('a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','a4000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000002','a3000000-0000-0000-0000-000000000001',((now()::date)+time '09:00'),((now()::date)+time '10:00'),'paid',7500),
  ('a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','a4000000-0000-0000-0000-000000000002','a2000000-0000-0000-0000-000000000003','a3000000-0000-0000-0000-000000000002',((now()::date)+time '09:30'),((now()::date)+time '11:30'),'paid',16500),
  ('a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','a4000000-0000-0000-0000-000000000004','a2000000-0000-0000-0000-000000000004','a3000000-0000-0000-0000-000000000003',((now()::date)+time '10:00'),((now()::date)+time '11:00'),'booked',11000),
  ('a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','a4000000-0000-0000-0000-000000000003','a2000000-0000-0000-0000-000000000005','a3000000-0000-0000-0000-000000000004',((now()::date)+time '11:00'),((now()::date)+time '12:00'),'booked',12000),
  ('a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','a4000000-0000-0000-0000-000000000006','a2000000-0000-0000-0000-000000000002','a3000000-0000-0000-0000-000000000006',((now()::date)+time '11:30'),((now()::date)+time '12:00'),'booked',4500),
  ('a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','a4000000-0000-0000-0000-000000000008','a2000000-0000-0000-0000-000000000004','a3000000-0000-0000-0000-000000000007',((now()::date)+time '13:00'),((now()::date)+time '13:45'),'booked',8500),
  ('a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','a4000000-0000-0000-0000-000000000007','a2000000-0000-0000-0000-000000000003','a3000000-0000-0000-0000-000000000002',((now()::date)+time '14:00'),((now()::date)+time '16:00'),'booked',16500),
  -- Lehi
  ('a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000002','a4000000-0000-0000-0000-000000000005','a2000000-0000-0000-0000-000000000006','a3000000-0000-0000-0000-000000000005',((now()::date)+time '10:00'),((now()::date)+time '10:45'),'paid',6000),
  ('a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000002','a4000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000002','a3000000-0000-0000-0000-000000000001',((now()::date)+time '10:30'),((now()::date)+time '11:30'),'booked',8000),
  ('a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000002','a4000000-0000-0000-0000-000000000004','a2000000-0000-0000-0000-000000000006','a3000000-0000-0000-0000-000000000005',((now()::date)+time '13:30'),((now()::date)+time '14:15'),'booked',6000),
  -- Silicon Slopes
  ('a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000003','a4000000-0000-0000-0000-000000000006','a2000000-0000-0000-0000-000000000004','a3000000-0000-0000-0000-000000000003',((now()::date)+time '09:30'),((now()::date)+time '10:30'),'paid',14000),
  ('a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000003','a4000000-0000-0000-0000-000000000008','a2000000-0000-0000-0000-000000000006','a3000000-0000-0000-0000-000000000005',((now()::date)+time '14:00'),((now()::date)+time '14:45'),'booked',7000);

-- ============================================================================
-- ATTACH A LOGIN + TEST RLS
-- ----------------------------------------------------------------------------
-- 1. Create users in Supabase Auth (Dashboard > Authentication) using the
--    seed emails above (owner@lumen.test, maya@lumen.test, sam@lumen.test, ...).
--    The on_auth_user_created trigger auto-links each to its staff row by email.
--
-- 2. Or link manually:
--      update public.staff set user_id = '<auth-user-uuid>' where email = 'maya@lumen.test';
--
-- 3. Verify isolation by impersonating a role in the SQL editor:
--      set local role authenticated;
--      set local request.jwt.claims = '{"sub":"<maya-auth-uuid>","role":"authenticated"}';
--      select store_id, count(*) from appointments group by 1;  -- Maya: only Layton + Lehi
--      select count(*) from appointments where staff_id <> current_staff_id(); -- readable, but...
--      update appointments set status='canceled'                 -- ...this fails for others'
--        where staff_id <> current_staff_id();                   --    appts (stylist rule)
--    Reset with:  reset role;
-- ============================================================================

-- ========================= 04_domain.sql =========================

-- ============================================================================
-- 04_domain.sql  —  Memberships, packages, gift cards, retail + inventory
-- Same patterns as 01–02:  org-level catalogs, store-scoped stock, RLS via the
-- helper functions from 02_security.sql. Run after 01–03.
--
-- Scoping recap:
--   catalogs (plans / packages / products) ............ org-level, owner/manager edit
--   client instances (memberships / packages / cards) . org-level, any staff sells
--   inventory ......................................... STORE-scoped (each location
--                                                        holds its own stock)
-- ============================================================================

do $$ begin
  create type membership_status as enum ('active','paused','canceled');
exception when duplicate_object then null; end $$;

-- ===========================================================================
-- MEMBERSHIPS
-- ===========================================================================
create table public.membership_plans (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  name         text not null,
  price_cents  int  not null,
  interval     text not null default 'month',       -- billing cadence
  benefits     text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index idx_mplans_org on public.membership_plans(org_id);
create trigger trg_mplans_updated before update on public.membership_plans
  for each row execute function public.set_updated_at();

-- a client's subscription — org-wide (valid at any location)
create table public.client_memberships (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  client_id   uuid not null references public.clients(id)        on delete cascade,
  plan_id     uuid not null references public.membership_plans(id) on delete restrict,
  status      membership_status not null default 'active',
  started_on  date not null default current_date,
  renews_on   date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index idx_cmemberships_org    on public.client_memberships(org_id);
create index idx_cmemberships_client on public.client_memberships(client_id);
create trigger trg_cmemberships_updated before update on public.client_memberships
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- PACKAGES (pre-paid bundles of services)
-- ===========================================================================
create table public.packages (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  name         text not null,
  price_cents  int  not null,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index idx_packages_org on public.packages(org_id);
create trigger trg_packages_updated before update on public.packages
  for each row execute function public.set_updated_at();

create table public.package_items (
  package_id  uuid not null references public.packages(id) on delete cascade,
  service_id  uuid not null references public.services(id) on delete restrict,
  quantity    int  not null default 1,
  primary key (package_id, service_id)
);

-- a client's purchased package + remaining redemptions per service
create table public.client_packages (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  client_id    uuid not null references public.clients(id)   on delete cascade,
  package_id   uuid not null references public.packages(id)  on delete restrict,
  purchased_at timestamptz not null default now()
);
create index idx_cpackages_client on public.client_packages(client_id);

create table public.client_package_items (
  client_package_id uuid not null references public.client_packages(id) on delete cascade,
  service_id        uuid not null references public.services(id) on delete restrict,
  remaining         int  not null default 0,
  primary key (client_package_id, service_id)
);

-- ===========================================================================
-- GIFT CARDS — org-wide, redeemable at any location
-- ===========================================================================
create table public.gift_cards (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references public.organizations(id) on delete cascade,
  code               text not null,
  initial_cents      int  not null,
  balance_cents      int  not null,
  purchaser_client_id uuid references public.clients(id) on delete set null,
  issued_at          timestamptz not null default now(),
  unique (org_id, code)
);
create index idx_giftcards_org on public.gift_cards(org_id);

-- ===========================================================================
-- RETAIL — product catalog (org) + per-store inventory (store-scoped)
-- ===========================================================================
create table public.products (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  name         text not null,
  sku          text,
  price_cents  int  not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index idx_products_org on public.products(org_id);
create trigger trg_products_updated before update on public.products
  for each row execute function public.set_updated_at();

-- stock lives PER STORE — same product, independent counts at each location
create table public.product_inventory (
  product_id     uuid not null references public.products(id) on delete cascade,
  store_id       uuid not null references public.stores(id)   on delete cascade,
  qty_on_hand    int  not null default 0,
  reorder_point  int  not null default 0,
  updated_at     timestamptz not null default now(),
  primary key (product_id, store_id)
);
create index idx_inventory_store on public.product_inventory(store_id);
create trigger trg_inventory_updated before update on public.product_inventory
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- RLS
-- ===========================================================================
alter table public.membership_plans     enable row level security;
alter table public.client_memberships   enable row level security;
alter table public.packages             enable row level security;
alter table public.package_items        enable row level security;
alter table public.client_packages      enable row level security;
alter table public.client_package_items enable row level security;
alter table public.gift_cards           enable row level security;
alter table public.products             enable row level security;
alter table public.product_inventory    enable row level security;

grant select, insert, update, delete on
  public.membership_plans, public.client_memberships, public.packages,
  public.package_items, public.client_packages, public.client_package_items,
  public.gift_cards, public.products, public.product_inventory
to authenticated;

-- ---- catalogs: org-readable, owner/manager edit ----
create policy mplans_select on public.membership_plans for select to authenticated
  using (org_id = public.auth_org_id());
create policy mplans_write on public.membership_plans for all to authenticated
  using (org_id = public.auth_org_id() and public.auth_role() in ('owner','manager'))
  with check (org_id = public.auth_org_id() and public.auth_role() in ('owner','manager'));

create policy packages_select on public.packages for select to authenticated
  using (org_id = public.auth_org_id());
create policy packages_write on public.packages for all to authenticated
  using (org_id = public.auth_org_id() and public.auth_role() in ('owner','manager'))
  with check (org_id = public.auth_org_id() and public.auth_role() in ('owner','manager'));

create policy pkgitems_select on public.package_items for select to authenticated
  using (exists (select 1 from public.packages p
                  where p.id = package_id and p.org_id = public.auth_org_id()));
create policy pkgitems_write on public.package_items for all to authenticated
  using (public.auth_role() in ('owner','manager')
         and exists (select 1 from public.packages p
                      where p.id = package_id and p.org_id = public.auth_org_id()))
  with check (public.auth_role() in ('owner','manager')
         and exists (select 1 from public.packages p
                      where p.id = package_id and p.org_id = public.auth_org_id()));

create policy products_select on public.products for select to authenticated
  using (org_id = public.auth_org_id());
create policy products_write on public.products for all to authenticated
  using (org_id = public.auth_org_id() and public.auth_role() in ('owner','manager'))
  with check (org_id = public.auth_org_id() and public.auth_role() in ('owner','manager'));

-- ---- client instances: org-readable, any staff in org may sell/issue ----
create policy cmemberships_select on public.client_memberships for select to authenticated
  using (org_id = public.auth_org_id());
create policy cmemberships_write on public.client_memberships for all to authenticated
  using (org_id = public.auth_org_id())
  with check (org_id = public.auth_org_id());

create policy cpackages_select on public.client_packages for select to authenticated
  using (org_id = public.auth_org_id());
create policy cpackages_write on public.client_packages for all to authenticated
  using (org_id = public.auth_org_id())
  with check (org_id = public.auth_org_id());

create policy cpkgitems_select on public.client_package_items for select to authenticated
  using (exists (select 1 from public.client_packages cp
                  where cp.id = client_package_id and cp.org_id = public.auth_org_id()));
create policy cpkgitems_write on public.client_package_items for all to authenticated
  using (exists (select 1 from public.client_packages cp
                  where cp.id = client_package_id and cp.org_id = public.auth_org_id()))
  with check (exists (select 1 from public.client_packages cp
                       where cp.id = client_package_id and cp.org_id = public.auth_org_id()));

create policy giftcards_select on public.gift_cards for select to authenticated
  using (org_id = public.auth_org_id());
create policy giftcards_write on public.gift_cards for all to authenticated
  using (org_id = public.auth_org_id())
  with check (org_id = public.auth_org_id());

-- ---- inventory: STORE-scoped. read at accessible stores; owner/manager/front_desk adjust ----
create policy inventory_select on public.product_inventory for select to authenticated
  using (public.can_access_store(store_id));
create policy inventory_write on public.product_inventory for all to authenticated
  using (public.can_manage_store(store_id))
  with check (public.can_manage_store(store_id));

-- ========================= 05_reporting.sql =========================

-- ============================================================================
-- 05_reporting.sql  —  Tables the reporting suite needs that 01–04 didn't have.
-- The keystone is sale_items (line-level sales), which unlocks most Sales,
-- Staff, Gift Card, Package, and Membership reports. Everything follows the
-- established scoping + RLS patterns. Run after 01–04.
-- ============================================================================

-- enums -----------------------------------------------------------------------
do $$ begin create type sale_item_kind  as enum ('service','product','gift_card','package','membership','fee'); exception when duplicate_object then null; end $$;
do $$ begin create type gc_txn_kind     as enum ('issue','redeem','adjust');           exception when duplicate_object then null; end $$;
do $$ begin create type inv_move_kind   as enum ('receive','sale','adjust','transfer'); exception when duplicate_object then null; end $$;
do $$ begin create type deposit_status  as enum ('collected','applied','refunded');     exception when duplicate_object then null; end $$;
do $$ begin create type acct_txn_kind   as enum ('deposit','charge','refund');          exception when duplicate_object then null; end $$;
do $$ begin create type offer_kind      as enum ('percent','amount');                   exception when duplicate_object then null; end $$;

-- column additions ------------------------------------------------------------
alter table public.products           add column if not exists cost_cents  int  not null default 0;  -- COGS
alter table public.client_memberships add column if not exists canceled_on date;                       -- cancellations report
alter table public.appointments       add column if not exists canceled_at timestamptz;                -- cancellation timing

-- =========================== STORE-SCOPED EVENTS ============================
-- (RLS: read = can_access_store, write = can_manage_store, unless noted)

create table public.sale_items (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  store_id    uuid not null references public.stores(id)        on delete cascade,
  sale_id     uuid not null references public.sales(id)         on delete cascade,
  kind        sale_item_kind not null,
  ref_id      uuid,                          -- service_id / product_id / etc.
  description text not null,
  staff_id    uuid references public.staff(id) on delete set null,  -- who gets sales credit
  quantity    int not null default 1,
  unit_price_cents int not null default 0,
  total_cents int not null default 0,
  cost_cents  int not null default 0,        -- snapshot for COGS/margin
  created_at  timestamptz not null default now()
);
create index idx_saleitems_store_time on public.sale_items(store_id, created_at);
create index idx_saleitems_sale  on public.sale_items(sale_id);
create index idx_saleitems_staff on public.sale_items(staff_id);
create index idx_saleitems_kind  on public.sale_items(kind);

create table public.payments (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  store_id    uuid not null references public.stores(id)        on delete cascade,
  sale_id     uuid references public.sales(id) on delete set null,
  method      text not null default 'card',  -- card / cash / gift_card / account
  amount_cents int not null default 0,
  created_at  timestamptz not null default now()
);
create index idx_payments_store_time on public.payments(store_id, created_at);

create table public.cash_drawer_sessions (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  store_id      uuid not null references public.stores(id)        on delete cascade,
  opened_by     uuid references public.staff(id) on delete set null,
  opened_at     timestamptz not null default now(),
  closed_at     timestamptz,
  opening_cents int not null default 0,
  closing_cents int,
  expected_cents int
);
create index idx_drawer_store_time on public.cash_drawer_sessions(store_id, opened_at);

create table public.refunds (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  store_id    uuid not null references public.stores(id)        on delete cascade,
  sale_id     uuid references public.sales(id)   on delete set null,
  client_id   uuid references public.clients(id) on delete set null,
  staff_id    uuid references public.staff(id)   on delete set null,
  amount_cents int not null default 0,
  reason      text,
  created_at  timestamptz not null default now()
);
create index idx_refunds_store_time on public.refunds(store_id, created_at);

create table public.gift_card_transactions (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  store_id     uuid not null references public.stores(id)        on delete cascade,
  gift_card_id uuid not null references public.gift_cards(id)    on delete cascade,
  kind         gc_txn_kind not null,
  amount_cents int not null,                 -- + on issue, - on redeem
  created_at   timestamptz not null default now()
);
create index idx_gctxn_store_time on public.gift_card_transactions(store_id, created_at);
create index idx_gctxn_card on public.gift_card_transactions(gift_card_id);

create table public.inventory_movements (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  store_id    uuid not null references public.stores(id)        on delete cascade,
  product_id  uuid not null references public.products(id)      on delete cascade,
  kind        inv_move_kind not null,
  qty_delta   int not null,                  -- +received / -sold / +-adjust
  staff_id    uuid references public.staff(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index idx_invmove_store_time on public.inventory_movements(store_id, created_at);
create index idx_invmove_product on public.inventory_movements(product_id);

create table public.deposits (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id) on delete cascade,
  store_id       uuid not null references public.stores(id)        on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  client_id      uuid references public.clients(id) on delete set null,
  amount_cents   int not null default 0,
  status         deposit_status not null default 'collected',
  created_at     timestamptz not null default now()
);
create index idx_deposits_store_time on public.deposits(store_id, created_at);

-- time clock: store-scoped read; a staffer may write their OWN punches,
-- managers may write any at their store.
create table public.time_clock (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  store_id    uuid not null references public.stores(id)        on delete cascade,
  staff_id    uuid not null references public.staff(id)         on delete cascade,
  clock_in    timestamptz not null,
  clock_out   timestamptz,
  created_at  timestamptz not null default now()
);
create index idx_timeclock_store_time on public.time_clock(store_id, clock_in);
create index idx_timeclock_staff on public.time_clock(staff_id);

-- ============================ ORG-LEVEL =====================================

create table public.offers (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  name        text not null,
  kind        offer_kind not null default 'percent',
  value       numeric not null default 0,    -- percent (0–100) or cents
  code        text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index idx_offers_org on public.offers(org_id);

create table public.offer_redemptions (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  store_id    uuid not null references public.stores(id)        on delete cascade,
  offer_id    uuid not null references public.offers(id)        on delete cascade,
  sale_id     uuid references public.sales(id)   on delete set null,
  client_id   uuid references public.clients(id) on delete set null,
  amount_cents int not null default 0,        -- discount given
  created_at  timestamptz not null default now()
);
create index idx_offerredeem_store_time on public.offer_redemptions(store_id, created_at);
create index idx_offerredeem_offer on public.offer_redemptions(offer_id);

-- client account = store credit / wallet, follows the client across the org
create table public.client_accounts (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  client_id    uuid not null unique references public.clients(id) on delete cascade,
  balance_cents int not null default 0,
  updated_at   timestamptz not null default now()
);
create index idx_clientacct_org on public.client_accounts(org_id);
create trigger trg_clientacct_updated before update on public.client_accounts
  for each row execute function public.set_updated_at();

create table public.client_account_transactions (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  account_id  uuid not null references public.client_accounts(id) on delete cascade,
  store_id    uuid references public.stores(id) on delete set null,  -- where it happened
  kind        acct_txn_kind not null,
  amount_cents int not null,                  -- + deposit, - charge
  created_at  timestamptz not null default now()
);
create index idx_acctxn_account on public.client_account_transactions(account_id);

create table public.membership_payments (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references public.organizations(id) on delete cascade,
  client_membership_id uuid not null references public.client_memberships(id) on delete cascade,
  store_id           uuid references public.stores(id) on delete set null,
  amount_cents       int not null default 0,
  paid_on            date not null default current_date,
  created_at         timestamptz not null default now()
);
create index idx_mempay_org on public.membership_payments(org_id);

-- days off / PTO — org-readable (team visibility); manager or self writes
create table public.time_off (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  staff_id    uuid not null references public.staff(id) on delete cascade,
  start_date  date not null,
  end_date    date not null,
  reason      text,
  created_at  timestamptz not null default now()
);
create index idx_timeoff_org on public.time_off(org_id);

-- ===========================================================================
-- RLS
-- ===========================================================================
alter table public.sale_items                  enable row level security;
alter table public.payments                    enable row level security;
alter table public.cash_drawer_sessions        enable row level security;
alter table public.refunds                     enable row level security;
alter table public.gift_card_transactions      enable row level security;
alter table public.inventory_movements         enable row level security;
alter table public.deposits                    enable row level security;
alter table public.time_clock                  enable row level security;
alter table public.offers                      enable row level security;
alter table public.offer_redemptions           enable row level security;
alter table public.client_accounts             enable row level security;
alter table public.client_account_transactions enable row level security;
alter table public.membership_payments         enable row level security;
alter table public.time_off                    enable row level security;

grant select, insert, update, delete on
  public.sale_items, public.payments, public.cash_drawer_sessions, public.refunds,
  public.gift_card_transactions, public.inventory_movements, public.deposits,
  public.time_clock, public.offers, public.offer_redemptions, public.client_accounts,
  public.client_account_transactions, public.membership_payments, public.time_off
to authenticated;

-- ---- store-scoped events: read at accessible stores, write where you manage ----
do $$
declare t text;
begin
  foreach t in array array['sale_items','payments','cash_drawer_sessions','refunds',
                           'gift_card_transactions','inventory_movements','deposits',
                           'offer_redemptions'] loop
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (public.can_access_store(store_id));', t);
    execute format('create policy %1$s_write  on public.%1$s for all    to authenticated using (public.can_manage_store(store_id)) with check (public.can_manage_store(store_id));', t);
  end loop;
end $$;

-- time_clock: read at accessible stores; write if you manage the store OR it's your own punch
create policy time_clock_select on public.time_clock for select to authenticated
  using (public.can_access_store(store_id));
create policy time_clock_write on public.time_clock for all to authenticated
  using (public.can_manage_store(store_id) or staff_id = public.current_staff_id())
  with check (public.can_manage_store(store_id) or staff_id = public.current_staff_id());

-- ---- org-level: read within org; catalog (offers) owner/manager, rest org-wide ----
create policy offers_select on public.offers for select to authenticated
  using (org_id = public.auth_org_id());
create policy offers_write on public.offers for all to authenticated
  using (org_id = public.auth_org_id() and public.auth_role() in ('owner','manager'))
  with check (org_id = public.auth_org_id() and public.auth_role() in ('owner','manager'));

create policy client_accounts_select on public.client_accounts for select to authenticated
  using (org_id = public.auth_org_id());
create policy client_accounts_write on public.client_accounts for all to authenticated
  using (org_id = public.auth_org_id()) with check (org_id = public.auth_org_id());

create policy acct_txn_select on public.client_account_transactions for select to authenticated
  using (org_id = public.auth_org_id());
create policy acct_txn_write on public.client_account_transactions for all to authenticated
  using (org_id = public.auth_org_id()) with check (org_id = public.auth_org_id());

create policy mempay_select on public.membership_payments for select to authenticated
  using (org_id = public.auth_org_id());
create policy mempay_write on public.membership_payments for all to authenticated
  using (org_id = public.auth_org_id()) with check (org_id = public.auth_org_id());

-- time_off: org-readable; manager or the staffer themselves writes
create policy time_off_select on public.time_off for select to authenticated
  using (org_id = public.auth_org_id());
create policy time_off_write on public.time_off for all to authenticated
  using (org_id = public.auth_org_id()
         and (public.auth_role() in ('owner','manager') or staff_id = public.current_staff_id()))
  with check (org_id = public.auth_org_id()
         and (public.auth_role() in ('owner','manager') or staff_id = public.current_staff_id()));

-- ========================= 06_reports_seed.sql =========================

-- ============================================================================
-- 06_reports_seed.sql  —  Demo data so the report views return real numbers.
-- Turns each paid appointment into a sale + line item + payment, then adds a
-- product sale, gift card, membership activity, refund, offer, time punches,
-- and a client account. Run after 05. Safe to skip in production.
-- ============================================================================

-- 1) Backfill sales / sale_items / payments from every PAID appointment ------
with paid as (
  select * from public.appointments where status = 'paid'
),
s as (
  insert into public.sales (org_id,store_id,appointment_id,client_id,staff_id,subtotal_cents,tip_cents,total_cents,payment_method)
  select org_id,store_id,id,client_id,staff_id,price_cents,0,price_cents,'card' from paid
  returning id as sale_id, appointment_id, org_id, store_id, staff_id, total_cents
),
si as (
  insert into public.sale_items (org_id,store_id,sale_id,kind,ref_id,description,staff_id,quantity,unit_price_cents,total_cents,cost_cents)
  select s.org_id,s.store_id,s.sale_id,'service',a.service_id,sv.name,s.staff_id,1,s.total_cents,s.total_cents,0
  from s join public.appointments a on a.id = s.appointment_id
         join public.services sv on sv.id = a.service_id
  returning 1
)
insert into public.payments (org_id,store_id,sale_id,method,amount_cents)
select org_id,store_id,sale_id,'card',total_cents from s;

-- 2) Products + inventory ----------------------------------------------------
insert into public.products (id,org_id,name,sku,price_cents,cost_cents) values
  ('c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','Argan Oil Treatment','AO-01',2800,1200),
  ('c0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','Styling Cream','SC-01',2200,800);
insert into public.product_inventory (product_id,store_id,qty_on_hand,reorder_point) values
  ('c0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001',12,4),
  ('c0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000002',3,4),
  ('c0000000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000001',6,3);
-- receiving movements
insert into public.inventory_movements (org_id,store_id,product_id,kind,qty_delta) values
  ('a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','receive',12),
  ('a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000001','receive',3),
  ('a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000002','receive',6);

-- 3) A retail sale (Argan Oil, Layton, Maya -> Hannah) -----------------------
with rs as (
  insert into public.sales (id,org_id,store_id,client_id,staff_id,subtotal_cents,tip_cents,total_cents,payment_method)
  values ('d5000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','a4000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000002',2800,0,2800,'card')
  returning id, org_id, store_id, staff_id
)
insert into public.sale_items (org_id,store_id,sale_id,kind,ref_id,description,staff_id,quantity,unit_price_cents,total_cents,cost_cents)
select org_id,store_id,id,'product','c0000000-0000-0000-0000-000000000001','Argan Oil Treatment',staff_id,1,2800,2800,1200 from rs;
insert into public.payments (org_id,store_id,sale_id,method,amount_cents)
  values ('a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','d5000000-0000-0000-0000-000000000001','card',2800);
-- and the stock move + decrement
insert into public.inventory_movements (org_id,store_id,product_id,kind,qty_delta,staff_id)
  values ('a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','sale',-1,'a2000000-0000-0000-0000-000000000002');
update public.product_inventory set qty_on_hand = qty_on_hand - 1
  where product_id='c0000000-0000-0000-0000-000000000001' and store_id='a1000000-0000-0000-0000-000000000001';

-- 4) Gift card ---------------------------------------------------------------
insert into public.gift_cards (id,org_id,code,initial_cents,balance_cents,purchaser_client_id) values
  ('e1000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','LUMEN-50',5000,3500,'a4000000-0000-0000-0000-000000000001');
insert into public.gift_card_transactions (org_id,store_id,gift_card_id,kind,amount_cents) values
  ('a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','e1000000-0000-0000-0000-000000000001','issue',5000),
  ('a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','e1000000-0000-0000-0000-000000000001','redeem',-1500);

-- 5) Memberships -------------------------------------------------------------
insert into public.membership_plans (id,org_id,name,price_cents,benefits) values
  ('f1000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','VIP Monthly',9900,'10% off services + monthly facial');
insert into public.client_memberships (id,org_id,client_id,plan_id,status,started_on,renews_on) values
  ('f2000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','a4000000-0000-0000-0000-000000000002','f1000000-0000-0000-0000-000000000001','active', current_date - 40, current_date + 20),
  ('f2000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','a4000000-0000-0000-0000-000000000005','f1000000-0000-0000-0000-000000000001','active', current_date - 12, current_date + 18);
-- one cancellation
insert into public.client_memberships (id,org_id,client_id,plan_id,status,started_on,canceled_on) values
  ('f2000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000001','a4000000-0000-0000-0000-000000000003','f1000000-0000-0000-0000-000000000001','canceled', current_date - 90, current_date - 5);
insert into public.membership_payments (org_id,client_membership_id,store_id,amount_cents,paid_on) values
  ('a0000000-0000-0000-0000-000000000001','f2000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001',9900, current_date - 10),
  ('a0000000-0000-0000-0000-000000000001','f2000000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000002',9900, current_date - 12);

-- 6) Offer + redemption ------------------------------------------------------
insert into public.offers (id,org_id,name,kind,value,code) values
  ('a8000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','New Client 20%','percent',20,'NEW20');
insert into public.offer_redemptions (org_id,store_id,offer_id,client_id,amount_cents) values
  ('a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','a8000000-0000-0000-0000-000000000001','a4000000-0000-0000-0000-000000000001',1500);

-- 7) Refund ------------------------------------------------------------------
insert into public.refunds (org_id,store_id,client_id,staff_id,amount_cents,reason) values
  ('a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000002','a4000000-0000-0000-0000-000000000004','a2000000-0000-0000-0000-000000000006',2000,'Client rescheduled - deposit returned');

-- 8) Time clock + days off ---------------------------------------------------
insert into public.time_clock (org_id,store_id,staff_id,clock_in,clock_out) values
  ('a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000002',(now()::date)+time '08:45', null),
  ('a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000002','a2000000-0000-0000-0000-000000000007',(now()::date)+time '08:30',(now()::date)+time '16:30');
insert into public.time_off (org_id,staff_id,start_date,end_date,reason) values
  ('a0000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000005', current_date + 5, current_date + 7,'Vacation');

-- 9) Client account (store credit) -------------------------------------------
insert into public.client_accounts (id,org_id,client_id,balance_cents) values
  ('a9000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','a4000000-0000-0000-0000-000000000001',3000);
insert into public.client_account_transactions (org_id,account_id,store_id,kind,amount_cents) values
  ('a0000000-0000-0000-0000-000000000001','a9000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','deposit',5000),
  ('a0000000-0000-0000-0000-000000000001','a9000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','charge',-2000);

-- 10) A collected deposit on an upcoming appointment -------------------------
insert into public.deposits (org_id,store_id,client_id,amount_cents,status) values
  ('a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','a4000000-0000-0000-0000-000000000004',2500,'collected');

-- ========================= 07_reports.sql =========================

-- ============================================================================
-- 07_reports.sql  —  Report views (wave 1). Each report = one view.
--
-- CRITICAL: every view is WITH (security_invoker = true) so the underlying RLS
-- runs as the CALLER, not the view owner. That means the SAME view returns
-- org/store/role-appropriate rows automatically — an owner sees all stores, a
-- stylist sees only theirs, a rival org sees nothing. The frontend just selects.
--
-- Naming: rpt_<category>_<name>. Run after 05 (and 06 for demo numbers).
-- ============================================================================

-- ============================== SALES ======================================

-- Sales Summary — gross by type, refunds, net, per store per day
create or replace view public.rpt_sales_summary
  with (security_invoker = true) as
with sales_by_day as (
  select si.store_id, date_trunc('day', si.created_at)::date as day,
    sum(si.total_cents) filter (where si.kind='service')   as service_cents,
    sum(si.total_cents) filter (where si.kind='product')   as product_cents,
    sum(si.total_cents) filter (where si.kind='gift_card') as gift_card_cents,
    sum(si.total_cents) filter (where si.kind in ('package','membership','fee')) as other_cents,
    sum(si.total_cents) as gross_cents
  from public.sale_items si
  group by si.store_id, date_trunc('day', si.created_at)
),
refunds_by_day as (
  select store_id, date_trunc('day', created_at)::date as day, sum(amount_cents) as refund_cents
  from public.refunds group by store_id, date_trunc('day', created_at)
)
select sb.store_id, st.name as store, sb.day,
       sb.service_cents, sb.product_cents, sb.gift_card_cents, sb.other_cents, sb.gross_cents,
       coalesce(rb.refund_cents, 0) as refund_cents,
       sb.gross_cents - coalesce(rb.refund_cents, 0) as net_cents
from sales_by_day sb
join public.stores st on st.id = sb.store_id
left join refunds_by_day rb on rb.store_id = sb.store_id and rb.day = sb.day;

-- Service Sales — by service, store
create or replace view public.rpt_service_sales
  with (security_invoker = true) as
select si.store_id, st.name as store, si.description as service,
       count(*) as qty, sum(si.total_cents) as revenue_cents
from public.sale_items si join public.stores st on st.id=si.store_id
where si.kind='service'
group by si.store_id, st.name, si.description
order by revenue_cents desc;

-- Product Sales — by product, store
create or replace view public.rpt_product_sales
  with (security_invoker = true) as
select si.store_id, st.name as store, si.description as product,
       sum(si.quantity) as units, sum(si.total_cents) as revenue_cents
from public.sale_items si join public.stores st on st.id=si.store_id
where si.kind='product'
group by si.store_id, st.name, si.description
order by revenue_cents desc;

-- Sales by Time Period — daily totals, ticket count, avg ticket
create or replace view public.rpt_sales_by_period
  with (security_invoker = true) as
select s.store_id, st.name as store,
       date_trunc('day', s.created_at)::date as day,
       count(*) as tickets,
       sum(s.total_cents) as sales_cents,
       round(avg(s.total_cents))::int as avg_ticket_cents
from public.sales s join public.stores st on st.id=s.store_id
group by s.store_id, st.name, date_trunc('day', s.created_at)
order by day, store;

-- ============================== STAFF ======================================

-- Service & Product Sales By Staff
create or replace view public.rpt_staff_sales
  with (security_invoker = true) as
select si.store_id, st.name as store, sf.id as staff_id, sf.name as staff,
       sum(si.total_cents) filter (where si.kind='service') as service_cents,
       sum(si.total_cents) filter (where si.kind='product') as product_cents,
       sum(si.total_cents) as total_cents
from public.sale_items si
join public.stores st on st.id=si.store_id
join public.staff  sf on sf.id=si.staff_id
group by si.store_id, st.name, sf.id, sf.name
order by total_cents desc;

-- Time Clock — hours per staff (open punches show null hours)
create or replace view public.rpt_time_clock
  with (security_invoker = true) as
select tc.store_id, st.name as store, sf.name as staff,
       tc.clock_in, tc.clock_out,
       round(extract(epoch from (tc.clock_out - tc.clock_in))/3600.0, 2) as hours
from public.time_clock tc
join public.stores st on st.id=tc.store_id
join public.staff  sf on sf.id=tc.staff_id
order by tc.clock_in desc;

-- Days Off
create or replace view public.rpt_days_off
  with (security_invoker = true) as
select sf.name as staff, t.start_date, t.end_date,
       (t.end_date - t.start_date + 1) as days, t.reason
from public.time_off t join public.staff sf on sf.id=t.staff_id
order by t.start_date;

-- ============================ REFUNDS / PAYMENTS ===========================

create or replace view public.rpt_refund_summary
  with (security_invoker = true) as
select r.store_id, st.name as store, date_trunc('day',r.created_at)::date as day,
       count(*) as refunds, sum(r.amount_cents) as refund_cents
from public.refunds r join public.stores st on st.id=r.store_id
group by r.store_id, st.name, date_trunc('day',r.created_at);

create or replace view public.rpt_payment_summary
  with (security_invoker = true) as
select p.store_id, st.name as store, p.method,
       count(*) as count, sum(p.amount_cents) as amount_cents
from public.payments p join public.stores st on st.id=p.store_id
group by p.store_id, st.name, p.method
order by amount_cents desc;

-- ============================== GIFT CARDS =================================

create or replace view public.rpt_gift_card_balances
  with (security_invoker = true) as
select code, initial_cents, balance_cents,
       (initial_cents - balance_cents) as redeemed_cents, issued_at
from public.gift_cards
where balance_cents > 0
order by balance_cents desc;

create or replace view public.rpt_gift_card_sales
  with (security_invoker = true) as
select date_trunc('month', issued_at)::date as month,
       count(*) as cards_sold, sum(initial_cents) as face_value_cents
from public.gift_cards
group by date_trunc('month', issued_at);

-- ============================== PACKAGES ===================================

create or replace view public.rpt_outstanding_packages
  with (security_invoker = true) as
select cp.id as client_package_id, c.name as client, pk.name as package,
       sum(cpi.remaining) as sessions_remaining
from public.client_packages cp
join public.clients c  on c.id = cp.client_id
join public.packages pk on pk.id = cp.package_id
left join public.client_package_items cpi on cpi.client_package_id = cp.id
group by cp.id, c.name, pk.name
having coalesce(sum(cpi.remaining),0) > 0;

create or replace view public.rpt_package_sales
  with (security_invoker = true) as
select si.store_id, st.name as store, si.description as package,
       count(*) as sold, sum(si.total_cents) as revenue_cents
from public.sale_items si join public.stores st on st.id=si.store_id
where si.kind='package'
group by si.store_id, st.name, si.description;

-- ============================ MEMBERSHIPS ==================================

create or replace view public.rpt_memberships_started
  with (security_invoker = true) as
select date_trunc('month', cm.started_on)::date as month, mp.name as plan,
       count(*) as started
from public.client_memberships cm
join public.membership_plans mp on mp.id = cm.plan_id
group by date_trunc('month', cm.started_on), mp.name
order by month;

create or replace view public.rpt_membership_cancellations
  with (security_invoker = true) as
select date_trunc('month', cm.canceled_on)::date as month, mp.name as plan,
       count(*) as canceled
from public.client_memberships cm
join public.membership_plans mp on mp.id = cm.plan_id
where cm.canceled_on is not null
group by date_trunc('month', cm.canceled_on), mp.name;

create or replace view public.rpt_membership_payments
  with (security_invoker = true) as
select date_trunc('month', mpay.paid_on)::date as month, mp.name as plan,
       count(*) as payments, sum(mpay.amount_cents) as collected_cents
from public.membership_payments mpay
join public.client_memberships cm on cm.id = mpay.client_membership_id
join public.membership_plans mp on mp.id = cm.plan_id
group by date_trunc('month', mpay.paid_on), mp.name
order by month;

-- ============================== INVENTORY ==================================

create or replace view public.rpt_product_inventory
  with (security_invoker = true) as
select pi.store_id, st.name as store, p.name as product, p.sku,
       pi.qty_on_hand, pi.reorder_point,
       (pi.qty_on_hand * p.cost_cents) as stock_value_cents,
       (pi.qty_on_hand <= pi.reorder_point) as needs_reorder
from public.product_inventory pi
join public.stores st on st.id = pi.store_id
join public.products p on p.id = pi.product_id
order by store, product;

create or replace view public.rpt_cost_of_goods
  with (security_invoker = true) as
select si.store_id, st.name as store, si.description as product,
       sum(si.quantity)                       as units_sold,
       sum(si.total_cents)                    as revenue_cents,
       sum(si.cost_cents * si.quantity)       as cogs_cents,
       sum(si.total_cents - si.cost_cents*si.quantity) as gross_margin_cents
from public.sale_items si join public.stores st on st.id=si.store_id
where si.kind='product'
group by si.store_id, st.name, si.description;

create or replace view public.rpt_inventory_changes
  with (security_invoker = true) as
select im.store_id, st.name as store, p.name as product,
       im.kind, im.qty_delta, im.created_at
from public.inventory_movements im
join public.stores st on st.id=im.store_id
join public.products p on p.id=im.product_id
order by im.created_at desc;

-- ============================== BUSINESS ===================================

-- BI: Appointments — volume & status mix per store per day
create or replace view public.rpt_bi_appointments
  with (security_invoker = true) as
select a.store_id, st.name as store, date_trunc('day', a.starts_at)::date as day,
       count(*) as appts,
       count(*) filter (where a.status='paid')     as completed,
       count(*) filter (where a.status='canceled') as canceled,
       round(sum(extract(epoch from (a.ends_at-a.starts_at))/3600.0)::numeric,1) as booked_hours
from public.appointments a join public.stores st on st.id=a.store_id
group by a.store_id, st.name, date_trunc('day', a.starts_at)
order by day, store;

-- Appointment Cancellations
create or replace view public.rpt_appointment_cancellations
  with (security_invoker = true) as
select a.store_id, st.name as store, c.name as client, sf.name as staff,
       a.starts_at, coalesce(a.canceled_at, a.updated_at) as canceled_at
from public.appointments a
join public.stores st on st.id=a.store_id
join public.clients c on c.id=a.client_id
join public.staff sf on sf.id=a.staff_id
where a.status='canceled';

-- Client Retention — visit counts, first/last visit, lifetime spend
create or replace view public.rpt_client_retention
  with (security_invoker = true) as
select c.id as client_id, c.name as client,
       count(a.id)                              as visits,
       min(a.starts_at)::date                   as first_visit,
       max(a.starts_at)::date                   as last_visit,
       coalesce(sum(s.total_cents),0)           as lifetime_cents
from public.clients c
left join public.appointments a on a.client_id = c.id and a.status='paid'
left join public.sales s on s.appointment_id = a.id
group by c.id, c.name
order by visits desc;

-- Cashflow — net cash in per store per day (payments - refunds)
create or replace view public.rpt_cashflow
  with (security_invoker = true) as
with pay as (
  select store_id, date_trunc('day', created_at)::date as day, sum(amount_cents) as payments_cents
  from public.payments group by store_id, date_trunc('day', created_at)
),
ref as (
  select store_id, date_trunc('day', created_at)::date as day, sum(amount_cents) as refunds_cents
  from public.refunds group by store_id, date_trunc('day', created_at)
)
select p.store_id, st.name as store, p.day,
       p.payments_cents,
       coalesce(r.refunds_cents, 0) as refunds_cents,
       p.payments_cents - coalesce(r.refunds_cents, 0) as net_cents
from pay p
join public.stores st on st.id = p.store_id
left join ref r on r.store_id = p.store_id and r.day = p.day
order by p.day, store;

-- ========================= 08_reports_wave2.sql =========================

-- ============================================================================
-- 08_reports_wave2.sql  —  The remaining reports, completing the suite.
-- Adds two small tables the last reports required (package redemptions,
-- membership credits), a little demo data for them, then all remaining views.
-- Every view is WITH (security_invoker = true). Run after 07.
-- ============================================================================

do $$ begin create type mc_kind as enum ('granted','used'); exception when duplicate_object then null; end $$;

-- ---- new tables ------------------------------------------------------------
-- Package Usage needs a redemption log (when a pre-paid session is drawn down).
create table public.package_redemptions (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations(id) on delete cascade,
  store_id          uuid not null references public.stores(id)        on delete cascade,
  client_package_id uuid not null references public.client_packages(id) on delete cascade,
  service_id        uuid references public.services(id) on delete set null,
  appointment_id    uuid references public.appointments(id) on delete set null,
  staff_id          uuid references public.staff(id) on delete set null,
  redeemed_at       timestamptz not null default now()
);
create index idx_pkgredeem_store_time on public.package_redemptions(store_id, redeemed_at);

-- Membership Credit Usage needs a credit ledger (credits granted vs spent).
create table public.membership_credits (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null references public.organizations(id) on delete cascade,
  client_membership_id uuid not null references public.client_memberships(id) on delete cascade,
  store_id             uuid references public.stores(id) on delete set null,
  kind                 mc_kind not null,
  amount_cents         int not null,
  created_at           timestamptz not null default now()
);
create index idx_memcredits_org on public.membership_credits(org_id);

alter table public.package_redemptions enable row level security;
alter table public.membership_credits  enable row level security;
grant select, insert, update, delete on public.package_redemptions, public.membership_credits to authenticated;

create policy pkgredeem_select on public.package_redemptions for select to authenticated
  using (public.can_access_store(store_id));
create policy pkgredeem_write on public.package_redemptions for all to authenticated
  using (public.can_manage_store(store_id)) with check (public.can_manage_store(store_id));

create policy memcredits_select on public.membership_credits for select to authenticated
  using (org_id = public.auth_org_id());
create policy memcredits_write on public.membership_credits for all to authenticated
  using (org_id = public.auth_org_id()) with check (org_id = public.auth_org_id());

-- ---- demo data so the new views return numbers -----------------------------
-- a package + a client who bought it + a redemption
insert into public.packages (id,org_id,name,price_cents) values
  ('a7000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','Facial Series (3)',29700);
insert into public.package_items (package_id,service_id,quantity) values
  ('a7000000-0000-0000-0000-000000000001','a3000000-0000-0000-0000-000000000003',3);
insert into public.client_packages (id,org_id,client_id,package_id) values
  ('a7100000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','a4000000-0000-0000-0000-000000000006','a7000000-0000-0000-0000-000000000001');
insert into public.client_package_items (client_package_id,service_id,remaining) values
  ('a7100000-0000-0000-0000-000000000001','a3000000-0000-0000-0000-000000000003',2);   -- 1 of 3 used
insert into public.package_redemptions (org_id,store_id,client_package_id,service_id) values
  ('a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000003','a7100000-0000-0000-0000-000000000001','a3000000-0000-0000-0000-000000000003');
-- package sale line item (so Package Sales / Details light up)
with ps as (
  insert into public.sales (id,org_id,store_id,client_id,subtotal_cents,total_cents,payment_method)
  values ('a7200000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000003','a4000000-0000-0000-0000-000000000006',29700,29700,'card')
  returning id, org_id, store_id
)
insert into public.sale_items (org_id,store_id,sale_id,kind,ref_id,description,quantity,unit_price_cents,total_cents)
select org_id,store_id,id,'package','a7000000-0000-0000-0000-000000000001','Facial Series (3)',1,29700,29700 from ps;

-- membership credits: each active membership granted $20/mo, one used $20
insert into public.membership_credits (org_id,client_membership_id,store_id,kind,amount_cents) values
  ('a0000000-0000-0000-0000-000000000001','f2000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','granted',2000),
  ('a0000000-0000-0000-0000-000000000001','f2000000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000002','granted',2000),
  ('a0000000-0000-0000-0000-000000000001','f2000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','used',2000);

-- a deposit marked applied (for Deposits Used)
insert into public.deposits (org_id,store_id,client_id,amount_cents,status) values
  ('a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000002','a4000000-0000-0000-0000-000000000005',3000,'applied');

-- a cash drawer session (for Cash Drawer Activity)
insert into public.cash_drawer_sessions (org_id,store_id,opened_by,opened_at,closed_at,opening_cents,closing_cents,expected_cents) values
  ('a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000002',(now()::date)+time '08:00',(now()::date)+time '17:00',20000,24500,24800);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- REFUNDS ---------------------------------------------------------------------
create or replace view public.rpt_refund_details with (security_invoker = true) as
select r.created_at, st.name as store, c.name as client, sf.name as staff,
       r.amount_cents, r.reason
from public.refunds r
join public.stores st on st.id=r.store_id
left join public.clients c on c.id=r.client_id
left join public.staff sf on sf.id=r.staff_id
order by r.created_at desc;

-- OFFERS ----------------------------------------------------------------------
create or replace view public.rpt_offers_usage with (security_invoker = true) as
select o.name as offer, st.name as store, count(orr.*) as redemptions,
       coalesce(sum(orr.amount_cents),0) as discount_cents
from public.offer_redemptions orr
join public.offers o  on o.id=orr.offer_id
join public.stores st on st.id=orr.store_id
group by o.name, st.name
order by discount_cents desc;

create or replace view public.rpt_offers_summary with (security_invoker = true) as
select o.name as offer, o.kind, o.value, o.code, o.is_active,
       count(orr.*) as lifetime_redemptions,
       coalesce(sum(orr.amount_cents),0) as lifetime_discount_cents
from public.offers o
left join public.offer_redemptions orr on orr.offer_id=o.id
group by o.id, o.name, o.kind, o.value, o.code, o.is_active;

-- CLIENT ACCOUNTS -------------------------------------------------------------
create or replace view public.rpt_client_account_balances with (security_invoker = true) as
select c.name as client, ca.balance_cents
from public.client_accounts ca join public.clients c on c.id=ca.client_id
order by ca.balance_cents desc;

create or replace view public.rpt_client_account_usage with (security_invoker = true) as
select c.name as client,
       sum(t.amount_cents) filter (where t.kind='deposit') as deposited_cents,
       -sum(t.amount_cents) filter (where t.kind='charge') as charged_cents,
       ca.balance_cents
from public.client_accounts ca
join public.clients c on c.id=ca.client_id
left join public.client_account_transactions t on t.account_id=ca.id
group by c.name, ca.balance_cents;

create or replace view public.rpt_client_account_deposits with (security_invoker = true) as
select t.created_at, c.name as client, st.name as store, t.amount_cents
from public.client_account_transactions t
join public.client_accounts ca on ca.id=t.account_id
join public.clients c on c.id=ca.client_id
left join public.stores st on st.id=t.store_id
where t.kind='deposit'
order by t.created_at desc;

-- GIFT CARDS ------------------------------------------------------------------
create or replace view public.rpt_gift_card_usage with (security_invoker = true) as
select date_trunc('month', t.created_at)::date as month, st.name as store,
       count(*) as redemptions, -sum(t.amount_cents) as redeemed_cents
from public.gift_card_transactions t
join public.stores st on st.id=t.store_id
where t.kind='redeem'
group by date_trunc('month', t.created_at), st.name;

create or replace view public.rpt_gift_card_sales_details with (security_invoker = true) as
select g.code, g.initial_cents, g.balance_cents, c.name as purchaser, g.issued_at
from public.gift_cards g
left join public.clients c on c.id=g.purchaser_client_id
order by g.issued_at desc;

-- PACKAGES --------------------------------------------------------------------
create or replace view public.rpt_package_usage with (security_invoker = true) as
select pk.name as package, sv.name as service, st.name as store,
       count(*) as redemptions, max(pr.redeemed_at) as last_redeemed
from public.package_redemptions pr
join public.client_packages cp on cp.id=pr.client_package_id
join public.packages pk on pk.id=cp.package_id
left join public.services sv on sv.id=pr.service_id
join public.stores st on st.id=pr.store_id
group by pk.name, sv.name, st.name;

create or replace view public.rpt_package_sales_details with (security_invoker = true) as
select si.created_at, st.name as store, c.name as client, si.description as package, si.total_cents
from public.sale_items si
join public.stores st on st.id=si.store_id
join public.sales s on s.id=si.sale_id
left join public.clients c on c.id=s.client_id
where si.kind='package'
order by si.created_at desc;

-- MEMBERSHIPS -----------------------------------------------------------------
create or replace view public.rpt_membership_credit_usage with (security_invoker = true) as
select mp.name as plan,
       sum(mc.amount_cents) filter (where mc.kind='granted') as granted_cents,
       sum(mc.amount_cents) filter (where mc.kind='used')    as used_cents,
       coalesce(sum(mc.amount_cents) filter (where mc.kind='granted'),0)
         - coalesce(sum(mc.amount_cents) filter (where mc.kind='used'),0) as outstanding_cents
from public.membership_credits mc
join public.client_memberships cm on cm.id=mc.client_membership_id
join public.membership_plans mp on mp.id=cm.plan_id
group by mp.name;

-- PAYMENTS --------------------------------------------------------------------
create or replace view public.rpt_payment_details with (security_invoker = true) as
select p.created_at, st.name as store, p.method, p.amount_cents, p.sale_id
from public.payments p join public.stores st on st.id=p.store_id
order by p.created_at desc;

create or replace view public.rpt_cash_drawer_activity with (security_invoker = true) as
select cd.opened_at, cd.closed_at, st.name as store, sf.name as opened_by,
       cd.opening_cents, cd.closing_cents, cd.expected_cents,
       (cd.closing_cents - cd.expected_cents) as variance_cents
from public.cash_drawer_sessions cd
join public.stores st on st.id=cd.store_id
left join public.staff sf on sf.id=cd.opened_by
order by cd.opened_at desc;

create or replace view public.rpt_deposits_collected with (security_invoker = true) as
select d.created_at, st.name as store, c.name as client, d.amount_cents
from public.deposits d
join public.stores st on st.id=d.store_id
left join public.clients c on c.id=d.client_id
where d.status='collected'
order by d.created_at desc;

create or replace view public.rpt_deposits_used with (security_invoker = true) as
select d.created_at, st.name as store, c.name as client, d.amount_cents
from public.deposits d
join public.stores st on st.id=d.store_id
left join public.clients c on c.id=d.client_id
where d.status='applied'
order by d.created_at desc;

-- INVENTORY -------------------------------------------------------------------
create or replace view public.rpt_product_stock_usage with (security_invoker = true) as
select pi.store_id, st.name as store, p.name as product, pi.qty_on_hand,
       coalesce(sum(im.qty_delta) filter (where im.kind='receive'),0)  as received,
       -coalesce(sum(im.qty_delta) filter (where im.kind='sale'),0)    as sold
from public.product_inventory pi
join public.stores st on st.id=pi.store_id
join public.products p on p.id=pi.product_id
left join public.inventory_movements im on im.product_id=pi.product_id and im.store_id=pi.store_id
group by pi.store_id, st.name, p.name, pi.qty_on_hand;

-- BUSINESS --------------------------------------------------------------------
-- BI: Sales — a small cube (store × day × kind)
create or replace view public.rpt_bi_sales with (security_invoker = true) as
select st.name as store, date_trunc('day', si.created_at)::date as day,
       si.kind, count(*) as lines, sum(si.total_cents) as revenue_cents
from public.sale_items si join public.stores st on st.id=si.store_id
group by st.name, date_trunc('day', si.created_at), si.kind
order by day, store, si.kind;

-- BI: Forecast — derived (no new table): recent daily avg × 7 + booked pipeline
create or replace view public.rpt_bi_forecast with (security_invoker = true) as
with daily as (
  select store_id, date_trunc('day',created_at)::date as d, sum(amount_cents) amt
  from public.payments group by store_id, date_trunc('day',created_at)
),
stats as (select store_id, round(avg(amt))::int as avg_daily_cents from daily group by store_id),
pipeline as (
  select store_id, sum(price_cents) as booked_pipeline_cents
  from public.appointments
  where status in ('booked','confirmed','checked_in') and starts_at >= now()
  group by store_id
)
select st.name as store,
       coalesce(s.avg_daily_cents,0)        as avg_daily_cents,
       coalesce(s.avg_daily_cents,0) * 7    as projected_7day_cents,
       coalesce(pl.booked_pipeline_cents,0) as booked_pipeline_cents
from public.stores st
left join stats s on s.store_id=st.id
left join pipeline pl on pl.store_id=st.id
order by store;

-- DATA EXPORT -----------------------------------------------------------------
create or replace view public.rpt_export_appointments with (security_invoker = true) as
select a.id, st.name as store, a.starts_at, a.ends_at, a.status,
       c.name as client, sf.name as staff, sv.name as service, a.price_cents
from public.appointments a
join public.stores st on st.id=a.store_id
join public.clients c on c.id=a.client_id
join public.staff sf on sf.id=a.staff_id
join public.services sv on sv.id=a.service_id
order by a.starts_at;

-- ========================= 09_modules.sql =========================

-- ============================================================================
-- 09_modules.sql  —  The six modules that had UI but no schema yet:
-- Inbox, Forms, Campaigns, Flows, Resources, Payroll. After this the data
-- model covers every app in the launcher. Same org/store + RLS patterns.
-- Run after 08. Helper functions come from 02_security.sql.
-- ============================================================================

-- enums -----------------------------------------------------------------------
do $$ begin create type msg_channel     as enum ('sms','email','web');                         exception when duplicate_object then null; end $$;
do $$ begin create type msg_direction   as enum ('inbound','outbound');                        exception when duplicate_object then null; end $$;
do $$ begin create type convo_status    as enum ('open','closed');                             exception when duplicate_object then null; end $$;
do $$ begin create type form_field_type as enum ('text','textarea','select','checkbox','signature','date'); exception when duplicate_object then null; end $$;
do $$ begin create type campaign_channel as enum ('email','sms');                              exception when duplicate_object then null; end $$;
do $$ begin create type campaign_status as enum ('draft','scheduled','sending','sent');        exception when duplicate_object then null; end $$;
do $$ begin create type recipient_status as enum ('queued','sent','opened','clicked','bounced'); exception when duplicate_object then null; end $$;
do $$ begin create type flow_trigger    as enum ('appointment_booked','appointment_canceled','checkout_completed','no_show','client_birthday','form_submitted','membership_started'); exception when duplicate_object then null; end $$;
do $$ begin create type flow_action     as enum ('send_sms','send_email','add_credit','send_rebook_link'); exception when duplicate_object then null; end $$;
do $$ begin create type flow_run_status as enum ('queued','sent','failed','skipped');          exception when duplicate_object then null; end $$;
do $$ begin create type resource_type   as enum ('room','equipment','station');                exception when duplicate_object then null; end $$;
do $$ begin create type pay_status      as enum ('open','processing','paid');                  exception when duplicate_object then null; end $$;

-- ============================ INBOX (store-scoped) ==========================
create table public.conversations (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  store_id        uuid not null references public.stores(id)        on delete cascade,
  client_id       uuid references public.clients(id) on delete set null,
  channel         msg_channel not null default 'sms',
  status          convo_status not null default 'open',
  last_message_at timestamptz not null default now(),
  unread          int not null default 0,
  created_at      timestamptz not null default now()
);
create index idx_convo_store_time on public.conversations(store_id, last_message_at desc);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  store_id        uuid not null references public.stores(id)        on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  direction       msg_direction not null,
  body            text not null,
  sent_by         uuid references public.staff(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index idx_msg_convo on public.messages(conversation_id, created_at);

-- ============================ FORMS (org-level) ============================
create table public.forms (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  name        text not null,
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index idx_forms_org on public.forms(org_id);

create table public.form_fields (
  id        uuid primary key default gen_random_uuid(),
  form_id   uuid not null references public.forms(id) on delete cascade,
  label     text not null,
  type      form_field_type not null default 'text',
  required  boolean not null default false,
  position  int not null default 0,
  options   jsonb
);
create index idx_formfields_form on public.form_fields(form_id, position);

create table public.form_submissions (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  form_id      uuid not null references public.forms(id) on delete cascade,
  client_id    uuid references public.clients(id) on delete set null,
  store_id     uuid references public.stores(id) on delete set null,
  data         jsonb not null default '{}',
  submitted_at timestamptz not null default now()
);
create index idx_formsub_form on public.form_submissions(form_id, submitted_at desc);

-- ============================ CAMPAIGNS (org-level) ========================
create table public.campaigns (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  name          text not null,
  channel       campaign_channel not null default 'email',
  subject       text,
  body          text,
  status        campaign_status not null default 'draft',
  scheduled_for timestamptz,
  sent_at       timestamptz,
  created_at    timestamptz not null default now()
);
create index idx_campaigns_org on public.campaigns(org_id);

create table public.campaign_recipients (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  client_id   uuid references public.clients(id) on delete set null,
  status      recipient_status not null default 'queued',
  sent_at     timestamptz
);
create index idx_camprcpt_campaign on public.campaign_recipients(campaign_id);

-- ============================ FLOWS (org-level) ============================
create table public.flows (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  name        text not null,
  trigger     flow_trigger not null,
  action      flow_action not null,
  config      jsonb not null default '{}',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index idx_flows_org on public.flows(org_id);

create table public.flow_runs (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  flow_id     uuid not null references public.flows(id) on delete cascade,
  client_id   uuid references public.clients(id) on delete set null,
  status      flow_run_status not null default 'queued',
  ran_at      timestamptz not null default now()
);
create index idx_flowruns_flow on public.flow_runs(flow_id, ran_at desc);

-- ============================ RESOURCES (store-scoped) =====================
create table public.resources (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  store_id    uuid not null references public.stores(id)        on delete cascade,
  name        text not null,
  type        resource_type not null default 'room',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index idx_resources_store on public.resources(store_id);

create table public.resource_bookings (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id) on delete cascade,
  store_id       uuid not null references public.stores(id)        on delete cascade,
  resource_id    uuid not null references public.resources(id)     on delete cascade,
  appointment_id uuid references public.appointments(id) on delete cascade,
  starts_at      timestamptz not null,
  ends_at        timestamptz not null
);
create index idx_resbook_resource on public.resource_bookings(resource_id, starts_at);

-- ============================ PAYROLL (org-level, sensitive) ===============
create table public.pay_periods (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  starts_on   date not null,
  ends_on     date not null,
  status      pay_status not null default 'open',
  created_at  timestamptz not null default now()
);
create index idx_payperiods_org on public.pay_periods(org_id);

create table public.pay_runs (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations(id) on delete cascade,
  pay_period_id    uuid not null references public.pay_periods(id) on delete cascade,
  staff_id         uuid not null references public.staff(id) on delete cascade,
  commission_cents int not null default 0,
  tips_cents       int not null default 0,
  base_cents       int not null default 0,
  total_cents      int not null default 0,
  status           pay_status not null default 'open'
);
create index idx_payruns_period on public.pay_runs(pay_period_id);

-- ===========================================================================
-- RLS
-- ===========================================================================
alter table public.conversations       enable row level security;
alter table public.messages            enable row level security;
alter table public.forms               enable row level security;
alter table public.form_fields         enable row level security;
alter table public.form_submissions    enable row level security;
alter table public.campaigns           enable row level security;
alter table public.campaign_recipients enable row level security;
alter table public.flows               enable row level security;
alter table public.flow_runs           enable row level security;
alter table public.resources           enable row level security;
alter table public.resource_bookings   enable row level security;
alter table public.pay_periods         enable row level security;
alter table public.pay_runs            enable row level security;

grant select, insert, update, delete on
  public.conversations, public.messages, public.forms, public.form_fields,
  public.form_submissions, public.campaigns, public.campaign_recipients,
  public.flows, public.flow_runs, public.resources, public.resource_bookings,
  public.pay_periods, public.pay_runs
to authenticated;

-- store-scoped operational tables: read + write at accessible stores
do $$
declare t text;
begin
  foreach t in array array['conversations','messages','resource_bookings'] loop
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (public.can_access_store(store_id));', t);
    execute format('create policy %1$s_write  on public.%1$s for all    to authenticated using (public.can_access_store(store_id)) with check (public.can_access_store(store_id));', t);
  end loop;
end $$;

-- resources: catalog -> read at store, write by manager
create policy resources_select on public.resources for select to authenticated
  using (public.can_access_store(store_id));
create policy resources_write on public.resources for all to authenticated
  using (public.can_manage_store(store_id)) with check (public.can_manage_store(store_id));

-- org catalogs (owner/manager edit, org read): forms, campaigns, flows
do $$
declare t text;
begin
  foreach t in array array['forms','campaigns','flows'] loop
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (org_id = public.auth_org_id());', t);
    execute format('create policy %1$s_write  on public.%1$s for all    to authenticated using (org_id = public.auth_org_id() and public.auth_role() in (''owner'',''manager'')) with check (org_id = public.auth_org_id() and public.auth_role() in (''owner'',''manager''));', t);
  end loop;
end $$;

-- form_fields follow their form
create policy form_fields_select on public.form_fields for select to authenticated
  using (exists (select 1 from public.forms f where f.id = form_id and f.org_id = public.auth_org_id()));
create policy form_fields_write on public.form_fields for all to authenticated
  using (public.auth_role() in ('owner','manager') and exists (select 1 from public.forms f where f.id = form_id and f.org_id = public.auth_org_id()))
  with check (public.auth_role() in ('owner','manager') and exists (select 1 from public.forms f where f.id = form_id and f.org_id = public.auth_org_id()));

-- org instance/log tables (any staff in org): submissions, recipients, runs
do $$
declare t text;
begin
  foreach t in array array['form_submissions','campaign_recipients','flow_runs'] loop
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (org_id = public.auth_org_id());', t);
    execute format('create policy %1$s_write  on public.%1$s for all    to authenticated using (org_id = public.auth_org_id()) with check (org_id = public.auth_org_id());', t);
  end loop;
end $$;

-- payroll: sensitive comp data -> owner/manager only, read AND write
do $$
declare t text;
begin
  foreach t in array array['pay_periods','pay_runs'] loop
    execute format('create policy %1$s_all on public.%1$s for all to authenticated using (org_id = public.auth_org_id() and public.auth_role() in (''owner'',''manager'')) with check (org_id = public.auth_org_id() and public.auth_role() in (''owner'',''manager''));', t);
  end loop;
end $$;

-- ===========================================================================
-- DEMO DATA (matches the app shell's mock screens)
-- ===========================================================================
-- Inbox
insert into public.conversations (id,org_id,store_id,client_id,channel,unread,last_message_at) values
  ('c1000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000002','a4000000-0000-0000-0000-000000000005','sms',1, now()-interval '20 min'),
  ('c1000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','a4000000-0000-0000-0000-000000000006','sms',1, now()-interval '1 day'),
  ('c1000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','a4000000-0000-0000-0000-000000000001','sms',0, now()-interval '2 day');
insert into public.messages (org_id,store_id,conversation_id,direction,body,sent_by) values
  ('a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000002','c1000000-0000-0000-0000-000000000001','inbound','Can I move my manicure to Friday?',null),
  ('a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000002','c1000000-0000-0000-0000-000000000001','outbound','Of course! I have 2:00pm open Friday — want me to book it?','a2000000-0000-0000-0000-000000000007'),
  ('a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000002','inbound','Do you carry the hydrating serum?',null);

-- Forms
insert into public.forms (id,org_id,name,description) values
  ('f0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','New Client Intake','Collected before the first appointment'),
  ('f0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','Consent — Chemical Services','Required for color and chemical treatments');
insert into public.form_fields (form_id,label,type,required,position) values
  ('f0000000-0000-0000-0000-000000000001','Full name','text',true,1),
  ('f0000000-0000-0000-0000-000000000001','Allergies','textarea',false,2),
  ('f0000000-0000-0000-0000-000000000001','How did you hear about us?','select',false,3),
  ('f0000000-0000-0000-0000-000000000002','I consent to the service','checkbox',true,1),
  ('f0000000-0000-0000-0000-000000000002','Signature','signature',true,2);
insert into public.form_submissions (org_id,form_id,client_id,store_id,data) values
  ('a0000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000001','a4000000-0000-0000-0000-000000000004','a1000000-0000-0000-0000-000000000001','{"Full name":"Sofia Ramirez","Allergies":"None"}');

-- Campaigns
insert into public.campaigns (id,org_id,name,channel,subject,status,sent_at) values
  ('ca000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','June Newsletter','email','Summer glow specials inside','sent', now()-interval '6 day'),
  ('ca000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','Win-back: 60 days','email','We miss you — 15% off','sending',null);
insert into public.campaign_recipients (org_id,campaign_id,client_id,status,sent_at) values
  ('a0000000-0000-0000-0000-000000000001','ca000000-0000-0000-0000-000000000001','a4000000-0000-0000-0000-000000000001','opened', now()-interval '6 day'),
  ('a0000000-0000-0000-0000-000000000001','ca000000-0000-0000-0000-000000000001','a4000000-0000-0000-0000-000000000002','sent', now()-interval '6 day');

-- Flows
insert into public.flows (org_id,name,trigger,action,is_active) values
  ('a0000000-0000-0000-0000-000000000001','Appointment reminder','appointment_booked','send_sms',true),
  ('a0000000-0000-0000-0000-000000000001','Post-visit review request','checkout_completed','send_email',true),
  ('a0000000-0000-0000-0000-000000000001','Birthday offer','client_birthday','add_credit',true),
  ('a0000000-0000-0000-0000-000000000001','No-show follow-up','no_show','send_rebook_link',false);

-- Resources
insert into public.resources (org_id,store_id,name,type) values
  ('a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','Facial Room A','room'),
  ('a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','Facial Room B','room'),
  ('a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000003','Massage Suite','room'),
  ('a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000002','Color Bar','station');

-- Payroll
insert into public.pay_periods (id,org_id,starts_on,ends_on,status) values
  ('ba000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001', date_trunc('month',current_date)::date + 15, (date_trunc('month',current_date) + interval '1 month - 1 day')::date, 'open');
insert into public.pay_runs (org_id,pay_period_id,staff_id,commission_cents,tips_cents,base_cents,total_cents) values
  ('a0000000-0000-0000-0000-000000000001','ba000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000002',48000,12000,0,60000),
  ('a0000000-0000-0000-0000-000000000001','ba000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000003',33000,9000,0,42000);
