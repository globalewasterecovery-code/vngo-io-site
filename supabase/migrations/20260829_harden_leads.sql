-- Harden the already-deployed public.leads table without exposing existing rows.
-- NOT VALID preserves any legacy rows while enforcing each constraint for new writes.

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'leads_source_page_length') then
    alter table public.leads add constraint leads_source_page_length check (char_length(source_page) <= 500) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'leads_source_campaign_length') then
    alter table public.leads add constraint leads_source_campaign_length check (char_length(source_campaign) <= 200) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'leads_language_length') then
    alter table public.leads add constraint leads_language_length check (char_length(language) <= 35) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'leads_country_length') then
    alter table public.leads add constraint leads_country_length check (char_length(country) <= 100) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'leads_name_length') then
    alter table public.leads add constraint leads_name_length check (char_length(name) between 1 and 200) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'leads_contact_type_length') then
    alter table public.leads add constraint leads_contact_type_length check (char_length(contact_type) between 1 and 50) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'leads_contact_value_length') then
    alter table public.leads add constraint leads_contact_value_length check (char_length(contact_value) between 1 and 320) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'leads_party_size_range') then
    alter table public.leads add constraint leads_party_size_range check (party_size between 1 and 10000) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'leads_service_type_length') then
    alter table public.leads add constraint leads_service_type_length check (char_length(service_type) between 1 and 100) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'leads_budget_range_length') then
    alter table public.leads add constraint leads_budget_range_length check (char_length(budget_range) <= 100) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'leads_message_length') then
    alter table public.leads add constraint leads_message_length check (char_length(message) <= 5000) not valid;
  end if;
end $$;

drop policy if exists "public can insert leads" on public.leads;
create policy "public can insert leads"
  on public.leads for insert
  to anon
  with check (site = 'vngo' and status = 'new');
