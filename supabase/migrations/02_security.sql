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
