-- ============================================================================
-- 15_packages_demo.sql — packages with credits, client purchases, and a couple
-- redemptions so all four Package reports show live data. Idempotent.
-- ============================================================================
\set org '''a0000000-0000-0000-0000-000000000001'''
\set store '''a1000000-0000-0000-0000-000000000001'''

-- reset the demo rows we own (children first)
delete from public.package_redemptions where client_package_id in
  ('da100000-0000-0000-0000-000000000001','da100000-0000-0000-0000-000000000002','da100000-0000-0000-0000-000000000003','da100000-0000-0000-0000-000000000004');
delete from public.client_packages where id in
  ('da100000-0000-0000-0000-000000000001','da100000-0000-0000-0000-000000000002','da100000-0000-0000-0000-000000000003','da100000-0000-0000-0000-000000000004');
delete from public.packages where id in
  ('da000000-0000-0000-0000-000000000001','da000000-0000-0000-0000-000000000002');

-- packages (5-credit Stillwater @ $300 = $60/credit; 3-credit Deep Drift @ $270 = $90/credit)
insert into public.packages (id, org_id, name, price_cents) values
  ('da000000-0000-0000-0000-000000000001', :org, 'Stillwater 5-Pack', 30000),
  ('da000000-0000-0000-0000-000000000002', :org, 'Deep Drift 3-Pack', 27000);

-- credits: attach each package to a real service with a quantity
insert into public.package_items (package_id, service_id, quantity)
select 'da000000-0000-0000-0000-000000000001', (select id from public.services where org_id = :org order by created_at limit 1), 5;
insert into public.package_items (package_id, service_id, quantity)
select 'da000000-0000-0000-0000-000000000002', (select id from public.services where org_id = :org order by created_at limit 1 offset 1), 3;

-- purchases: two last quarter (outstanding), two this month (package sales)
insert into public.client_packages (id, org_id, client_id, package_id, purchased_at) values
  ('da100000-0000-0000-0000-000000000001', :org, 'a4000000-0000-0000-0000-000000000003', 'da000000-0000-0000-0000-000000000001', (current_date - 60)::timestamptz),
  ('da100000-0000-0000-0000-000000000002', :org, 'a4000000-0000-0000-0000-000000000004', 'da000000-0000-0000-0000-000000000002', (current_date - 55)::timestamptz),
  ('da100000-0000-0000-0000-000000000003', :org, 'a4000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000001', (date_trunc('month',current_date)::date + 3)::timestamptz),
  ('da100000-0000-0000-0000-000000000004', :org, 'a4000000-0000-0000-0000-000000000002', 'da000000-0000-0000-0000-000000000002', (date_trunc('month',current_date)::date + 6)::timestamptz);

-- redemptions this week (Package Usage) — one against an older pack, one against a new pack
insert into public.package_redemptions (org_id, store_id, client_package_id, service_id, redeemed_at)
select :org, :store, 'da100000-0000-0000-0000-000000000001', (select id from public.services where org_id = :org order by created_at limit 1), (current_date - 2)::timestamptz;
insert into public.package_redemptions (org_id, store_id, client_package_id, service_id, redeemed_at)
select :org, :store, 'da100000-0000-0000-0000-000000000003', (select id from public.services where org_id = :org order by created_at limit 1), (current_date - 1)::timestamptz;
