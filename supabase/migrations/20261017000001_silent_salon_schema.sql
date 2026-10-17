-- ============================================================================
-- SILENT SALON (SaaS) - CORE MULTI-TENANT DATABASE SCHEMA & RLS ARCHITECTURE
-- Postgres Best Practices applied:
-- 1. IDENTITY primary keys (bigint generated always as identity)
-- 2. timestamptz for all temporal columns, integer cents for exact currency
-- 3. btree_gist exclusion constraint to prevent overlapping stylist bookings
-- 4. Explicit foreign key indexes & composite indexes for range queries
-- 5. Strict Row-Level Security (RLS) with cached (select ...) subqueries
-- ============================================================================

create extension if not exists btree_gist;

-- Private schema for RLS security definer helpers (not exposed to Data API)
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

-- ============================================================================
-- 1. SALONS (Multi-Tenant Root)
-- ============================================================================
create table if not exists public.salons (
  id bigint generated always as identity primary key,
  slug text not null unique,
  name text not null,
  tagline text,
  address text,
  phone text,
  email text,
  timezone text not null default 'Europe/Berlin',
  currency text not null default 'EUR',
  brand_color text not null default '#B47B56',
  slot_interval_minutes integer not null default 15
    check (slot_interval_minutes in (10, 15, 20, 30, 60)),
  buffer_minutes integer not null default 5
    check (buffer_minutes >= 0 and buffer_minutes <= 60),
  cancellation_hours integer not null default 24
    check (cancellation_hours >= 0 and cancellation_hours <= 168),
  default_deposit_threshold_cents integer not null default 12000
    check (default_deposit_threshold_cents >= 0),
  default_deposit_duration_minutes integer not null default 120
    check (default_deposit_duration_minutes >= 30),
  default_deposit_percent integer not null default 25
    check (default_deposit_percent between 0 and 100),
  stripe_account_id text,
  stripe_charges_enabled boolean not null default false,
  reminder_email_hours integer[] not null default '{24, 2}',
  reminder_sms_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- 2. SALON MEMBERS (Stylists, Reception, Owners)
-- ============================================================================
create table if not exists public.salon_members (
  id bigint generated always as identity primary key,
  salon_id bigint not null references public.salons(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  role text not null default 'stylist'
    check (role in ('owner', 'manager', 'stylist', 'receptionist')),
  display_name text not null,
  title text not null default 'Senior Stylist',
  bio text,
  avatar_initials text not null default 'ST',
  color_hex text not null default '#B47B56',
  is_active boolean not null default true,
  is_bookable boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists salon_members_salon_id_idx on public.salon_members (salon_id);
create index if not exists salon_members_user_id_idx on public.salon_members (user_id);

-- ============================================================================
-- 3. SERVICE CATEGORIES & SERVICES (Base Treatments)
-- ============================================================================
create table if not exists public.service_categories (
  id bigint generated always as identity primary key,
  salon_id bigint not null references public.salons(id) on delete cascade,
  name text not null,
  description text,
  sort_order integer not null default 0
);

create index if not exists service_categories_salon_id_idx on public.service_categories (salon_id);

create table if not exists public.services (
  id bigint generated always as identity primary key,
  salon_id bigint not null references public.salons(id) on delete cascade,
  category_id bigint references public.service_categories(id) on delete set null,
  name text not null,
  description text,
  base_duration_minutes integer not null
    check (base_duration_minutes > 0 and base_duration_minutes <= 600),
  buffer_after_minutes integer not null default 5
    check (buffer_after_minutes >= 0 and buffer_after_minutes <= 120),
  base_price_cents integer not null
    check (base_price_cents >= 0),
  requires_deposit boolean not null default false,
  deposit_type text not null default 'percent'
    check (deposit_type in ('none', 'fixed', 'percent')),
  deposit_value integer not null default 25
    check (deposit_value >= 0),
  requires_qualification boolean not null default true,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists services_salon_id_idx on public.services (salon_id);
create index if not exists services_category_id_idx on public.services (category_id);

-- ============================================================================
-- 4. QUALIFICATION MODIFIERS (Dynamic Hair Length, Density & Add-ons)
-- ============================================================================
create table if not exists public.qualification_modifiers (
  id bigint generated always as identity primary key,
  salon_id bigint not null references public.salons(id) on delete cascade,
  dimension text not null
    check (dimension in ('hair_length', 'hair_density', 'addon')),
  code text not null,
  label text not null,
  subtitle text,
  extra_duration_minutes integer not null default 0
    check (extra_duration_minutes >= -60 and extra_duration_minutes <= 240),
  extra_price_cents integer not null default 0
    check (extra_price_cents >= 0),
  is_default boolean not null default false,
  sort_order integer not null default 0,
  unique (salon_id, code)
);

create index if not exists qualification_modifiers_salon_id_idx on public.qualification_modifiers (salon_id);

-- ============================================================================
-- 5. STYLIST SPECIALIZATIONS & WORKING HOURS / TIME OFF
-- ============================================================================
create table if not exists public.stylist_services (
  id bigint generated always as identity primary key,
  salon_id bigint not null references public.salons(id) on delete cascade,
  member_id bigint not null references public.salon_members(id) on delete cascade,
  service_id bigint not null references public.services(id) on delete cascade,
  custom_duration_minutes integer,
  custom_price_cents integer,
  unique (member_id, service_id)
);

create index if not exists stylist_services_salon_id_idx on public.stylist_services (salon_id);
create index if not exists stylist_services_member_id_idx on public.stylist_services (member_id);
create index if not exists stylist_services_service_id_idx on public.stylist_services (service_id);

create table if not exists public.working_hours (
  id bigint generated always as identity primary key,
  salon_id bigint not null references public.salons(id) on delete cascade,
  member_id bigint not null references public.salon_members(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  is_working boolean not null default true,
  start_time time not null default '09:00',
  end_time time not null default '18:00',
  break_start time,
  break_end time,
  unique (member_id, day_of_week)
);

create index if not exists working_hours_salon_id_idx on public.working_hours (salon_id);
create index if not exists working_hours_member_id_idx on public.working_hours (member_id);

create table if not exists public.time_off (
  id bigint generated always as identity primary key,
  salon_id bigint not null references public.salons(id) on delete cascade,
  member_id bigint not null references public.salon_members(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text not null default 'Abwesend / Pause',
  check (ends_at > starts_at)
);

create index if not exists time_off_salon_starts_idx on public.time_off (salon_id, starts_at);
create index if not exists time_off_member_starts_idx on public.time_off (member_id, starts_at);

-- ============================================================================
-- 6. CUSTOMERS (Salon CRM & Preferences)
-- ============================================================================
create table if not exists public.customers (
  id bigint generated always as identity primary key,
  salon_id bigint not null references public.salons(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  hair_length text,
  hair_density text,
  color_formula_notes text,
  preferred_beverage text,
  prefers_silent_cut boolean not null default false,
  no_show_count integer not null default 0,
  total_visits integer not null default 0,
  created_at timestamptz not null default now(),
  unique (salon_id, email)
);

create index if not exists customers_salon_id_idx on public.customers (salon_id);

-- ============================================================================
-- 7. APPOINTMENTS (Bookings with GiST Exclusion against Overbooking)
-- ============================================================================
create table if not exists public.appointments (
  id bigint generated always as identity primary key,
  public_token uuid not null default gen_random_uuid() unique,
  salon_id bigint not null references public.salons(id) on delete cascade,
  member_id bigint not null references public.salon_members(id) on delete restrict,
  service_id bigint not null references public.services(id) on delete restrict,
  customer_id bigint references public.customers(id) on delete set null,
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  base_duration_minutes integer not null,
  extra_duration_minutes integer not null default 0,
  buffer_minutes integer not null default 0,
  total_duration_minutes integer not null,
  qualification_data jsonb not null default '{}'::jsonb,
  total_price_cents integer not null,
  deposit_required boolean not null default false,
  deposit_amount_cents integer not null default 0,
  payment_status text not null default 'not_required'
    check (payment_status in ('not_required', 'pending_deposit', 'deposit_paid', 'paid_in_full', 'refunded', 'forfeited')),
  stripe_payment_intent_id text,
  status text not null default 'confirmed'
    check (status in ('pending_deposit', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show')),
  prefers_silent_cut boolean not null default false,
  customer_notes text,
  reminder_24h_sent_at timestamptz,
  reminder_2h_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_valid_range check (ends_at > starts_at),
  -- Mathematical guarantee against double-booking the same stylist
  constraint appointments_no_stylist_overlap exclude using gist (
    member_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('pending_deposit', 'confirmed', 'checked_in'))
);

create index if not exists appointments_salon_starts_idx on public.appointments (salon_id, starts_at);
create index if not exists appointments_member_starts_idx on public.appointments (member_id, starts_at);
create index if not exists appointments_service_id_idx on public.appointments (service_id);
create index if not exists appointments_customer_id_idx on public.appointments (customer_id);

-- ============================================================================
-- 8. NOTIFICATION LOGS (No-Show Prevention Pipeline)
-- ============================================================================
create table if not exists public.notification_logs (
  id bigint generated always as identity primary key,
  salon_id bigint not null references public.salons(id) on delete cascade,
  appointment_id bigint not null references public.appointments(id) on delete cascade,
  channel text not null check (channel in ('email', 'sms', 'whatsapp')),
  template_type text not null
    check (template_type in ('booking_confirmation', 'reminder_24h', 'reminder_2h', 'deposit_receipt', 'cancellation')),
  recipient text not null,
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'delivered', 'failed')),
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notification_logs_salon_id_idx on public.notification_logs (salon_id);
create index if not exists notification_logs_appointment_id_idx on public.notification_logs (appointment_id);

-- ============================================================================
-- 9. PRIVATE SECURITY DEFINER HELPERS & ROW LEVEL SECURITY (RLS)
-- ============================================================================
create or replace function private.is_salon_member(check_salon_id bigint)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.salon_members sm
    where sm.salon_id = $1
      and sm.user_id = (select auth.uid())
      and sm.is_active = true
  );
$$;

create or replace function private.is_salon_admin(check_salon_id bigint)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.salon_members sm
    where sm.salon_id = $1
      and sm.user_id = (select auth.uid())
      and sm.is_active = true
      and sm.role in ('owner', 'manager')
  );
$$;

revoke execute on function private.is_salon_member(bigint) from public, anon;
revoke execute on function private.is_salon_admin(bigint) from public, anon;
grant execute on function private.is_salon_member(bigint) to authenticated;
grant execute on function private.is_salon_admin(bigint) to authenticated;

-- Enable RLS on all public tables
alter table public.salons enable row level security;
alter table public.salon_members enable row level security;
alter table public.service_categories enable row level security;
alter table public.services enable row level security;
alter table public.qualification_modifiers enable row level security;
alter table public.stylist_services enable row level security;
alter table public.working_hours enable row level security;
alter table public.time_off enable row level security;
alter table public.customers enable row level security;
alter table public.appointments enable row level security;
alter table public.notification_logs enable row level security;

-- Public Widget Read Policies (anon & authenticated can read public catalog/schedule)
create policy salons_public_read on public.salons
  for select to anon, authenticated
  using (true);

create policy salons_admin_update on public.salons
  for update to authenticated
  using ((select private.is_salon_admin(id)))
  with check ((select private.is_salon_admin(id)));

create policy salon_members_public_read on public.salon_members
  for select to anon, authenticated
  using (is_active = true);

create policy salon_members_admin_write on public.salon_members
  for all to authenticated
  using ((select private.is_salon_admin(salon_id)))
  with check ((select private.is_salon_admin(salon_id)));

create policy service_categories_public_read on public.service_categories
  for select to anon, authenticated
  using (true);

create policy services_public_read on public.services
  for select to anon, authenticated
  using (is_active = true);

create policy services_admin_write on public.services
  for all to authenticated
  using ((select private.is_salon_admin(salon_id)))
  with check ((select private.is_salon_admin(salon_id)));

create policy qualification_modifiers_public_read on public.qualification_modifiers
  for select to anon, authenticated
  using (true);

create policy qualification_modifiers_admin_write on public.qualification_modifiers
  for all to authenticated
  using ((select private.is_salon_admin(salon_id)))
  with check ((select private.is_salon_admin(salon_id)));

create policy stylist_services_public_read on public.stylist_services
  for select to anon, authenticated
  using (true);

create policy working_hours_public_read on public.working_hours
  for select to anon, authenticated
  using (true);

create policy time_off_public_read on public.time_off
  for select to anon, authenticated
  using (true);

create policy time_off_staff_write on public.time_off
  for all to authenticated
  using ((select private.is_salon_member(salon_id)))
  with check ((select private.is_salon_member(salon_id)));

-- Strict Tenant Isolation for CRM Customers, Appointments & Notification Logs
create policy customers_staff_select on public.customers
  for select to authenticated
  using ((select private.is_salon_member(salon_id)));

create policy customers_staff_write on public.customers
  for all to authenticated
  using ((select private.is_salon_member(salon_id)))
  with check ((select private.is_salon_member(salon_id)));

create policy appointments_staff_select on public.appointments
  for select to authenticated
  using ((select private.is_salon_member(salon_id)));

create policy appointments_staff_update on public.appointments
  for update to authenticated
  using ((select private.is_salon_member(salon_id)))
  with check ((select private.is_salon_member(salon_id)));

create policy appointments_public_insert on public.appointments
  for insert to anon, authenticated
  with check (
    total_duration_minutes > 0
    and total_price_cents >= 0
    and ends_at > starts_at
  );

create policy notification_logs_staff_select on public.notification_logs
  for select to authenticated
  using ((select private.is_salon_member(salon_id)));
