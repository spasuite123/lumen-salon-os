-- ============================================================================
-- 16_memberships_demo.sql — add a plan + a membership started this week, a
-- payment this week, and a used credit so the four Membership reports show
-- current-period data. Idempotent. (06/08 already seed a plan, payments,
-- a cancellation and credits.)
-- ============================================================================
\set org '''a0000000-0000-0000-0000-000000000001'''
\set store '''a1000000-0000-0000-0000-000000000001'''

-- reset the rows we own
delete from public.membership_credits  where client_membership_id = 'f2000000-0000-0000-0000-000000000004';
delete from public.membership_payments where client_membership_id = 'f2000000-0000-0000-0000-000000000004';
delete from public.client_memberships  where id = 'f2000000-0000-0000-0000-000000000004';
delete from public.membership_plans     where id = 'f1000000-0000-0000-0000-000000000002';

-- a second plan
insert into public.membership_plans (id, org_id, name, price_cents, benefits) values
  ('f1000000-0000-0000-0000-000000000002', :org, 'Founders 100', 12000, 'Monthly Premier Drift + 15% off');

-- a membership started this week (new signup)
insert into public.client_memberships (id, org_id, client_id, plan_id, status, started_on, renews_on) values
  ('f2000000-0000-0000-0000-000000000004', :org, 'a4000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000002', 'active', current_date - 2, current_date + 28);

-- its first payment (this week)
insert into public.membership_payments (org_id, client_membership_id, store_id, amount_cents, paid_on) values
  (:org, 'f2000000-0000-0000-0000-000000000004', :store, 12000, current_date - 2);

-- a used service credit this week (against an existing active membership)
insert into public.membership_credits (org_id, client_membership_id, store_id, kind, amount_cents, created_at) values
  (:org, 'f2000000-0000-0000-0000-000000000001', :store, 'used', 6000, (current_date - 1)::timestamptz);
