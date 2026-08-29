-- Carbon standardized Lead schema (VNGO P3 conversion pipeline).
-- Apply via Supabase dashboard SQL editor or `supabase db push` once CLI/creds are available
-- (this session only has the anon publishable key, which cannot run DDL — see CARBON_HANDOFF.md).

create extension if not exists pgcrypto;

create table if not exists public.leads (
  lead_id uuid primary key default gen_random_uuid(),
  site text not null default 'vngo',
  source_page text check (char_length(source_page) <= 500),
  source_campaign text check (char_length(source_campaign) <= 200),
  language text check (char_length(language) <= 35),
  country text check (char_length(country) <= 100),
  name text not null check (char_length(name) between 1 and 200),
  contact_type text not null check (char_length(contact_type) between 1 and 50),
  contact_value text not null check (char_length(contact_value) between 1 and 320),
  travel_date date,
  party_size int check (party_size between 1 and 10000),
  service_type text not null check (char_length(service_type) between 1 and 100),
  budget_range text check (char_length(budget_range) <= 100),
  message text check (char_length(message) <= 5000),
  created_at timestamptz not null default now(),
  status text not null default 'new'
    check (status in ('new','qualified','contacted','quoted','won','lost','spam'))
);

create index if not exists leads_site_created_idx on public.leads (site, created_at desc);
create index if not exists leads_status_idx on public.leads (status);

alter table public.leads enable row level security;

-- Public (anon) clients may INSERT only — no select/update/delete for anon,
-- so submitted leads cannot be read back or tampered with from the browser.
drop policy if exists "public can insert leads" on public.leads;
create policy "public can insert leads"
  on public.leads for insert
  to anon
  with check (site = 'vngo' and status = 'new');

-- Do not grant read/update access to the generic authenticated role: community
-- accounts use that role too. Leads remain manageable from the Supabase
-- dashboard or a trusted server using the service role until a dedicated staff
-- authorization model exists.
drop policy if exists "authenticated can read leads" on public.leads;
drop policy if exists "authenticated can update leads" on public.leads;
