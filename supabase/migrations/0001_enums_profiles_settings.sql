-- 0001: enums, profiles, app settings, shared helper functions.

create type public.app_role     as enum ('admin', 'recorder');
create type public.entry_kind   as enum ('expense', 'income');
create type public.entry_status as enum ('pending', 'approved', 'rejected', 'exported');

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null check (length(trim(full_name)) between 2 and 120),
  email      text not null,
  role       public.app_role not null default 'recorder',
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index profiles_email_key on public.profiles (lower(email));

-- Generic updated_at maintenance.
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Role helpers used by RLS policies. SECURITY DEFINER so policies on `profiles`
-- itself cannot recurse.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.is_active
  );
$$;

create or replace function public.is_active_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active
  );
$$;

-- Key/value application settings (company name, limits, voucher numbering ...).
create table public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);

create trigger app_settings_set_updated_at before update on public.app_settings
  for each row execute function public.set_updated_at();

insert into public.app_settings (key, value) values
  ('company_name',           to_jsonb('Your Organisation'::text)),   -- must match the Tally company
  ('voucher_prefix',         to_jsonb(''::text)),                    -- e.g. 'APP-' to avoid clashing with existing Tally numbers
  ('voucher_start_number',   to_jsonb(1)),                           -- first number in each financial year
  ('voucher_required_above', 'null'::jsonb),                         -- null = voucher always optional
  ('max_amount',             to_jsonb(1000000)),                     -- sanity limit per entry (rupees)
  ('tally_encoding',         to_jsonb('utf-8'::text));

create or replace function public.setting_numeric(p_key text) returns numeric
language sql stable security definer set search_path = public as $$
  select nullif(value #>> '{}', '')::numeric from public.app_settings where key = p_key;
$$;

create or replace function public.setting_text(p_key text) returns text
language sql stable security definer set search_path = public as $$
  select value #>> '{}' from public.app_settings where key = p_key;
$$;

-- Indian financial year (April-March) helper: FY 2026-27 -> 2026.
create or replace function public.fy_of(d date) returns int
language sql immutable as $$
  select extract(year from d)::int - case when extract(month from d) < 4 then 1 else 0 end;
$$;
