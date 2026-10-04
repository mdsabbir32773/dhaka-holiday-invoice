-- DHAKA HOLIDAY AUTOMATED MONEY RECEIPT
-- Run this entire file once in Supabase SQL Editor.

create extension if not exists pgcrypto;

create sequence if not exists public.receipt_number_seq start 1;

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_no text not null unique,
  date date not null,
  customer_name text not null,
  customer_phone text,
  customer_address text,
  items jsonb not null default '[]'::jsonb,
  total numeric(14,2) not null default 0,
  amount_words text,
  payment_modes text[] not null default '{}',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_settings (
  id integer primary key check (id = 1),
  company text not null default 'Dhaka Holiday',
  phone text not null default '01901168410 | 01847801410',
  address text not null default 'Dhaka Holiday, 68-69 Concept Tower, Lift 3 (4th Floor), Panthapath Signal, Green Road, Dhaka-1205',
  footer text not null default 'Thank you for choosing Dhaka Holiday. We wish you a pleasant journey.',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.company_settings (id) values (1)
on conflict (id) do nothing;

-- Keep updated_at current.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists receipts_updated_at on public.receipts;
create trigger receipts_updated_at
before update on public.receipts
for each row execute function public.set_updated_at();

drop trigger if exists company_settings_updated_at on public.company_settings;
create trigger company_settings_updated_at
before update on public.company_settings
for each row execute function public.set_updated_at();

-- Atomic receipt numbering. Calling this RPC is safe for concurrent admins.
create or replace function public.next_receipt_no()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  n bigint;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  n := nextval('public.receipt_number_seq');
  return 'DH-' || lpad(n::text, 5, '0');
end;
$$;

revoke all on function public.next_receipt_no() from public;
grant execute on function public.next_receipt_no() to authenticated;

alter sequence public.receipt_number_seq owner to postgres;

alter table public.receipts enable row level security;
alter table public.company_settings enable row level security;

drop policy if exists "Authenticated admins can read receipts" on public.receipts;
drop policy if exists "Authenticated admins can insert receipts" on public.receipts;
drop policy if exists "Authenticated admins can update receipts" on public.receipts;
drop policy if exists "Authenticated admins can delete receipts" on public.receipts;

create policy "Authenticated admins can read receipts"
on public.receipts for select to authenticated using (true);

create policy "Authenticated admins can insert receipts"
on public.receipts for insert to authenticated
with check (created_by = auth.uid() or created_by is null);

create policy "Authenticated admins can update receipts"
on public.receipts for update to authenticated
using (true) with check (true);

create policy "Authenticated admins can delete receipts"
on public.receipts for delete to authenticated using (true);

drop policy if exists "Authenticated users can read company settings" on public.company_settings;
drop policy if exists "Authenticated users can update company settings" on public.company_settings;

create policy "Authenticated users can read company settings"
on public.company_settings for select to authenticated using (true);

create policy "Authenticated users can update company settings"
on public.company_settings for update to authenticated using (true) with check (true);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.receipts to authenticated;
grant select, update on public.company_settings to authenticated;

alter table public.receipts alter column created_by set default auth.uid();
