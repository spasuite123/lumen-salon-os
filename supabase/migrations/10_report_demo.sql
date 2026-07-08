-- ============================================================================
-- 10_report_demo.sql — populate Time Clock + Days Off for the demo staff so the
-- new Staff reports render with live data. Idempotent (clears its own rows first).
-- Run once in the Supabase SQL editor after the main schema.
-- ============================================================================

-- clear any prior demo rows for this org so re-running is safe
delete from public.time_clock where org_id = 'a0000000-0000-0000-0000-000000000001';
delete from public.time_off   where org_id = 'a0000000-0000-0000-0000-000000000001';

-- Time clock: punches for the last 10 days (skip Sundays), 4 staff at Layton.
insert into public.time_clock (org_id, store_id, staff_id, clock_in, clock_out)
select
  'a0000000-0000-0000-0000-000000000001'::uuid,
  'a1000000-0000-0000-0000-000000000001'::uuid,
  s.staff_id,
  (d::date + s.cin)::timestamp at time zone 'America/Denver',
  (d::date + s.cout)::timestamp at time zone 'America/Denver'
from generate_series(current_date - 9, current_date, interval '1 day') d
cross join (values
  ('a2000000-0000-0000-0000-000000000002'::uuid, time '09:30', time '16:00'),
  ('a2000000-0000-0000-0000-000000000003'::uuid, time '09:31', time '15:38'),
  ('a2000000-0000-0000-0000-000000000004'::uuid, time '10:45', time '16:09'),
  ('a2000000-0000-0000-0000-000000000005'::uuid, time '11:00', time '18:30')
) as s(staff_id, cin, cout)
where extract(dow from d) <> 0;

-- Days off: a few entries this month and last month.
insert into public.time_off (org_id, staff_id, start_date, end_date, reason) values
  ('a0000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000006', date_trunc('month',current_date)::date + 8,  date_trunc('month',current_date)::date + 8,  'wedding'),
  ('a0000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000006', date_trunc('month',current_date)::date + 15, date_trunc('month',current_date)::date + 15, 'wedding'),
  ('a0000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000003', date_trunc('month',current_date)::date + 6,  date_trunc('month',current_date)::date + 6,  'Other'),
  ('a0000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000005', date_trunc('month',current_date)::date + 13, date_trunc('month',current_date)::date + 13, 'Other'),
  ('a0000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000004', date_trunc('month',current_date)::date + 20, date_trunc('month',current_date)::date + 21, 'vacation');
