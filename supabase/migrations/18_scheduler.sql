-- ============================================================================
-- 18_scheduler.sql  —  Staff scheduling: availability templates, constraint
-- rules, and scheduled shifts (separate from client appointments).
--
-- Design rationale:
--   • staff_availability: per-staff recurring weekly template (one row per day).
--     No row = fully available that day during store hours.
--   • staff_schedule_rules: named constraints (max/min hours, days per week).
--     Evaluated client-side to warn before saving a shift.
--   • staff_shifts: actual scheduled shifts for a specific date. Separate from
--     appointments — shifts are labor schedule, appointments are client bookings.
--   • RLS mirrors the rest of the schema: org_id scopes reads; write requires
--     owner or manager role.
-- ============================================================================

-- ---- enums ------------------------------------------------------------------

do $$ begin
  create type schedule_rule_type as enum (
    'max_hours_week',   -- total scheduled hours this week must be ≤ value
    'min_hours_week',   -- total scheduled hours this week must be ≥ value
    'max_days_week',    -- distinct shift dates this week must be ≤ value
    'min_days_week',    -- distinct shift dates this week must be ≥ value
    'no_specific_days'  -- value is bitmask (bit0=Sun … bit6=Sat); those days blocked
  );
exception when duplicate_object then null; end $$;

-- ---- tables -----------------------------------------------------------------

create table if not exists public.staff_availability (
  id           uuid        primary key default gen_random_uuid(),
  org_id       uuid        not null references public.organizations(id) on delete cascade,
  staff_id     uuid        not null references public.staff(id)         on delete cascade,
  day_of_week  smallint    not null check (day_of_week between 0 and 6),
  -- 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  is_available boolean     not null default true,
  start_min    int,        -- minutes from midnight; null = store open time
  end_min      int,        -- minutes from midnight; null = store close time
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (staff_id, day_of_week)
);

create index if not exists idx_savail_staff on public.staff_availability(staff_id);
create index if not exists idx_savail_org   on public.staff_availability(org_id);

create trigger trg_savail_updated
  before update on public.staff_availability
  for each row execute function public.set_updated_at();

-- ----

create table if not exists public.staff_schedule_rules (
  id         uuid               primary key default gen_random_uuid(),
  org_id     uuid               not null references public.organizations(id) on delete cascade,
  staff_id   uuid               not null references public.staff(id)         on delete cascade,
  rule_type  schedule_rule_type not null,
  value      int                not null,
  created_at timestamptz        not null default now(),
  updated_at timestamptz        not null default now(),
  unique (staff_id, rule_type)   -- one constraint per type per person
);

create index if not exists idx_srules_staff on public.staff_schedule_rules(staff_id);
create index if not exists idx_srules_org   on public.staff_schedule_rules(org_id);

create trigger trg_srules_updated
  before update on public.staff_schedule_rules
  for each row execute function public.set_updated_at();

-- ----

