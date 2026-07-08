-- ============================================================================
-- 17_inventory_meta.sql — add category + brand to products, tag existing ones,
-- and add a few more retail products (across brands/categories) with stock and
-- movements so the Inventory reports group/filter meaningfully. Idempotent.
-- ============================================================================
\set org '''a0000000-0000-0000-0000-000000000001'''
\set store '''a1000000-0000-0000-0000-000000000001'''

alter table public.products add column if not exists category text;
alter table public.products add column if not exists brand    text;

update public.products set category = 'Hair Care', brand = 'Drift Apothecary' where id = 'c0000000-0000-0000-0000-000000000001';
update public.products set category = 'Styling',   brand = 'Drift Apothecary' where id = 'c0000000-0000-0000-0000-000000000002';

-- a few more retail products across two brands / three categories
delete from public.inventory_movements where product_id in ('c0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000004','c0000000-0000-0000-0000-000000000005');
delete from public.product_inventory   where product_id in ('c0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000004','c0000000-0000-0000-0000-000000000005');
delete from public.products            where id         in ('c0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000004','c0000000-0000-0000-0000-000000000005');

insert into public.products (id, org_id, name, sku, price_cents, cost_cents, category, brand) values
  ('c0000000-0000-0000-0000-000000000003', :org, 'Reflex Balm',      'RB-01', 2400, 900,  'Body Care', 'Stillwater Co'),
  ('c0000000-0000-0000-0000-000000000004', :org, 'Foot Soak Salts',  'FS-01', 1800, 600,  'Body Care', 'Stillwater Co'),
  ('c0000000-0000-0000-0000-000000000005', :org, 'Aroma Roller',     'AR-01', 1600, 500,  'Wellness',  'Drift Apothecary');

insert into public.product_inventory (product_id, store_id, qty_on_hand, reorder_point) values
  ('c0000000-0000-0000-0000-000000000003', :store, 15, 5),
  ('c0000000-0000-0000-0000-000000000004', :store, 9,  4),
  ('c0000000-0000-0000-0000-000000000005', :store, 20, 6);

-- receiving (earlier) + a couple sales this month so COGS / usage populate
insert into public.inventory_movements (org_id, store_id, product_id, kind, qty_delta, created_at) values
  (:org, :store, 'c0000000-0000-0000-0000-000000000003', 'receive', 18, (current_date - 25)::timestamptz),
  (:org, :store, 'c0000000-0000-0000-0000-000000000004', 'receive', 12, (current_date - 25)::timestamptz),
  (:org, :store, 'c0000000-0000-0000-0000-000000000005', 'receive', 24, (current_date - 25)::timestamptz),
  (:org, :store, 'c0000000-0000-0000-0000-000000000003', 'sale',    -3, (current_date - 4)::timestamptz),
  (:org, :store, 'c0000000-0000-0000-0000-000000000004', 'sale',    -3, (current_date - 3)::timestamptz),
  (:org, :store, 'c0000000-0000-0000-0000-000000000005', 'sale',    -4, (current_date - 2)::timestamptz),
  (:org, :store, 'c0000000-0000-0000-0000-000000000003', 'adjust',  -1, (current_date - 1)::timestamptz);
