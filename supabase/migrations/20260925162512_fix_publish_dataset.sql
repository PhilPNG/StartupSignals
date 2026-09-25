-- Keep snapshot publication compatible with safe-update enforcement.
create or replace function public.publish_dataset(p_companies jsonb, p_signals jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if jsonb_array_length(p_companies) = 0 then
    raise exception 'Refusing to publish an empty company set';
  end if;

  update public.companies set active = false where not is_sample;
  insert into public.companies (
    id, canonical_key, name, normalized_name, address, city, state, county,
    lat, lng, website, founded_year, sector, industry_group, is_sample,
    active, geocode_confidence, updated_at
  )
  select id, canonical_key, name, normalized_name, address, city, 'NJ', county,
    lat, lng, website, founded_year, sector, industry_group, false,
    true, geocode_confidence, now()
  from jsonb_to_recordset(p_companies) as c (
    id uuid, canonical_key text, name text, normalized_name text,
    address text, city text, county text, lat double precision,
    lng double precision, website text, founded_year integer,
    sector text, industry_group text, geocode_confidence text
  )
  on conflict (id) do update set
    canonical_key = excluded.canonical_key, name = excluded.name,
    normalized_name = excluded.normalized_name, address = excluded.address,
    city = excluded.city, county = excluded.county, lat = excluded.lat,
    lng = excluded.lng, website = excluded.website,
    founded_year = excluded.founded_year, sector = excluded.sector,
    industry_group = excluded.industry_group, active = true,
    geocode_confidence = excluded.geocode_confidence, updated_at = now();

  delete from public.signals where company_id is not null;
  insert into public.signals (
    company_id, source, external_id, type, subtype, amount, count,
    event_date, source_url, description, last_observed_at
  )
  select company_id, source, external_id, type, subtype, amount, count,
    event_date, source_url, description, now()
  from jsonb_to_recordset(p_signals) as s (
    company_id uuid, source text, external_id text, type text,
    subtype text, amount numeric, count integer, event_date date,
    source_url text, description text
  );
end;
$$;
revoke all on function public.publish_dataset(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.publish_dataset(jsonb, jsonb) to service_role;