create table if not exists public.staff_shifts (
  id          uuid        primary key default gen_random_uuid(),
  org_id      uuid        not null references public.organizations(id) on delete cascade,
  store_id    uuid        not null references public.stores(id)        on delete cascade,
  staff_id    uuid        not null references public.staff(id)         on delete cascade,
  shift_date  date        not null,
  start_min   int         not null,  -- minutes from midnight
  end_min     int         not null,  -- minutes from midnight
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_shifts_store_date on public.staff_shifts(store_id, shift_date);
create index if not exists idx_shifts_staff_date on public.staff_shifts(staff_id, shift_date);

create trigger trg_shifts_updated
  before update on public.staff_shifts
  for each row execute function public.set_updated_at();

-- ---- RLS --------------------------------------------------------------------

alter table public.staff_availability    enable row level security;
alter table public.staff_schedule_rules  enable row level security;
alter table public.staff_shifts          enable row level security;

grant select, insert, update, delete
  on public.staff_availability, public.staff_schedule_rules, public.staff_shifts
  to authenticated;

-- staff_availability: org-scoped read; owner/manager write
create policy savail_select on public.staff_availability
  for select to authenticated
  using (org_id = public.auth_org_id());

create policy savail_write on public.staff_availability
  for all to authenticated
  using  (org_id = public.auth_org_id() and public.auth_role() in ('owner','manager'))
  with check (org_id = public.auth_org_id() and public.auth_role() in ('owner','manager'));

-- staff_schedule_rules: same pattern as availability
create policy srules_select on public.staff_schedule_rules
  for select to authenticated
  using (org_id = public.auth_org_id());

create policy srules_write on public.staff_schedule_rules
  for all to authenticated
  using  (org_id = public.auth_org_id() and public.auth_role() in ('owner','manager'))
  with check (org_id = public.auth_org_id() and public.auth_role() in ('owner','manager'));

-- staff_shifts: store-scoped read (stylists/front-desk can see their store's schedule);
-- manager-only write (scheduling is a management action)
create policy shifts_select on public.staff_shifts
  for select to authenticated
  using (org_id = public.auth_org_id() and public.can_access_store(store_id));

create policy shifts_write on public.staff_shifts
  for all to authenticated
  using  (org_id = public.auth_org_id() and public.can_manage_store(store_id))
  with check (org_id = public.auth_org_id() and public.can_manage_store(store_id));

-- ---- Demo seed data ---------------------------------------------------------
-- Seeds use the fixed UUIDs from 03_seed.sql.
-- Maya R. = a2000000-0000-0000-0000-000000000002
-- Jordan T. = a2000000-0000-0000-0000-000000000003
-- Priya N. = a2000000-0000-0000-0000-000000000004
-- Layton store = a1000000-0000-0000-0000-000000000001
-- Org = a0000000-0000-0000-0000-000000000001
--
-- Only run if the seed org exists (safe to skip on a fresh project).
do $$ begin
  if exists (select 1 from public.organizations where id = 'a0000000-0000-0000-0000-000000000001') then

    -- Maya R.: Wednesdays only after 1pm, Fridays completely off
    insert into public.staff_availability (org_id, staff_id, day_of_week, is_available, start_min, end_min) values
      ('a0000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000002', 3, true,  780, null),  -- Wed: after 1pm (780 min)
      ('a0000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000002', 5, false, null, null)  -- Fri: not available
    on conflict (staff_id, day_of_week) do nothing;

    -- Maya R.: max 25 hours/week
    insert into public.staff_schedule_rules (org_id, staff_id, rule_type, value) values
      ('a0000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000002','max_hours_week', 25)
    on conflict (staff_id, rule_type) do nothing;

    -- Jordan T.: max 40 hours/week
    insert into public.staff_schedule_rules (org_id, staff_id, rule_type, value) values
      ('a0000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000003','max_hours_week', 40)
    on conflict (staff_id, rule_type) do nothing;

    -- Priya N.: min 30 hours/week
    insert into public.staff_schedule_rules (org_id, staff_id, rule_type, value) values
      ('a0000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000004','min_hours_week', 30)
    on conflict (staff_id, rule_type) do nothing;

    -- Demo shifts for the current week at Layton
    -- Maya: Mon 10a-7p, Tue 10a-7p, Wed 1p-6p (after restriction), Thu 10a-6p → 31h > 25h max
    -- Priya: Mon 10a-6p, Tue 10a-6p → 16h < 30h min
    insert into public.staff_shifts (org_id, store_id, staff_id, shift_date, start_min, end_min) values
      ('a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000002', (now()::date - extract(dow from now())::int + 1)::date, 600, 1140),
      ('a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000002', (now()::date - extract(dow from now())::int + 2)::date, 600, 1140),
      ('a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000002', (now()::date - extract(dow from now())::int + 3)::date, 780, 1080),
      ('a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000002', (now()::date - extract(dow from now())::int + 4)::date, 600, 1080),
      ('a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000004', (now()::date - extract(dow from now())::int + 1)::date, 600, 1080),
      ('a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000004', (now()::date - extract(dow from now())::int + 2)::date, 600, 1080);

  end if;
end $$;
