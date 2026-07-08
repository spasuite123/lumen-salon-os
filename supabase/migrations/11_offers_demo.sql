-- ============================================================================
-- 11_offers_demo.sql — add a few offers and tie redemptions to recent sales so
-- the Offers Usage / Offers Summary reports show live data. Idempotent.
-- Run once after the main schema. (Going forward, applying an offer at checkout
-- creates these rows for real.)
-- ============================================================================
\set org '''a0000000-0000-0000-0000-000000000001'''

insert into public.offers (org_id, name, kind, value, code)
select :org, 'Drift Family', 'amount', 1200, 'DRIFTFAMILY'
where not exists (select 1 from public.offers where org_id = :org and code = 'DRIFTFAMILY');

insert into public.offers (org_id, name, kind, value, code)
select :org, 'Fill The Gap', 'amount', 1500, 'FillTheGap'
where not exists (select 1 from public.offers where org_id = :org and code = 'FillTheGap');

insert into public.offers (org_id, name, kind, value, code)
select :org, 'Owners Only', 'amount', 2100, 'OWNERS'
where not exists (select 1 from public.offers where org_id = :org and code = 'OWNERS');

-- clear any prior demo redemptions for these offers so re-running is safe
delete from public.offer_redemptions r
 using public.offers o
 where r.offer_id = o.id and r.org_id = :org and o.code in ('DRIFTFAMILY','FillTheGap','OWNERS');

-- tie Drift Family to the 5 most recent sales
insert into public.offer_redemptions (org_id, store_id, offer_id, sale_id, client_id, amount_cents)
select s.org_id, s.store_id, o.id, s.id, s.client_id, 1200
from (select * from public.sales where org_id = :org order by created_at desc limit 5) s
cross join lateral (select id from public.offers where code = 'DRIFTFAMILY' and org_id = s.org_id limit 1) o;

-- one of each other offer on the next two sales
insert into public.offer_redemptions (org_id, store_id, offer_id, sale_id, client_id, amount_cents)
select s.org_id, s.store_id, o.id, s.id, s.client_id, 1500
from (select * from public.sales where org_id = :org order by created_at desc offset 5 limit 1) s
cross join lateral (select id from public.offers where code = 'FillTheGap' and org_id = s.org_id limit 1) o;
