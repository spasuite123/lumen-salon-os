-- ============================================================================
-- 09_modules.sql  —  The six modules that had UI but no schema yet:
-- Inbox, Forms, Campaigns, Flows, Resources, Payroll. After this the data
-- model covers every app in the launcher. Same org/store + RLS patterns.
-- Run after 08. Helper functions come from 02_security.sql.
-- ============================================================================

-- enums -----------------------------------------------------------------------
do $$ begin create type msg_channel     as enum ('sms','email','web');                         exception when duplicate_object then null; end $$;
do $$ begin create type msg_direction   as enum ('inbound','outbound');                        exception when duplicate_object then null; end $$;
do $$ begin create type convo_status    as enum ('open','closed');                             exception when duplicate_object then null; end $$;
do $$ begin create type form_field_type as enum ('text','textarea','select','checkbox','signature','date'); exception when duplicate_object then null; end $$;
do $$ begin create type campaign_channel as enum ('email','sms');                              exception when duplicate_object then null; end $$;
do $$ begin create type campaign_status as enum ('draft','scheduled','sending','sent');        exception when duplicate_object then null; end $$;
do $$ begin create type recipient_status as enum ('queued','sent','opened','clicked','bounced'); exception when duplicate_object then null; end $$;
do $$ begin create type flow_trigger    as enum ('appointment_booked','appointment_canceled','checkout_completed','no_show','client_birthday','form_submitted','membership_started'); exception when duplicate_object then null; end $$;
do $$ begin create type flow_action     as enum ('send_sms','send_email','add_credit','send_rebook_link'); exception when duplicate_object then null; end $$;
do $$ begin create type flow_run_status as enum ('queued','sent','failed','skipped');          exception when duplicate_object then null; end $$;
do $$ begin create type resource_type   as enum ('room','equipment','station');                exception when duplicate_object then null; end $$;
do $$ begin create type pay_status      as enum ('open','processing','paid');                  exception when duplicate_object then null; end $$;

