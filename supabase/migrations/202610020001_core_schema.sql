create extension if not exists pgcrypto;
create extension if not exists btree_gist with schema extensions;

create type public.tenant_status as enum ('preview', 'live', 'suspended');
create type public.member_role as enum ('owner', 'manager', 'staff');
create type public.booking_status as enum ('confirmed', 'in_progress', 'completed', 'cancelled', 'no_show');
create type public.occupancy_type as enum ('booking', 'block');
create type public.notification_status as enum ('pending', 'processing', 'sent', 'failed');

create table public.tenants (
  id uuid primary key default gen_random_uuid(), slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null, description text, phone text, email text, address text, latitude numeric(9,6), longitude numeric(9,6),
  timezone text not null default 'UTC', currency char(3) not null default 'USD', accent_color text not null default '#d7ff3f' check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  status public.tenant_status not null default 'preview', hero_url text, logo_url text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.tenant_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade, booking_enabled boolean not null default true,
  minimum_booking_notice_minutes integer not null default 60 check (minimum_booking_notice_minutes >= 0),
  maximum_booking_days integer not null default 60 check (maximum_booking_days between 1 and 730), cancellation_deadline_minutes integer not null default 1440 check (cancellation_deadline_minutes >= 0),
  reschedule_enabled boolean not null default true, customer_can_cancel boolean not null default true, customer_can_reschedule boolean not null default true,
  slot_interval_minutes integer not null default 30 check (slot_interval_minutes between 5 and 240), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.tenant_assets (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  type text not null check (type in ('logo','hero','gallery','icon')), storage_path text not null, public_url text not null, alt_text text, sort_order integer not null default 0, created_at timestamptz not null default now(), unique(id, tenant_id)
);

create table public.services (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade, name text not null, description text,
  price numeric(12,2) not null check (price >= 0), currency char(3) not null, duration_minutes integer not null check (duration_minutes between 5 and 10080),
  buffer_before_minutes integer not null default 0 check (buffer_before_minutes >= 0), buffer_after_minutes integer not null default 0 check (buffer_after_minutes >= 0),
  active boolean not null default true, sort_order integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id, tenant_id)
);

create table public.resources (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade, name text not null, type text not null, description text,
  active boolean not null default true, capacity integer not null default 1 check (capacity > 0), sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id, tenant_id)
);

create table public.service_resources (
  tenant_id uuid not null references public.tenants(id) on delete cascade, service_id uuid not null, resource_id uuid not null,
  primary key(service_id, resource_id), foreign key(service_id, tenant_id) references public.services(id, tenant_id) on delete cascade,
  foreign key(resource_id, tenant_id) references public.resources(id, tenant_id) on delete cascade
);

create table public.working_hours (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade, weekday smallint not null check (weekday between 0 and 6),
  start_time time not null, end_time time not null, active boolean not null default true, check (end_time > start_time), unique(tenant_id, weekday, start_time)
);

create table public.schedule_exceptions (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade, resource_id uuid,
  date date not null, start_time time, end_time time, type text not null check(type in ('closed','shortened','block')), reason text,
  created_at timestamptz not null default now(), foreign key(resource_id, tenant_id) references public.resources(id, tenant_id) on delete cascade,
  check ((start_time is null and end_time is null) or (start_time is not null and end_time is not null and end_time > start_time))
);

create table public.customers (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade, name text not null, phone text not null, email text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id, tenant_id), unique(tenant_id, phone)
);
create table public.vehicles (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade, customer_id uuid not null,
  brand text not null, model text not null, year integer check(year between 1950 and 2200), license_plate text, color text, notes text,
  created_at timestamptz not null default now(), foreign key(customer_id, tenant_id) references public.customers(id, tenant_id) on delete cascade, unique(id, tenant_id)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete restrict, customer_id uuid not null, vehicle_id uuid not null,
  service_id uuid not null, resource_id uuid not null, status public.booking_status not null default 'confirmed', starts_at timestamptz not null, ends_at timestamptz not null,
  price numeric(12,2) not null, currency char(3) not null, customer_name_snapshot text not null, customer_phone_snapshot text not null, customer_email_snapshot text,
  vehicle_snapshot jsonb not null, service_name_snapshot text not null, access_token_hash text not null unique, idempotency_key uuid not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), cancelled_at timestamptz, rescheduled_from_id uuid references public.bookings(id),
  check(ends_at > starts_at), unique(tenant_id, idempotency_key), unique(id, tenant_id),
  foreign key(customer_id, tenant_id) references public.customers(id, tenant_id), foreign key(vehicle_id, tenant_id) references public.vehicles(id, tenant_id),
  foreign key(service_id, tenant_id) references public.services(id, tenant_id), foreign key(resource_id, tenant_id) references public.resources(id, tenant_id)
);

create table public.resource_occupancies (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete restrict, resource_id uuid not null, booking_id uuid,
  occupancy_type public.occupancy_type not null, starts_at timestamptz not null, ends_at timestamptz not null, reason text, active boolean not null default true, created_at timestamptz not null default now(),
  check(ends_at > starts_at), foreign key(resource_id, tenant_id) references public.resources(id, tenant_id), foreign key(booking_id, tenant_id) references public.bookings(id, tenant_id),
  constraint no_resource_overlap exclude using gist (tenant_id with =, resource_id with =, tstzrange(starts_at, ends_at, '[)') with &&) where (active)
);

create table public.tenant_memberships (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null, created_at timestamptz not null default now(), unique(tenant_id, user_id)
);

create table public.notification_jobs (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade, booking_id uuid not null,
  type text not null, channel text not null check(channel in ('email','sms','push')), payload jsonb not null default '{}', status public.notification_status not null default 'pending',
  attempts integer not null default 0, available_at timestamptz not null default now(), locked_at timestamptz, sent_at timestamptz, dedupe_key text not null, created_at timestamptz not null default now(),
  foreign key(booking_id, tenant_id) references public.bookings(id, tenant_id), unique(tenant_id, dedupe_key)
);

create table public.rate_limits (
  bucket text not null, key_hash text not null, window_start timestamptz not null, request_count integer not null default 1, primary key(bucket, key_hash, window_start)
);

create index bookings_tenant_starts_idx on public.bookings(tenant_id, starts_at);
create index occupancies_resource_time_idx on public.resource_occupancies(resource_id, starts_at, ends_at) where active;
create index notification_jobs_ready_idx on public.notification_jobs(status, available_at) where status in ('pending','failed');
