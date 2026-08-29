-- Carbon standardized Lead schema (VNGO P3 conversion pipeline).
-- Apply via Supabase dashboard SQL editor or `supabase db push` once CLI/creds are available
-- (this session only has the anon publishable key, which cannot run DDL — see CARBON_HANDOFF.md).

create extension if not exists pgcrypto;

create table if not exists public.leads (
  lead_id uuid primary key default gen_random_uuid(),
  site text not null default 'vngo',
  source_page text,
  source_campaign text,
  language text,
  country text,
  name text not null,
  contact_type text not null,
  contact_value text not null,
  travel_date date,
  party_size int,
  service_type text not null,
  budget_range text,
  message text,
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
  with check (true);

-- Do not grant read/update access to the generic authenticated role: community
-- accounts use that role too. Leads remain manageable from the Supabase
-- dashboard or a trusted server using the service role until a dedicated staff
-- authorization model exists.
drop policy if exists "authenticated can read leads" on public.leads;
drop policy if exists "authenticated can update leads" on public.leads;
