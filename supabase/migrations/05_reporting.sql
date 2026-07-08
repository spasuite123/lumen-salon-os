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
