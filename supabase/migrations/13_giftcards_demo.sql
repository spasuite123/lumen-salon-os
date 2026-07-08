-- ============================================================================
-- 13_giftcards_demo.sql — issue several gift cards this month + a couple
-- redemptions so the four Gift Card reports show live data. Idempotent.
-- ============================================================================
\set org '''a0000000-0000-0000-0000-000000000001'''
\set store '''a1000000-0000-0000-0000-000000000001'''

delete from public.gift_cards where org_id = :org and code in ('000586','000820','002421','002756','007548','010118');

insert into public.gift_cards (id, org_id, code, initial_cents, balance_cents, purchaser_client_id, issued_at) values
  ('cc000000-0000-0000-0000-000000000001', :org, '000586', 10000, 10000, 'a4000000-0000-0000-0000-000000000001', (date_trunc('month',current_date)::date + 1)::timestamptz),
  ('cc000000-0000-0000-0000-000000000002', :org, '000820',  5000,  5000, 'a4000000-0000-0000-0000-000000000002', (date_trunc('month',current_date)::date + 2)::timestamptz),
  ('cc000000-0000-0000-0000-000000000003', :org, '002421',  6000,  6000, 'a4000000-0000-0000-0000-000000000003', (date_trunc('month',current_date)::date + 4)::timestamptz),
  ('cc000000-0000-0000-0000-000000000004', :org, '002756',  5000,  5000, 'a4000000-0000-0000-0000-000000000004', (date_trunc('month',current_date)::date + 6)::timestamptz),
  ('cc000000-0000-0000-0000-000000000005', :org, '007548',  6000,  6000, 'a4000000-0000-0000-0000-000000000005', (date_trunc('month',current_date)::date + 8)::timestamptz),
  ('cc000000-0000-0000-0000-000000000006', :org, '010118',  6000,  6000, 'a4000000-0000-0000-0000-000000000006', (date_trunc('month',current_date)::date + 9)::timestamptz);

-- issue transactions
insert into public.gift_card_transactions (org_id, store_id, gift_card_id, kind, amount_cents, created_at)
select :org, :store, id, 'issue', initial_cents, issued_at
from public.gift_cards where org_id = :org and code in ('000586','000820','002421','002756','007548','010118');

-- a couple redemptions this month
insert into public.gift_card_transactions (org_id, store_id, gift_card_id, kind, amount_cents, created_at)
select :org, :store, id, 'redeem', -3000, (date_trunc('month',current_date)::date + 12)::timestamptz
from public.gift_cards where org_id = :org and code = '000586';
insert into public.gift_card_transactions (org_id, store_id, gift_card_id, kind, amount_cents, created_at)
select :org, :store, id, 'redeem', -2000, (date_trunc('month',current_date)::date + 14)::timestamptz
from public.gift_cards where org_id = :org and code = '002421';

-- recompute balances from the ledger for these cards
update public.gift_cards g
   set balance_cents = coalesce((select sum(amount_cents) from public.gift_card_transactions t where t.gift_card_id = g.id), g.initial_cents)
 where g.org_id = :org and g.code in ('000586','000820','002421','002756','007548','010118');