-- ============================ INBOX (store-scoped) ==========================
create table public.conversations (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  store_id        uuid not null references public.stores(id)        on delete cascade,
  client_id       uuid references public.clients(id) on delete set null,
  channel         msg_channel not null default 'sms',
  status          convo_status not null default 'open',
  last_message_at timestamptz not null default now(),
  unread          int not null default 0,
  created_at      timestamptz not null default now()
);
create index idx_convo_store_time on public.conversations(store_id, last_message_at desc);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  store_id        uuid not null references public.stores(id)        on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  direction       msg_direction not null,
  body            text not null,
  sent_by         uuid references public.staff(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index idx_msg_convo on public.messages(conversation_id, created_at);

-- ============================ FORMS (org-level) ============================
create table public.forms (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  name        text not null,
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index idx_forms_org on public.forms(org_id);

create table public.form_fields (
  id        uuid primary key default gen_random_uuid(),
  form_id   uuid not null references public.forms(id) on delete cascade,
  label     text not null,
  type      form_field_type not null default 'text',
  required  boolean not null default false,
  position  int not null default 0,
  options   jsonb
);
create index idx_formfields_form on public.form_fields(form_id, position);

create table public.form_submissions (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  form_id      uuid not null references public.forms(id) on delete cascade,
  client_id    uuid references public.clients(id) on delete set null,
  store_id     uuid references public.stores(id) on delete set null,
  data         jsonb not null default '{}',
  submitted_at timestamptz not null default now()
);
create index idx_formsub_form on public.form_submissions(form_id, submitted_at desc);

-- ============================ CAMPAIGNS (org-level) ========================
create table public.campaigns (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  name          text not null,
  channel       campaign_channel not null default 'email',
  subject       text,
  body          text,
  status        campaign_status not null default 'draft',
  scheduled_for timestamptz,
  sent_at       timestamptz,
  created_at    timestamptz not null default now()
);
create index idx_campaigns_org on public.campaigns(org_id);

create table public.campaign_recipients (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  client_id   uuid references public.clients(id) on delete set null,
  status      recipient_status not null default 'queued',
  sent_at     timestamptz
);
create index idx_camprcpt_campaign on public.campaign_recipients(campaign_id);

-- ============================ FLOWS (org-level) ============================
create table public.flows (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  name        text not null,
  trigger     flow_trigger not null,
  action      flow_action not null,
  config      jsonb not null default '{}',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index idx_flows_org on public.flows(org_id);

create table public.flow_runs (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  flow_id     uuid not null references public.flows(id) on delete cascade,
  client_id   uuid references public.clients(id) on delete set null,
  status      flow_run_status not null default 'queued',
  ran_at      timestamptz not null default now()
);
create index idx_flowruns_flow on public.flow_runs(flow_id, ran_at desc);

-- ============================ RESOURCES (store-scoped) =====================
create table public.resources (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  store_id    uuid not null references public.stores(id)        on delete cascade,
  name        text not null,
  type        resource_type not null default 'room',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index idx_resources_store on public.resources(store_id);

create table public.resource_bookings (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id) on delete cascade,
  store_id       uuid not null references public.stores(id)        on delete cascade,
  resource_id    uuid not null references public.resources(id)     on delete cascade,
  appointment_id uuid references public.appointments(id) on delete cascade,
  starts_at      timestamptz not null,
  ends_at        timestamptz not null
);
create index idx_resbook_resource on public.resource_bookings(resource_id, starts_at);

-- ============================ PAYROLL (org-level, sensitive) ===============
create table public.pay_periods (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  starts_on   date not null,
  ends_on     date not null,
  status      pay_status not null default 'open',
  created_at  timestamptz not null default now()
);
create index idx_payperiods_org on public.pay_periods(org_id);

create table public.pay_runs (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations(id) on delete cascade,
  pay_period_id    uuid not null references public.pay_periods(id) on delete cascade,
  staff_id         uuid not null references public.staff(id) on delete cascade,
  commission_cents int not null default 0,
  tips_cents       int not null default 0,
  base_cents       int not null default 0,
  total_cents      int not null default 0,
  status           pay_status not null default 'open'
);
create index idx_payruns_period on public.pay_runs(pay_period_id);

-- ===========================================================================
-- RLS
-- ===========================================================================
alter table public.conversations       enable row level security;
alter table public.messages            enable row level security;
alter table public.forms               enable row level security;
alter table public.form_fields         enable row level security;
alter table public.form_submissions    enable row level security;
alter table public.campaigns           enable row level security;
alter table public.campaign_recipients enable row level security;
alter table public.flows               enable row level security;
alter table public.flow_runs           enable row level security;
alter table public.resources           enable row level security;
alter table public.resource_bookings   enable row level security;
alter table public.pay_periods         enable row level security;
alter table public.pay_runs            enable row level security;

grant select, insert, update, delete on
  public.conversations, public.messages, public.forms, public.form_fields,
  public.form_submissions, public.campaigns, public.campaign_recipients,
  public.flows, public.flow_runs, public.resources, public.resource_bookings,
  public.pay_periods, public.pay_runs
to authenticated;

-- store-scoped operational tables: read + write at accessible stores
do $$
declare t text;
begin
  foreach t in array array['conversations','messages','resource_bookings'] loop
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (public.can_access_store(store_id));', t);
    execute format('create policy %1$s_write  on public.%1$s for all    to authenticated using (public.can_access_store(store_id)) with check (public.can_access_store(store_id));', t);
  end loop;
end $$;

-- resources: catalog -> read at store, write by manager
create policy resources_select on public.resources for select to authenticated
  using (public.can_access_store(store_id));
create policy resources_write on public.resources for all to authenticated
  using (public.can_manage_store(store_id)) with check (public.can_manage_store(store_id));

-- org catalogs (owner/manager edit, org read): forms, campaigns, flows
do $$
declare t text;
begin
  foreach t in array array['forms','campaigns','flows'] loop
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (org_id = public.auth_org_id());', t);
    execute format('create policy %1$s_write  on public.%1$s for all    to authenticated using (org_id = public.auth_org_id() and public.auth_role() in (''owner'',''manager'')) with check (org_id = public.auth_org_id() and public.auth_role() in (''owner'',''manager''));', t);
  end loop;
end $$;

-- form_fields follow their form
create policy form_fields_select on public.form_fields for select to authenticated
  using (exists (select 1 from public.forms f where f.id = form_id and f.org_id = public.auth_org_id()));
create policy form_fields_write on public.form_fields for all to authenticated
  using (public.auth_role() in ('owner','manager') and exists (select 1 from public.forms f where f.id = form_id and f.org_id = public.auth_org_id()))
  with check (public.auth_role() in ('owner','manager') and exists (select 1 from public.forms f where f.id = form_id and f.org_id = public.auth_org_id()));

-- org instance/log tables (any staff in org): submissions, recipients, runs
do $$
declare t text;
begin
  foreach t in array array['form_submissions','campaign_recipients','flow_runs'] loop
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (org_id = public.auth_org_id());', t);
    execute format('create policy %1$s_write  on public.%1$s for all    to authenticated using (org_id = public.auth_org_id()) with check (org_id = public.auth_org_id());', t);
  end loop;
end $$;

-- payroll: sensitive comp data -> owner/manager only, read AND write
do $$
declare t text;
begin
  foreach t in array array['pay_periods','pay_runs'] loop
    execute format('create policy %1$s_all on public.%1$s for all to authenticated using (org_id = public.auth_org_id() and public.auth_role() in (''owner'',''manager'')) with check (org_id = public.auth_org_id() and public.auth_role() in (''owner'',''manager''));', t);
  end loop;
end $$;

-- ===========================================================================
-- DEMO DATA (matches the app shell's mock screens)
-- ===========================================================================
-- Inbox
insert into public.conversations (id,org_id,store_id,client_id,channel,unread,last_message_at) values
  ('c1000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000002','a4000000-0000-0000-0000-000000000005','sms',1, now()-interval '20 min'),
  ('c1000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','a4000000-0000-0000-0000-000000000006','sms',1, now()-interval '1 day'),
  ('c1000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','a4000000-0000-0000-0000-000000000001','sms',0, now()-interval '2 day');
insert into public.messages (org_id,store_id,conversation_id,direction,body,sent_by) values
  ('a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000002','c1000000-0000-0000-0000-000000000001','inbound','Can I move my manicure to Friday?',null),
  ('a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000002','c1000000-0000-0000-0000-000000000001','outbound','Of course! I have 2:00pm open Friday — want me to book it?','a2000000-0000-0000-0000-000000000007'),
  ('a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000002','inbound','Do you carry the hydrating serum?',null);

-- Forms
insert into public.forms (id,org_id,name,description) values
  ('f0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','New Client Intake','Collected before the first appointment'),
  ('f0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','Consent — Chemical Services','Required for color and chemical treatments');
insert into public.form_fields (form_id,label,type,required,position) values
  ('f0000000-0000-0000-0000-000000000001','Full name','text',true,1),
  ('f0000000-0000-0000-0000-000000000001','Allergies','textarea',false,2),
  ('f0000000-0000-0000-0000-000000000001','How did you hear about us?','select',false,3),
  ('f0000000-0000-0000-0000-000000000002','I consent to the service','checkbox',true,1),
  ('f0000000-0000-0000-0000-000000000002','Signature','signature',true,2);
insert into public.form_submissions (org_id,form_id,client_id,store_id,data) values
  ('a0000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000001','a4000000-0000-0000-0000-000000000004','a1000000-0000-0000-0000-000000000001','{"Full name":"Sofia Ramirez","Allergies":"None"}');

-- Campaigns
insert into public.campaigns (id,org_id,name,channel,subject,status,sent_at) values
  ('ca000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','June Newsletter','email','Summer glow specials inside','sent', now()-interval '6 day'),
  ('ca000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','Win-back: 60 days','email','We miss you — 15% off','sending',null);
insert into public.campaign_recipients (org_id,campaign_id,client_id,status,sent_at) values
  ('a0000000-0000-0000-0000-000000000001','ca000000-0000-0000-0000-000000000001','a4000000-0000-0000-0000-000000000001','opened', now()-interval '6 day'),
  ('a0000000-0000-0000-0000-000000000001','ca000000-0000-0000-0000-000000000001','a4000000-0000-0000-0000-000000000002','sent', now()-interval '6 day');

-- Flows
insert into public.flows (org_id,name,trigger,action,is_active) values
  ('a0000000-0000-0000-0000-000000000001','Appointment reminder','appointment_booked','send_sms',true),
  ('a0000000-0000-0000-0000-000000000001','Post-visit review request','checkout_completed','send_email',true),
  ('a0000000-0000-0000-0000-000000000001','Birthday offer','client_birthday','add_credit',true),
  ('a0000000-0000-0000-0000-000000000001','No-show follow-up','no_show','send_rebook_link',false);

-- Resources
insert into public.resources (org_id,store_id,name,type) values
  ('a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','Facial Room A','room'),
  ('a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','Facial Room B','room'),
  ('a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000003','Massage Suite','room'),
  ('a0000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000002','Color Bar','station');

-- Payroll
insert into public.pay_periods (id,org_id,starts_on,ends_on,status) values
  ('ba000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001', date_trunc('month',current_date)::date + 15, (date_trunc('month',current_date) + interval '1 month - 1 day')::date, 'open');
insert into public.pay_runs (org_id,pay_period_id,staff_id,commission_cents,tips_cents,base_cents,total_cents) values
  ('a0000000-0000-0000-0000-000000000001','ba000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000002',48000,12000,0,60000),
  ('a0000000-0000-0000-0000-000000000001','ba000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000003',33000,9000,0,42000);
