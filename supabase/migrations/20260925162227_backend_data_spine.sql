-- StartupSignals data spine. Public browser roles have no table access; the
-- backend and ingestion job use a server-only Supabase secret key.
create table public.ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null check (status in ('running', 'success', 'failed', 'skipped')),
  rows_fetched integer not null default 0,
  rows_accepted integer not null default 0,
  error_summary text
);
create index ingestion_runs_source_started_idx on public.ingestion_runs (source, started_at desc);

create table public.source_records (
  source text not null,
  external_id text not null,
  source_url text,
  event_date date,
  observed_at timestamptz not null default now(),
  run_id uuid references public.ingestion_runs(id),
  payload jsonb not null,
  primary key (source, external_id)
);
create index source_records_run_idx on public.source_records (run_id);

create table public.companies (
  id uuid primary key,
  canonical_key text not null unique,
  name text not null,
  normalized_name text not null,
  address text,
  city text not null,
  state text not null default 'NJ' check (state = 'NJ'),
  county text,
  lat double precision,
  lng double precision,
  website text,
  founded_year integer,
  sector text not null default 'Other',
  industry_group text,
  is_sample boolean not null default false,
  active boolean not null default true,
  geocode_confidence text,
  updated_at timestamptz not null default now(),
  check ((lat is null and lng is null) or
    (lat between 38.8 and 41.5 and lng between -75.7 and -73.7))
);
create index companies_name_city_idx on public.companies (normalized_name, city);
create index companies_sector_idx on public.companies (sector) where active;

create table public.company_aliases (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  city text not null,
  source text not null,
  reviewed_at timestamptz,
  unique (normalized_alias, city)
);

create table public.match_review (
  id bigint generated always as identity primary key,
  source text not null,
  external_id text not null,
  candidate_company_id uuid references public.companies(id) on delete set null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_at timestamptz,
  unique (source, external_id),
  foreign key (source, external_id) references public.source_records(source, external_id)
);

create table public.signals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  source text not null,
  external_id text not null,
  type text not null check (type in ('funding', 'grant', 'hiring', 'ip', 'accelerator', 'support')),
  subtype text,
  amount numeric,
  count integer,
  event_date date not null,
  source_url text,
  description text,
  last_observed_at timestamptz not null default now(),
  unique (source, external_id),
  foreign key (source, external_id) references public.source_records(source, external_id)
);
create index signals_company_type_date_idx on public.signals (company_id, type, event_date desc);

alter table public.ingestion_runs enable row level security;
alter table public.source_records enable row level security;
alter table public.companies enable row level security;
alter table public.company_aliases enable row level security;
alter table public.match_review enable row level security;
alter table public.signals enable row level security;

revoke all on public.ingestion_runs, public.source_records, public.companies,
  public.company_aliases, public.match_review, public.signals from anon, authenticated;
grant select, insert, update, delete on public.ingestion_runs, public.source_records,
  public.companies, public.company_aliases, public.match_review, public.signals to service_role;
grant usage, select on sequence public.company_aliases_id_seq,
  public.match_review_id_seq to service_role;

-- One RPC call publishes a fully built snapshot. It runs with the caller's
-- privileges; only the server-side service role may execute it.
create function public.publish_dataset(p_companies jsonb, p_signals jsonb)
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

  delete from public.signals;
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
