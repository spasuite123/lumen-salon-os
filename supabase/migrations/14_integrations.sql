-- ============================================================================
-- 14_integrations.sql — infrastructure for 2-way SMS (Telnyx), payments
-- (Stripe), and online booking. NON-SECRET config + flags only; API secrets
-- live in Supabase Edge Function secrets, never in the database.
-- Everything defaults to 'off' so nothing is billed until you flip it on.
-- ============================================================================

do $$ begin create type integration_status as enum ('off','test','live'); exception when duplicate_object then null; end $$;

create table if not exists public.integration_settings (
  org_id                  uuid primary key references public.organizations(id) on delete cascade,
  -- SMS (Telnyx)
  sms_status              integration_status not null default 'off',
  sms_from_number         text,
  -- Payments (Stripe)
  payments_status         integration_status not null default 'off',
  payments_publishable_key text,            -- publishable key is safe client-side
  payments_terminal_enabled boolean not null default false,
  -- Online booking
  online_booking_enabled  boolean not null default false,
  booking_slug            text unique,
  updated_at              timestamptz not null default now()
);

-- message delivery tracking (provider + status + provider's id)
alter table public.messages add column if not exists provider    text;
alter table public.messages add column if not exists status      text default 'queued';
alter table public.messages add column if not exists external_id text;

-- conversation phone for SMS routing
alter table public.conversations add column if not exists phone text;

-- which services may be booked online
alter table public.services add column if not exists online_bookable boolean not null default true;

-- payment provider/reference on a payment row
alter table public.payments add column if not exists provider   text;
alter table public.payments add column if not exists external_id text;

-- ---- RLS ----
alter table public.integration_settings enable row level security;
grant select, insert, update on public.integration_settings to authenticated;
create policy intset_select on public.integration_settings for select to authenticated
  using (org_id = public.auth_org_id());
create policy intset_write on public.integration_settings for all to authenticated
  using (org_id = public.auth_org_id() and public.auth_role() in ('owner','manager'))
  with check (org_id = public.auth_org_id() and public.auth_role() in ('owner','manager'));

-- seed a settings row for the demo org (all off)
insert into public.integration_settings (org_id, booking_slug)
values ('a0000000-0000-0000-0000-000000000001', 'lumen-demo')
on conflict (org_id) do nothing;

-- ============================================================================
-- PUBLIC ONLINE BOOKING — anon-safe, via SECURITY DEFINER functions only.
-- The public never gets table access; they can only call these two functions.
-- ============================================================================

-- options for the booking page (stores, services, staff) for a given slug
create or replace function public.public_book_options(slug text)
returns json language sql security definer set search_path = public stable as $$
  with org as (
    select o.id from organizations o
    join integration_settings i on i.org_id = o.id
    where i.booking_slug = slug and i.online_booking_enabled
    limit 1
  )
  select case when not exists (select 1 from org) then json_build_object('enabled', false)
  else json_build_object(
    'enabled', true,
    'stores',   (select coalesce(json_agg(json_build_object('id', s.id, 'name', s.name)), '[]')
                 from stores s where s.org_id = (select id from org)),
    'services', (select coalesce(json_agg(json_build_object('id', sv.id, 'name', sv.name, 'duration_min', sv.duration_min)), '[]')
                 from services sv where sv.org_id = (select id from org) and sv.online_bookable),
    'staff',    (select coalesce(json_agg(json_build_object('id', st.id, 'name', st.name)), '[]')
                 from staff st where st.org_id = (select id from org))
  ) end;
$$;

-- create a booking from the public page; resolves/creates the client by phone
create or replace function public.create_public_booking(
  slug text, p_store_id uuid, p_service_id uuid, p_staff_id uuid,
  p_name text, p_phone text, p_starts_at timestamptz
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_org uuid; v_client uuid; v_dur int; v_price int; v_appt uuid;
begin
  select o.id into v_org from organizations o
    join integration_settings i on i.org_id = o.id
   where i.booking_slug = slug and i.online_booking_enabled limit 1;
  if v_org is null then raise exception 'Online booking is not enabled'; end if;

  -- basic validation that the service/store belong to this org
  select duration_min into v_dur from services where id = p_service_id and org_id = v_org;
  if v_dur is null then raise exception 'Unknown service'; end if;
  select price_cents into v_price from service_stores where service_id = p_service_id and store_id = p_store_id;

  -- find or create the client by phone within the org
  select id into v_client from clients where org_id = v_org and phone = p_phone limit 1;
  if v_client is null then
    insert into clients (org_id, name, phone) values (v_org, coalesce(p_name,'Online guest'), p_phone)
    returning id into v_client;
  end if;

  insert into appointments (org_id, store_id, client_id, staff_id, service_id, starts_at, ends_at, status, price_cents)
  values (v_org, p_store_id, v_client, p_staff_id, p_service_id, p_starts_at,
          p_starts_at + (coalesce(v_dur,60) || ' minutes')::interval, 'booked', coalesce(v_price,0))
  returning id into v_appt;

  return v_appt;
end;
$$;

grant execute on function public.public_book_options(text) to anon, authenticated;
grant execute on function public.create_public_booking(text, uuid, uuid, uuid, text, text, timestamptz) to anon, authenticated;
