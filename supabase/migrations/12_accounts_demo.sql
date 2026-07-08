-- ============================================================================
-- 12_accounts_demo.sql — client account (store credit) deposits, charges and a
-- refund so the three Client Account Balance reports show live data. Idempotent.
-- ============================================================================
\set org '''a0000000-0000-0000-0000-000000000001'''

-- ensure accounts exist for a few demo clients
insert into public.client_accounts (org_id, client_id, balance_cents)
select :org, v.c, 0 from (values
  ('a4000000-0000-0000-0000-000000000002'::uuid),
  ('a4000000-0000-0000-0000-000000000003'::uuid),
  ('a4000000-0000-0000-0000-000000000004'::uuid)
) v(c)
where not exists (select 1 from public.client_accounts a where a.client_id = v.c);

-- reset demo transactions for these three accounts so re-running is safe
delete from public.client_account_transactions t
 using public.client_accounts a
 where t.account_id = a.id and a.org_id = :org
   and a.client_id in ('a4000000-0000-0000-0000-000000000002','a4000000-0000-0000-0000-000000000003','a4000000-0000-0000-0000-000000000004');

-- helper: this month's day-N timestamp
-- client 0002: a single deposit (+$120)
insert into public.client_account_transactions (org_id, account_id, store_id, kind, amount_cents, created_at)
select :org, a.id, 'a1000000-0000-0000-0000-000000000001', 'deposit', 12000, (date_trunc('month',current_date)::date + 15)::timestamptz
from public.client_accounts a where a.org_id = :org and a.client_id = 'a4000000-0000-0000-0000-000000000002';

-- client 0003: deposit (+$600), two charges (-$55 each), a refund (-$20)  -> net balance
insert into public.client_account_transactions (org_id, account_id, store_id, kind, amount_cents, created_at)
select :org, a.id, 'a1000000-0000-0000-0000-000000000001', k.kind::acct_txn_kind, k.amt, (date_trunc('month',current_date)::date + k.d)::timestamptz
from public.client_accounts a
cross join (values ('deposit',60000,3),('charge',-5500,10),('charge',-5500,12),('refund',-2000,18)) k(kind,amt,d)
where a.org_id = :org and a.client_id = 'a4000000-0000-0000-0000-000000000003';

-- client 0004: a charge that takes them negative (-$10)
insert into public.client_account_transactions (org_id, account_id, store_id, kind, amount_cents, created_at)
select :org, a.id, 'a1000000-0000-0000-0000-000000000001', 'charge', -1000, (date_trunc('month',current_date)::date + 14)::timestamptz
from public.client_accounts a where a.org_id = :org and a.client_id = 'a4000000-0000-0000-0000-000000000004';

-- recompute stored balances from the ledger
update public.client_accounts a
   set balance_cents = coalesce((select sum(amount_cents) from public.client_account_transactions t where t.account_id = a.id), 0),
       updated_at = now()
 where a.org_id = :org;
