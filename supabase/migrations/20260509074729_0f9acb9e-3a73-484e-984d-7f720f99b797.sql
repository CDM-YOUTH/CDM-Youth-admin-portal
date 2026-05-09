
-- =========================================
-- ENUMS
-- =========================================
create type public.youth_category as enum ('Primary','Secondary','Tertiary','Working');
create type public.gender as enum ('Female','Male');
create type public.youth_status as enum ('active','inactive');
create type public.enrollment_status as enum ('paid','pending','waived');
create type public.event_org_level as enum ('Diocese','Deanery','Parish','Outstation');
create type public.checkin_method as enum ('search','qr','bulk','kiosk','walkin');
create type public.app_role as enum ('admin','moderator','user');

-- =========================================
-- ORGANIZATION (reference)
-- =========================================
create table public.deaneries (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.parishes (
  id uuid primary key default gen_random_uuid(),
  deanery_id uuid not null references public.deaneries(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (deanery_id, name)
);

create table public.outstations (
  id uuid primary key default gen_random_uuid(),
  parish_id uuid not null references public.parishes(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (parish_id, name)
);

-- =========================================
-- YOUTHS
-- =========================================
create sequence public.cdm_serial start 1;

create or replace function public.next_cdm_id()
returns text
language sql
stable
as $$
  select 'CDM-' || extract(year from now())::text || '-' || lpad(nextval('public.cdm_serial')::text, 5, '0')
$$;

create table public.youths (
  id uuid primary key default gen_random_uuid(),
  cdm_id text not null unique default public.next_cdm_id(),
  full_name text not null,
  gender public.gender not null,
  age int not null check (age between 0 and 120),
  phone text,
  alt_phone text,
  email text,
  deanery_id uuid references public.deaneries(id) on delete set null,
  parish_id uuid references public.parishes(id) on delete set null,
  outstation_id uuid references public.outstations(id) on delete set null,
  category public.youth_category not null default 'Secondary',
  institution text,
  year_of_study text,
  notes text,
  status public.youth_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.youths(deanery_id);
create index on public.youths(parish_id);
create index on public.youths(outstation_id);
create index on public.youths(category);

-- =========================================
-- ENROLLMENTS
-- =========================================
create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  youth_id uuid not null references public.youths(id) on delete cascade,
  year int not null default extract(year from now())::int,
  payment_ref text,
  amount numeric(10,2),
  status public.enrollment_status not null default 'paid',
  notes text,
  created_at timestamptz not null default now(),
  unique (youth_id, year)
);
create index on public.enrollments(year);

-- =========================================
-- CUSA MEMBERS
-- =========================================
create table public.cusa_members (
  id uuid primary key default gen_random_uuid(),
  youth_id uuid not null references public.youths(id) on delete cascade,
  institution text not null,
  course text,
  year_of_study text,
  leadership_role text,
  created_at timestamptz not null default now(),
  unique (youth_id)
);

-- =========================================
-- EVENTS
-- =========================================
create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  event_date date,
  venue text,
  description text,
  organization_level public.event_org_level,
  deanery_id uuid references public.deaneries(id) on delete set null,
  parish_id uuid references public.parishes(id) on delete set null,
  outstation_id uuid references public.outstations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.event_program_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  start_time text,
  end_time text,
  activity text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.event_program_items(event_id);

create table public.event_duty_categories (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.event_duty_categories(event_id);

create table public.event_duties (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.event_duty_categories(id) on delete cascade,
  title text not null,
  fields jsonb not null default '{}'::jsonb,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.event_duties(category_id);

create table public.event_duty_assignees (
  id uuid primary key default gen_random_uuid(),
  duty_id uuid not null references public.event_duties(id) on delete cascade,
  deanery_id uuid references public.deaneries(id) on delete set null,
  parish_id uuid references public.parishes(id) on delete set null,
  name text not null,
  created_at timestamptz not null default now()
);
create index on public.event_duty_assignees(duty_id);

create table public.event_checkins (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  youth_id uuid references public.youths(id) on delete set null,
  guest_name text,
  guest_phone text,
  method public.checkin_method not null default 'search',
  checked_in_at timestamptz not null default now()
);
create index on public.event_checkins(event_id);

-- =========================================
-- USER ROLES (for future admin gating)
-- =========================================
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists(select 1 from public.user_roles where user_id=_user_id and role=_role)
$$;

-- =========================================
-- updated_at triggers
-- =========================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger youths_touch before update on public.youths
  for each row execute function public.touch_updated_at();
create trigger events_touch before update on public.events
  for each row execute function public.touch_updated_at();

-- =========================================
-- RLS — open policies until login is added
-- =========================================
alter table public.deaneries enable row level security;
alter table public.parishes enable row level security;
alter table public.outstations enable row level security;
alter table public.youths enable row level security;
alter table public.enrollments enable row level security;
alter table public.cusa_members enable row level security;
alter table public.events enable row level security;
alter table public.event_program_items enable row level security;
alter table public.event_duty_categories enable row level security;
alter table public.event_duties enable row level security;
alter table public.event_duty_assignees enable row level security;
alter table public.event_checkins enable row level security;
alter table public.user_roles enable row level security;

-- Public read + write (admin app, no login yet). Tighten once auth is added.
do $$
declare t text;
begin
  for t in select unnest(array[
    'deaneries','parishes','outstations','youths','enrollments','cusa_members',
    'events','event_program_items','event_duty_categories','event_duties',
    'event_duty_assignees','event_checkins'
  ]) loop
    execute format('create policy "public_read_%1$s" on public.%1$s for select using (true)', t);
    execute format('create policy "public_insert_%1$s" on public.%1$s for insert with check (true)', t);
    execute format('create policy "public_update_%1$s" on public.%1$s for update using (true) with check (true)', t);
    execute format('create policy "public_delete_%1$s" on public.%1$s for delete using (true)', t);
  end loop;
end $$;

-- user_roles: only admins manage; users read own
create policy "user_roles_read_own" on public.user_roles for select using (auth.uid() = user_id);
create policy "user_roles_admin_all" on public.user_roles for all using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
