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
