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
