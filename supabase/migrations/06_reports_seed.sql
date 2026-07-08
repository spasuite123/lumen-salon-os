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
