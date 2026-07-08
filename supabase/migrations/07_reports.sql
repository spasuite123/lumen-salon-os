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
